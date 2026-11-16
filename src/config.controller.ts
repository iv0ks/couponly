// Public client-config controller.
//
// ⚠️ THE LEAK (not the final bug, but the enabler).
//
// A classic "bootstrap config" endpoint the front-end calls on load so it can
// build nice coupon links on the client. The mistake: it ships the hashids
// `salt` (plus min length and alphabet) to anyone — no session required. The
// designers reasoned that the browser "needs" these to render codes. But the
// salt is the one secret that makes the coupon codes reversible: with it an
// attacker can reconstruct the exact codec and forge the code of any coupon id
// (see src/hashids.ts). Secrets that unlock server-side identifiers must never
// be handed to the client.
import { Controller, Get } from '@nestjs/common';
import { config } from './config.js';

@Controller('api')
export class ConfigController {
  @Get('config')
  clientConfig() {
    return {
      // Everything the front-end "needs" to render coupon codes client-side …
      // and everything an attacker needs to reverse them.
      hashids: {
        salt: config.hashidsSalt,
        minLength: config.hashidsMinLength,
      },
      // Harmless-looking extras to make it read like a real bootstrap payload.
      brand: 'couponly',
      currency: 'EUR',
    };
  }
}
