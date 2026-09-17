import { Global, Module } from '@nestjs/common';
import { NotificationsController, NotificationsService } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
