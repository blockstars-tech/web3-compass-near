/* eslint-disable unicorn/no-null -- null clears nullable columns / means "not a web4 site" */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PromisePool } from '@supercharge/promise-pool';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  NEAR_CONTENT_TYPE,
  NEAR_WEB4_SEED_ACCOUNTS,
} from '../../near/near.constants';
import { NearWeb4Service } from '../../near/near-web4.service';
import { ContentPointerService } from '../../pointer/content-pointer.service';
import { ApiConfigService } from '../../shared/services/api-config.service';
import type { DnsEntity } from '../dns.entity';
import { DnsRepository } from '../dns.repository';

/**
 * NEAR web4 discovery + refresh.
 *
 * NEAR has no registry of web4 sites, so there is no chain cursor to tail.
 * The job starts from a seed list of known accounts (inserted once per
 * process, never overwriting an existing row) and then keeps a queue: each
 * tick it takes the `.near` rows that were never checked or are past the TTL
 * and asks the chain whether the account has a `web4_get` method.
 *
 *  - web4 site     → `cid` = the account id, `contentType` = near-web4, and a
 *    NEAR_WEB4 content_pointer keyed by the name. The scraper's pointer pipeline
 *    then fetches `https://<account>.near.page/` and indexes it; this job never
 *    touches `ipfsProcessed` for such rows.
 *  - not a web4 site → `cid` / `contentType` null, `ipfsProcessed = true`, and
 *    any stale pointer removed, so nothing downstream picks the row up.
 *
 * `cid` holds the account id because a web4 site has no content hash: the
 * column must be non-null for the row to count as a site (stats, gateway) and
 * unique per site (the scraper groups rows that share a cid).
 *
 * Never writes `ipfsFetchStatus` / `isFetchFailed`: the IPFS retry jobs select
 * on those regardless of chain. Never writes `needsReindex` (the scraper's
 * admin flag). Queue-driven, paced by the RPC token bucket. Off by default
 * (NEAR_WEB4_ENABLED=true).
 */
@Injectable()
export class NearWeb4RefreshJob {
  private isJobRunning = false;

  private isSeeded = false;

  constructor(
    @InjectPinoLogger(NearWeb4RefreshJob.name)
    private readonly logger: PinoLogger,
    private readonly config: ApiConfigService,
    private readonly web4: NearWeb4Service,
    private readonly dnsRepository: DnsRepository,
    private readonly contentPointerService: ContentPointerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'near_web4_refresh' })
  async handle(): Promise<void> {
    const cfg = this.config.nearConfig;

    if (!cfg.web4Enabled) {
      return;
    }

    if (this.isJobRunning) {
      this.logger.info('NEAR web4 refresh already running');

      return;
    }

    this.isJobRunning = true;

    try {
      if (!this.isSeeded) {
        await this.dnsRepository.insertNearCandidates(NEAR_WEB4_SEED_ACCOUNTS);
        this.isSeeded = true;
        this.logger.info(
          `NEAR web4 seed ensured (${NEAR_WEB4_SEED_ACCOUNTS.length} accounts)`,
        );
      }

      const batch = await this.dnsRepository.findNearDomainsForRefresh(
        cfg.batchSize,
        cfg.ttlDays,
      );

      if (batch.length === 0) {
        return;
      }

      let refreshed = 0;
      let sites = 0;
      let failed = 0;

      await PromisePool.for(batch)
        .withConcurrency(cfg.concurrency)
        .process(async (dns) => {
          try {
            if (await this.refreshDomain(dns)) {
              sites++;
            }

            refreshed++;
          } catch (error) {
            // Leave recordsRefreshedAt untouched so the row replays next tick.
            failed++;
            this.logger.warn(
              `NEAR web4 refresh ${dns.name} failed: ${
                (error as Error).message
              }`,
            );
          }
        });

      this.logger.info(
        `NEAR web4 refresh: ${refreshed}/${batch.length} checked, ${sites} web4 sites, ${failed} failed`,
      );
    } catch (error) {
      this.logger.error(`NEAR web4 refresh error: ${(error as Error).message}`);
    } finally {
      this.isJobRunning = false;
    }
  }

  /** Probe one account and persist the outcome. Returns true for a web4 site. */
  private async refreshDomain(dns: DnsEntity): Promise<boolean> {
    const isWeb4 = await this.web4.hasWeb4Site(dns.name);

    const cid = isWeb4 ? dns.name : null;
    const contentType = isWeb4 ? NEAR_CONTENT_TYPE : null;

    dns.cid = cid;
    dns.contentType = contentType;

    // Web4 sites are driven by the content_pointer pipeline (syncFromDns
    // below), so ipfsProcessed is left alone for them, as for TON ADNL sites.
    // Rows without a site get ipfsProcessed=true so nothing retries them.
    if (!cid) {
      dns.ipfsProcessed = true;
    }

    dns.recordsRefreshedAt = new Date();

    await this.dnsRepository.save(dns);
    await this.contentPointerService.syncFromDns({
      dnsId: dns.id,
      contentType,
      cid,
      // The scraper fetches the site by account name, so the pointer value is
      // the name (it equals the cid here; passed explicitly for clarity).
      pointerValue: dns.name,
    });

    return isWeb4;
  }
}
