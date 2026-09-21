import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { ReservationsModule } from '../reservations/reservations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [ScheduleModule.forRoot(), ReservationsModule, NotificationsModule],
  providers: [CronService, EmailService],
  exports: [CronService],
})
export class CronModule {}
