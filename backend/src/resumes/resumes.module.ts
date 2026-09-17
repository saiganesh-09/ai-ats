import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';

@Module({ controllers: [ResumesController] })
export class ResumesModule {}
