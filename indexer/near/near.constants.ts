/**
 * NEAR web4 support. A web4 site is a NEAR account whose contract exposes a
 * `web4_get` view method; the public gateway serves it at
 * `https://<account>.near.page`. Everything here is read-only: one RPC view
 * call per account, no keys, no transactions.
 */

/**
 * Value written to `dns.content_type` for a NEAR account that serves a web4
 * site. Maps to PointerKind.NEAR_WEB4 (mutable, needs a pointer).
 *
 * Must NOT contain `ipfs`, `ipns`, `swarm`, `dnslink`, `ton` or `adnl`: the
 * scrape queues, pin index and gateway match content types by substring, and a
 * collision would route NEAR rows into another chain's pipeline.
 */
export const NEAR_CONTENT_TYPE = 'near-web4';

/** Value written to `dns.main` (the bare TLD, as for `eth` / `sol` / `ton`). */
export const NEAR_MAIN = 'near';

/** Contract view method that marks an account as a web4 site. */
export const NEAR_WEB4_METHOD = 'web4_get';

/** Per-request timeout (ms) for NEAR RPC calls. */
export const NEAR_RPC_REQUEST_TIMEOUT_MS = 30_000;

/** NEAR account ids are at most 64 characters. */
const NEAR_ACCOUNT_MAX_LENGTH = 64;

/**
 * Top-level `.near` accounts only, DNS-safe: lowercase letters, digits and
 * single hyphens, no underscores, no dots before `.near`. web4 does not serve
 * sub-accounts, and the `*.near.dweb3.wtf` wildcard covers one label — so
 * anything else could never be opened and is not indexed.
 */
const NEAR_WEB4_ACCOUNT = /^[\da-z]+(-[\da-z]+)*\.near$/;

export function isIndexableNearAccount(name: string | undefined): boolean {
  return (
    typeof name === 'string' &&
    name.length <= NEAR_ACCOUNT_MAX_LENGTH &&
    NEAR_WEB4_ACCOUNT.test(name)
  );
}

/**
 * Known web4 sites: the vgrichina/web4 README (featured + community) and the
 * awesomeweb4.near.page catalog, as of 2026-11-13. NEAR has no registry of
 * web4 sites, so this list is where discovery starts. Each entry is still
 * verified on-chain before it is treated as a site.
 */
export const NEAR_WEB4_SEED_ACCOUNTS: readonly string[] = [
  '1chess.near',
  'aclot.near',
  'awesomeweb4.near',
  'devhub.near',
  'lands.near',
  'nardy.near',
  'oracle-prices.near',
  'orangejoe.near',
  'orderly.near',
  'pcards.near',
  'psalomo.near',
  'slimebook.near',
  'sotg.near',
  'svelt.near',
  'theegg.near',
  'thewiki.near',
  'treasury-auroralabs.near',
  'twelvetone.near',
  'vlad.near',
  'web4.near',
  'web4-hackathon.near',
  'wlog.near',
  'zavodil.near',
];
