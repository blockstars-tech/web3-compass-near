import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Fetching NEAR web4 sites. A web4 site is a NEAR account whose contract
 * serves pages through the public web4 gateway at
 * `https://<account>.near.page`.
 *
 * This file is the ONLY place a web4 URL is built or fetched. Unlike IPFS and
 * TON content — which come from our own node / proxy — a web4 page comes over
 * the open internet, so the fetch is locked down here rather than left to the
 * general scraper:
 *  - the host is always constructed from a validated account id, never taken
 *    from page data or a database column that could hold anything;
 *  - HTTP redirects are followed by hand, and only to the same https host —
 *    a redirect elsewhere (another site, an internal address) is returned to
 *    the caller as the 3xx it is, never followed;
 *  - no proxy, a response-size cap and a timeout.
 */

/** NEAR account ids are at most 64 characters. */
const NEAR_ACCOUNT_MAX_LENGTH = 64;

/**
 * Top-level `.near` accounts only, DNS-safe: lowercase letters, digits and
 * single hyphens. Keep in sync with the indexer's
 * `indexer/near/near.constants.ts` — the indexer only writes names that
 * pass this, and this check stops anything else from becoming a hostname.
 */
const NEAR_WEB4_ACCOUNT = /^[\da-z]+(-[\da-z]+)*\.near$/;

/** Same-host redirects followed before giving up (e.g. `/` -> `/index.html`). */
const MAX_SAME_HOST_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function isNearWeb4Account(name: string | undefined | null): boolean {
  return (
    typeof name === 'string' &&
    name.length <= NEAR_ACCOUNT_MAX_LENGTH &&
    NEAR_WEB4_ACCOUNT.test(name)
  );
}

/**
 * Root URL of an account's web4 site on the public gateway
 * (`alice.near` -> `https://alice.near.page/`). Throws for anything that is
 * not an indexable account id.
 */
export function nearWeb4Url(account: string): string {
  if (!isNearWeb4Account(account)) {
    throw new Error(`Not an indexable NEAR web4 account: ${account}`);
  }

  return `https://${account}.page/`;
}

export interface INearWeb4Response {
  status: number;
  headers: Record<string, unknown>;
  body: Buffer;
  /** URL that produced this response (after any same-host redirects). */
  finalUrl: string;
}

/** Case-insensitive header read; axios lower-cases but be defensive. */
export function headerValue(
  headers: Record<string, unknown>,
  name: string,
): string | undefined {
  const hit = Object.keys(headers).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  const value = hit ? headers[hit] : undefined;

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Absolute URL of a redirect target if it stays on the site's own https host,
 * otherwise undefined (off-site, another scheme, a different port, or
 * unparseable).
 */
function sameHostRedirectTarget(
  location: string | undefined,
  currentUrl: string,
  siteHost: string,
): string | undefined {
  if (!location) {
    return undefined;
  }

  try {
    const target = new URL(location, currentUrl);

    return target.protocol === 'https:' && target.host === siteHost
      ? target.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GET the root page of a web4 site. Resolves with whatever the gateway
 * answered — including 4xx/5xx and a redirect that was not followed — so the
 * caller decides what a status means. Rejects on network errors, timeouts and
 * a body larger than `maxBytes`.
 */
export async function fetchNearWeb4Page(
  http: HttpService,
  account: string,
  opts: { timeoutMs: number; maxBytes: number },
): Promise<INearWeb4Response> {
  let url = nearWeb4Url(account);
  const siteHost = new URL(url).host;

  for (let hop = 0; ; hop++) {
    // eslint-disable-next-line no-await-in-loop
    const response = await firstValueFrom(
      http.get<ArrayBuffer>(url, {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'User-Agent': 'Mozilla/5.0 (compatible; Web3CompassBot/1.0)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
        // `false` also disables axios's env-var proxy fallback.
        proxy: false,
        // Redirects are handled below, one hop at a time.
        maxRedirects: 0,
        timeout: opts.timeoutMs,
        responseType: 'arraybuffer',
        maxContentLength: opts.maxBytes,
        // Read the status ourselves rather than throwing on 3xx/4xx/5xx.
        validateStatus: () => true,
      }),
    );

    const result: INearWeb4Response = {
      status: response.status,
      headers: response.headers as Record<string, unknown>,
      body: Buffer.from(response.data),
      finalUrl: url,
    };

    if (!REDIRECT_STATUSES.has(response.status)) {
      return result;
    }

    const next = sameHostRedirectTarget(
      headerValue(result.headers, 'location'),
      url,
      siteHost,
    );

    if (!next || hop >= MAX_SAME_HOST_REDIRECTS) {
      return result;
    }

    url = next;
  }
}
