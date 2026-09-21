import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ReservationsModule } from '../reservations/reservations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ReservationsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
