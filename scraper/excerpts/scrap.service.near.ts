/*
 * EXCERPT — NEAR parts only.
 * Only the web4 scrape method and its helpers. Helpers it calls that are shared with the IPFS/TON paths (getContent, migrateFromHtml, getRedirectTargets, isInternalRedirect, cleanupStaleImages, closeJsdom) are not NEAR-specific and are not included.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

import { extractNearWeb4Accounts } from '../shared/services/near-web4-discovery';
import {
  fetchNearWeb4Page,
  headerValue,
  type INearWeb4Response,
  isNearWeb4Account,
} from '../shared/services/near-web4-fetch';

@Injectable()
export class ScrapService {

  // … (non-NEAR code omitted) …

  /**
   * Scrape + index a NEAR web4 site (`https://<account>.near.page/`). Called
   * by NearWeb4Ingester only when the content fingerprint changed.
   *
   * The web4 counterpart of `scrapAndMigrateWithHttp`, kept separate so the
   * TON path stays exactly as it is. Differences: the page comes over the open
   * internet through the guarded fetch in near-web4-fetch.ts (fixed host,
   * same-host redirects only, no proxy), and there is no TON proxy gate.
   * Like the TON path it parses the raw HTML with JSDOM — no Chromium, so no
   * JS runs and a client-only SPA shell ends up `hasSite=false`.
   *
   * Never sets `isFetchFailed`: the scraper's RetryFailedDnsJob picks up any row
   * with that flag and scrapes it as an IPFS CID. Failures are tracked with
   * `attempt` alone, as on the TON path.
   */
  async scrapAndMigrateWeb4(dns: DnsEntity): Promise<void> {
    const page = await this.fetchWeb4PageForScrape(dns);

    if (!page) {
      return;
    }

    const url = page.finalUrl;
    const jsdom = new JSDOM(page.body.toString('utf8'), {
      url,
      virtualConsole: quietVirtualConsole,
    });

    try {
      const htmlDocument = jsdom.window.document;

      // Meta-refresh / JS redirects to another host: same rule as the TON and
      // IPFS probes — the site has no page of its own to index.
      const hasExternalRedirect = this.getRedirectTargets(htmlDocument).some(
        (target) => !this.isInternalRedirect(target, dns.cid, url),
      );

      if (hasExternalRedirect) {
        this.logger.info(
          `NEAR web4 site ${dns.name} not indexable (page redirects off-site)`,
        );
        await this.parkWeb4AsNotIndexable(dns);

        return;
      }

      const words = this.getContent(htmlDocument) ?? [];

      // Remove urls + HTML docs from prior scrapes BEFORE writing the new one.
      // The TON / IPFS paths clean up afterwards with a timestamp cut-off
      // (`deleteUrls({ dateTo })`), which is padded by a second and relies on
      // their fetch being slow. A web4 fetch takes milliseconds, so that
      // cut-off would also delete the url this scrape is about to create. The
      // page is already fetched and parsed here, and the per-dns lock held by
      // the ingester means nothing else writes urls for this row meanwhile.
      await this.dnsService.deleteUrls({ dnsId: dns.id });

      await this.migrateFromHtml({
        cid: dns.cid,
        fetchedUrl: url,
        htmlDocument,
        dns,
        dnsId: dns.id,
        info: {
          domain: dns.name,
          ipfsUrl: url,
          chain: dns.chain,
          isPinned: false,
        },
      });

      // No extractable text ⇒ client-only SPA shell (JSDOM runs no JS).
      // hasSite=false but still processed.
      dns.hasSite = words.length > 0;
      dns.ipfsProcessed = true;
      dns.attempt = 0;
      // No image source handles near-web4, so nothing was extracted; mark the
      // row done so the image backfill never considers it.
      await this.dnsService.markImagesExtractedByCid(dns.cid);
      dns.imagesExtracted = true;
      dns = await this.dnsService.updateDnsRecord(dns);
      await this.cleanupStaleImages(dns);
      await this.discoverWeb4Candidates(dns, htmlDocument, url);
    } finally {
      closeJsdom(jsdom);
    }
  }

  /**
   * Link discovery: store the `.near.page` sites this page links to as
   * candidate names for the indexer to verify on-chain (see
   * near-web4-discovery.ts). Opt-in, and best-effort: the page is already
   * indexed by the time this runs, and a failure here never fails the scrape.
   */
  private async discoverWeb4Candidates(
    dns: DnsEntity,
    htmlDocument: Document,
    pageUrl: string,
  ): Promise<void> {
    const cfg = this.configService.nearConfig;

    if (!cfg.discoveryEnabled) {
      return;
    }

    try {
      const candidates = extractNearWeb4Accounts(htmlDocument, pageUrl, {
        exclude: dns.name,
        max: cfg.discoveryMaxPerPage,
      });

      const added = await this.dnsService.addNearWeb4Candidates(
        candidates,
        cfg.discoveryMaxUnconfirmed,
      );

      if (added.length > 0) {
        this.logger.info(
          `NEAR web4 discovery: ${dns.name} links to ${candidates.length} .near site(s), ${added.length} new: ${added.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `NEAR web4 discovery failed for ${dns.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Fetch a web4 site's root page for scraping. Returns the page when it is an
   * indexable 2xx HTML answer. Returns undefined when the row has been dealt
   * with and there is nothing to scrape (not indexable, or failed for good and
   * parked). Throws when the fetch failed and should be retried next tick.
   */
  private async fetchWeb4PageForScrape(
    dns: DnsEntity,
  ): Promise<INearWeb4Response | undefined> {
    if (!isNearWeb4Account(dns.name)) {
      // Not something the indexer writes; never turn it into a hostname.
      this.logger.warn(
        `NEAR web4: ${dns.name} is not an indexable account (DNS ${dns.id})`,
      );
      await this.parkWeb4AsNotIndexable(dns);

      return undefined;
    }

    let page: INearWeb4Response | undefined;
    let failure: string | undefined;

    try {
      page = await fetchNearWeb4Page(this.httpService, dns.name, {
        timeoutMs: this.configService.nearConfig.fetchTimeoutMs,
        maxBytes: HTML_PROBE_SIZE_LIMIT,
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : 'fetch failed';
    }

    if (page && page.status >= 300 && page.status < 400) {
      // A redirect the fetch refused to follow, i.e. one that leaves the
      // site's own host: there is no page of its own to index.
      this.logger.info(
        `NEAR web4 site ${dns.name} not indexable (redirects off-site, ${page.status})`,
      );
      await this.parkWeb4AsNotIndexable(dns);

      return undefined;
    }

    if (page && (page.status < 200 || page.status >= 400)) {
      failure = `status ${page.status}`;
    }

    if (!page || failure) {
      await this.recordWeb4FetchFailure(dns, failure ?? 'fetch failed');

      return undefined;
    }

    const contentType = headerValue(page.headers, 'content-type');

    if (
      contentType &&
      unsupportedContentTypes.some((ct) => contentType.includes(ct))
    ) {
      this.logger.info(
        `NEAR web4 site ${dns.name} not indexable (content type ${contentType})`,
      );
      await this.parkWeb4AsNotIndexable(dns);

      return undefined;
    }

    return page;
  }

  /**
   * Count a failed web4 fetch. Throws while attempts remain, so the pointer
   * stays dirty and the orchestrator retries next tick; at MAX_RETRY_ATTEMPTS
   * it parks the row instead, so a permanently failing site can't loop
   * forever. The resolver re-dirties the pointer when the site's fingerprint
   * next changes.
   */
  private async recordWeb4FetchFailure(
    dns: DnsEntity,
    failure: string,
  ): Promise<void> {
    dns.attempt = (dns.attempt ?? 0) + 1;

    if (dns.attempt < MAX_RETRY_ATTEMPTS) {
      await this.dnsService.updateDnsRecord(dns);

      throw new Error(
        `NEAR web4 site fetch failed for ${dns.name} (attempt ${dns.attempt}): ${failure}`,
      );
    }

    this.logger.warn(
      `NEAR web4 site ${dns.name} fetch failed ${dns.attempt}x — parking (last: ${failure})`,
    );
    dns.hasSite = false;
    dns.ipfsProcessed = true;
    await this.dnsService.updateDnsRecord(dns);
  }

  /** A web4 row with nothing to index: processed, no site, retries reset. */
  private async parkWeb4AsNotIndexable(dns: DnsEntity): Promise<void> {
    dns.hasSite = false;
    dns.ipfsProcessed = true;
    dns.attempt = 0;
    await this.dnsService.updateDnsRecord(dns);
  }

  // … (non-NEAR code omitted) …

}
