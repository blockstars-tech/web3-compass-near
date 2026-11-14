/*
 * EXCERPT — NEAR parts only.
 * How a near-web4 row is routed, and the hostname guard.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// Which configured content gateway to dial for the second hop.
export type GatewayKey = 'ipfs' | 'bzz' | 'tonProxy' | 'web4';

export const SUPPORTED_CODECS: Record<string, ContentRoute> = {
  // … ipfs, ipns, swarm, ton-storage, ton-site-adnl …
  // NEAR web4 site: a `.near` account whose contract serves pages through the
  // public web4 gateway at https://<account>.near.page. Addressed by the
  // account name (cid = the account id, unused for routing): Caddy's TLS
  // second hop dials <account>.near.page and passes the request path through
  // unchanged, so there is no path prefix.
  'near-web4': { gateway: 'web4', pathPrefix: null },
};

/**
 * A `.near` name the gateway will turn into an upstream host: top-level
 * account, lowercase letters / digits / single hyphens. Keep in sync with
 * the indexer's `indexer/near/near.constants.ts`. The name already
 * comes from our own dns table, but it is re-checked here because it becomes
 * a hostname Caddy dials.
 */
export const NEAR_WEB4_ACCOUNT = /^[\da-z]+(-[\da-z]+)*\.near$/;
