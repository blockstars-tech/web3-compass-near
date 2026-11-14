/*
 * EXCERPT — NEAR parts only.
 * NEAR settings (all optional, all non-secret defaults).
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

@Injectable()
export class ApiConfigService {

  // … (non-NEAR code omitted) …

  /**
   * NEAR web4 content fetching: sites are fetched over HTTPS from the public
   * web4 gateway (`https://<account>.near.page`), no proxy. Both values have
   * defaults, so no env key is required. `siteTtlSeconds` = resolver TTL hint
   * (how often an unchanged site's fingerprint is re-checked).
   */
  get nearConfig() {
    return {
      siteTtlSeconds:
        this.getNumber('NEAR_WEB4_SITE_TTL_SECONDS') || 6 * 60 * 60,
      fetchTimeoutMs: this.getNumber('NEAR_WEB4_FETCH_TIMEOUT_MS') || 30_000,
      // Link discovery: after a web4 site is scraped, the `.near.page` links
      // on its page are stored as CANDIDATE names for the indexer to verify
      // on-chain. Opt-in (NEAR_WEB4_DISCOVERY_ENABLED=true). Two caps bound
      // what an untrusted page can add: names taken per page, and the total
      // of .near names not confirmed as a site (see addNearWeb4Candidates).
      discoveryEnabled:
        this.configService.get('NEAR_WEB4_DISCOVERY_ENABLED') === 'true',
      discoveryMaxPerPage:
        this.getNumber('NEAR_WEB4_DISCOVERY_MAX_PER_PAGE') || 50,
      discoveryMaxUnconfirmed:
        this.getNumber('NEAR_WEB4_DISCOVERY_MAX_UNCONFIRMED') || 2000,
    };
  }

  // … (non-NEAR code omitted) …

}
