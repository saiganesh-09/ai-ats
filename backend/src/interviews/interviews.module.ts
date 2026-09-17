import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';
import { InterviewRemindersService } from './reminders.service';

@Module({
  controllers: [InterviewsController],
  providers: [InterviewRemindersService],
})
export class InterviewsModule {}
