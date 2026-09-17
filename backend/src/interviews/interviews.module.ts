import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';

@Module({ controllers: [InterviewsController] })
export class InterviewsModule {}
