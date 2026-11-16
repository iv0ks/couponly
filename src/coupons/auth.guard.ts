// Session auth guard.
//
// Every coupon route requires a logged-in session. The guard only checks that
// *a* session exists — it says nothing about *which* coupons you may read,
// redeem or modify. That is authentication, not authorization; the missing
// ownership checks on the read / redeem / modify endpoints are the lab.
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export interface SessionData {
  userId?: number;
  username?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { session: SessionData }>();
    if (!req.session?.userId) {
      throw new UnauthorizedException('Not authenticated. POST /api/login first.');
    }
    return true;
  }
}
