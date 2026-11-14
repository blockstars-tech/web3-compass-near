import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DnsService } from '../../dns/dns.service';
import { ScrapService } from '../../scrap/scrap.service';
import { RedisService } from '../../shared/services/redis.service';
import type { ContentPointerEntity } from '../content-pointer.entity';
import { AnchorKind } from '../content-pointer.entity';
import type { ContentIngester } from './content-ingester.interface';

// Shared with the IPFS/Swarm/TON ingesters' dnsProccessing_ lock TTL.
const LOCK_TTL_SECONDS = 600;

/**
 * Ingests a NEAR web4 site whose content fingerprint changed (anchorKind
 * WEB4_SITE). Fetches `https://<account>.near.page/` via
 * `ScrapService.scrapAndMigrateWeb4`, which parses + indexes to Meilisearch.
 *
 * TonHttpIngester without the TON backoff: near.page is an ordinary HTTPS
 * gateway, so a failed scrape just leaves the pointer dirty and the
 * orchestrator retries it next tick, up to the scrape's own attempt cap.
 */
@Injectable()
export class NearWeb4Ingester implements ContentIngester {
  readonly anchorKind = AnchorKind.WEB4_SITE;

  constructor(
    @InjectPinoLogger(NearWeb4Ingester.name)
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly dnsService: DnsService,
    private readonly scrapService: ScrapService,
  ) {}

  async ingest(pointer: ContentPointerEntity): Promise<void> {
    const dns = await this.dnsService.findById(pointer.dnsId);

    if (!dns) {
      this.logger.warn(
        `Pointer ${pointer.id} references missing dns ${pointer.dnsId}, skipping`,
      );

      return;
    }

    if (!dns.name) {
      this.logger.warn(
        `Pointer ${pointer.id} (dns ${dns.id}) has no name, skipping`,
      );

      return;
    }

    // Resolver already found the site unreachable (`down:<status>` anchor).
    // Skip the scrape; it re-dirties automatically when the anchor changes.
    if (pointer.currentAnchor?.startsWith('down:')) {
      this.logger.info(
        `NEAR web4 site ${dns.name} unreachable (${pointer.currentAnchor}); skipping scrape`,
      );
      dns.hasSite = false;
      dns.ipfsProcessed = true;
      dns.attempt = 0;
      await this.dnsService.updateDnsRecord(dns);

      return;
    }

    const dnsLockKey = `dnsProccessing_${dns.id}`;

    if (await this.redis.get(dnsLockKey)) {
      this.logger.info(
        `DNS ${dns.id} is already being processed, skipping pointer ${pointer.id}`,
      );

      return;
    }

    await this.redis.set(dnsLockKey, 'processing', LOCK_TTL_SECONDS);

    try {
      this.logger.info(
        `Ingesting NEAR web4 pointer ${pointer.id} (dns ${dns.id}) -> ${dns.name}`,
      );

      await this.scrapService.scrapAndMigrateWeb4(dns);
    } finally {
      await this.redis.delete(dnsLockKey).catch(() => {});
    }
  }
}
