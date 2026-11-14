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
   * NEAR web4 sites. Read-only: one `web4_get` view call per account over
   * JSON-RPC, no keys. Every value has a default, so no env key is required;
   * the job is opt-in (NEAR_WEB4_ENABLED=true).
   *
   * The default endpoint is FastNEAR's free public RPC, whose limit is
   * unpublished — hence the low default RPS. Set NEAR_RPC_API_KEY (sent as a
   * Bearer token) when moving to a paid endpoint.
   */
  get nearConfig() {
    return {
      web4Enabled: this.configService.get('NEAR_WEB4_ENABLED') === 'true',
      rpcUrl: this.getString('NEAR_RPC_URL', 'https://free.rpc.fastnear.com'),
      rpcApiKey: this.getString('NEAR_RPC_API_KEY', ''),
      rpcRps: this.positiveNumber('NEAR_RPC_RPS', 2),
      // Accounts re-checked per tick, and how long a check stays fresh.
      batchSize: this.positiveNumber('NEAR_WEB4_BATCH_SIZE', 50),
      ttlDays: this.positiveNumber('NEAR_WEB4_TTL_DAYS', 7),
      // The RPC token bucket is the real throttle; this just bounds in-flight.
      concurrency: this.positiveNumber('NEAR_WEB4_CONCURRENCY', 2),
    };
  }

  /** A number > 0 from env, or `defaultValue` when unset, blank or invalid. */
  private positiveNumber(key: string, defaultValue: number): number {
    const value = Number(this.configService.get(key));

    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }

  // … (non-NEAR code omitted) …

}
