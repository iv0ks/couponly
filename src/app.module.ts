import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller.js';
import { HealthController } from './health.controller.js';
import { ConfigController } from './config.controller.js';
import { CouponsModule } from './coupons/coupons.module.js';

@Module({
  imports: [CouponsModule],
  controllers: [HealthController, AuthController, ConfigController],
})
export class AppModule {}
