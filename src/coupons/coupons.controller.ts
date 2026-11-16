// Coupons controller.
//
// Coupons are addressed by a hashids `code` (e.g. "gY6z"), never by their raw
// integer id. The app treats that code as unguessable and therefore skips
// ownership checks on three endpoints:
//
//   GET    /api/coupons/:code         → read ANY coupon       (read IDOR)
//   POST   /api/coupons/:code/redeem  → redeem ANY coupon      (write IDOR)
//   PATCH  /api/coupons/:code         → modify ANY coupon      (write IDOR)
//
// The twist versus level 4 (snapvault's base64 handles) is the encoding:
// hashids with a salt. You cannot guess a code — but GET /api/config leaks the
// salt, so you reconstruct the codec, encode the victim's id and forge the
// code. All three endpoints then act on a coupon you do not own (CWE-639).
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AuthGuard, type SessionData } from './auth.guard.js';
import { CouponsService } from './coupons.service.js';
import { decodeId } from '../hashids.js';

// Validated body for PATCH. Input hardening is NOT the vulnerability here (the
// missing ownership check is), so this is the safe, strict kind of DTO.
class ModifyCouponDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPct?: number;
}

@Controller('api')
@UseGuards(AuthGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  // SAFE: only your own coupons.
  @Get('coupons')
  async listOwn(@Req() req: Request & { session: SessionData }) {
    const rows = await this.coupons.listOwn(req.session.userId!);
    return { coupons: rows };
  }

  // ⚠️ READ IDOR: fetches by code (→ id) with no ownership check.
  @Get('coupons/:code')
  async getOne(@Param('code') code: string) {
    const id = decodeId(code);
    if (id === null) throw new BadRequestException('malformed coupon code');
    const coupon = await this.coupons.findById(id);
    if (!coupon) throw new NotFoundException('coupon not found');
    return { coupon };
  }

  // ⚠️ WRITE IDOR (redeem): burns any coupon by code with no ownership check.
  @Post('coupons/:code/redeem')
  @HttpCode(200)
  async redeem(@Param('code') code: string) {
    const id = decodeId(code);
    if (id === null) throw new BadRequestException('malformed coupon code');
    const coupon = await this.coupons.redeem(id);
    if (!coupon) throw new NotFoundException('coupon not found');
    return { ok: true, coupon };
  }

  // ⚠️ WRITE IDOR (modify): rewrites any coupon by code with no ownership check.
  @Patch('coupons/:code')
  async modify(@Param('code') code: string, @Body() body: ModifyCouponDto) {
    const id = decodeId(code);
    if (id === null) throw new BadRequestException('malformed coupon code');
    const coupon = await this.coupons.modify(id, body);
    if (!coupon) throw new NotFoundException('coupon not found');
    return { ok: true, coupon };
  }
}
