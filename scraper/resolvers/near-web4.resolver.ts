import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ApiConfigService } from '../../shared/services/api-config.service';
import {
  fetchNearWeb4Page,
  headerValue,
  type INearWeb4Response,
} from '../../shared/services/near-web4-fetch';
import { AnchorKind, PointerKind } from '../content-pointer.entity';
import type {
  PointerResolver,
  ResolveResult,
} from './pointer-resolver.interface';

/** Cap how much body we download just to fingerprint (1 MB is plenty). */
const MAX_FINGERPRINT_BYTES = 1024 * 1024;

/**
 * Statuses the web4 gateway also returns for a healthy site when its own
 * backend hiccups (seen live: a contract-rendered site answering 400 during a
 * burst, 200 a moment later). Worth one more try before calling the site down.
 * 404 is not here: that is the gateway's real "no web4 site" answer.
 */
const TRANSIENT_STATUSES = new Set([400, 408, 425, 429, 500, 502, 503, 504]);

const RETRY_DELAY_MS = 2000;

/**
 * A site found down is looked at again after at most this long, rather than
 * after the full site TTL — a wrong "down" should not hide a site for hours.
 */
const DOWN_RECHECK_SECONDS = 60 * 60;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolver for NEAR web4 sites. `pointerValue` is the account id
 * (`alice.near`); we fetch `https://alice.near.page/` and return a CONTENT
 * FINGERPRINT as the anchor, so the scheduler only re-ingests on a real
 * change. Same contract as TonDnsResolver: live (2xx) gives ETag →
 * Last-Modified → sha256(body), prefixed by source; anything else gives a
 * stable `down:<status>` sentinel, so an unreachable site isn't re-scraped but
 * is picked up if it later comes online.
 *
 * A redirect that leaves the site's own host is not followed (see
 * near-web4-fetch.ts) and so lands here as `down:30x`.
 */
@Injectable()
export class NearWeb4Resolver implements PointerResolver {
  readonly kind = PointerKind.NEAR_WEB4;

  constructor(
    @InjectPinoLogger(NearWeb4Resolver.name)
    private readonly logger: PinoLogger,
    private readonly http: HttpService,
    private readonly config: ApiConfigService,
  ) {}

  async resolve(pointerValue: string): Promise<ResolveResult> {
    const { siteTtlSeconds } = this.config.nearConfig;

    let response = await this.fetch(pointerValue);

    if (TRANSIENT_STATUSES.has(response.status)) {
      await sleep(RETRY_DELAY_MS);
      response = await this.fetch(pointerValue);
    }

    const isLive = response.status >= 200 && response.status < 300;
    let anchor: string;

    if (isLive) {
      const etag = headerValue(response.headers, 'etag');
      const lastModified = headerValue(response.headers, 'last-modified');

      if (etag) {
        anchor = `etag:${etag}`;
      } else if (lastModified) {
        anchor = `lm:${lastModified}`;
      } else {
        anchor = `sha:${createHash('sha256')
          .update(response.body)
          .digest('hex')}`;
      }
    } else {
      anchor = `down:${response.status}`;
    }

    this.logger.debug(
      `NEAR web4 resolve ${pointerValue} -> status=${response.status} anchor=${anchor}`,
    );

    return {
      anchor,
      anchorKind: AnchorKind.WEB4_SITE,
      ttlSeconds: isLive
        ? siteTtlSeconds
        : Math.min(siteTtlSeconds, DOWN_RECHECK_SECONDS),
    };
  }

  private fetch(account: string): Promise<INearWeb4Response> {
    return fetchNearWeb4Page(this.http, account, {
      timeoutMs: this.config.nearConfig.fetchTimeoutMs,
      maxBytes: MAX_FINGERPRINT_BYTES,
    });
  }
}
