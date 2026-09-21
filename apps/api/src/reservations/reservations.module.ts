import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationCodeService } from './reservation-code.service';
import { CancelPolicyService } from './cancel-policy.service';
import { CouponService } from './coupon.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationCodeService,
    CancelPolicyService,
    CouponService,
    EmailService,
  ],
  exports: [ReservationsService, CancelPolicyService, CouponService, EmailService],
})
export class ReservationsModule {}
