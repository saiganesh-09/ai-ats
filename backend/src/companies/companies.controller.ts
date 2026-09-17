import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IsIn, IsString, MinLength } from 'class-validator';
import { JobStatus, Role, type User } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class JoinCompanyDto {
  @IsString()
  inviteCode!: string;
}

class MemberRoleDto {
  @IsIn(['RECRUITER', 'HIRING_MANAGER', 'ADMIN'])
  role!: Role;
}

/**
 * Company tenancy. First recruiter creates the company and becomes its ADMIN;
 * teammates join via the invite code. Every job/applicant query elsewhere in
 * the app is scoped by user.companyId — this is what makes it multi-tenant.
 */
@Controller('companies')
export class CompaniesController {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  @Post()
  @Roles(Role.RECRUITER, Role.ADMIN)
  async create(@CurrentUser() user: User, @Body() dto: CreateCompanyDto) {
    if (user.companyId) throw new BadRequestException('Already in a company');
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        inviteCode: randomBytes(8).toString('base64url'),
        // The creator becomes the company admin — they manage members/jobs.
        users: { connect: { id: user.id } },
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
    });
    await this.activity.log(user.id, 'company.created', 'company', company.id);
    return company;
  }

  @Post('join')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async join(@CurrentUser() user: User, @Body() dto: JoinCompanyDto) {
    if (user.companyId) throw new BadRequestException('Already in a company');
    const company = await this.prisma.company.findUnique({
      where: { inviteCode: dto.inviteCode },
    });
    if (!company) throw new NotFoundException('Invalid invite code');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { companyId: company.id },
    });
    await this.activity.log(user.id, 'company.joined', 'company', company.id);
    return company;
  }

  /** Public company directory — name + open-role count only. */
  @Public()
  @Get()
  list() {
    return this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { jobs: { where: { status: JobStatus.PUBLISHED } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('mine')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async mine(@CurrentUser() user: User) {
    if (!user.companyId) return null;
    return this.prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  /** Company admin promotes/demotes members within their own company. */
  @Patch('members/:userId/role')
  @Roles(Role.ADMIN)
  async setMemberRole(
    @CurrentUser() user: User,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: MemberRoleDto,
  ) {
    const member = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!member || member.companyId !== user.companyId) {
      throw new ForbiddenException('Not a member of your company');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: { id: true, fullName: true, role: true },
    });
  }
}
