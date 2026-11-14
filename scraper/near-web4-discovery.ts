import { isNearWeb4Account } from './near-web4-fetch';

/**
 * Finding more NEAR web4 sites. NEAR has no registry of them, so beyond the
 * seed list the only signal is the web itself: a web4 site that links to
 * `https://<account>.near.page` is pointing at another one.
 *
 * What comes out of here is only ever a CANDIDATE NAME. Nothing in this file
 * fetches anything, and a name found on a page is not trusted: it is stored
 * as a skeleton row, the indexer (NearWeb4RefreshJob) asks
 * the chain whether that account really has a `web4_get` method, and only then
 * does it become a site that is fetched — from the fixed near.page host, never
 * from the link that mentioned it.
 */

/** Public web4 gateway host suffix: `<account>.near.page`. */
const WEB4_GATEWAY_SUFFIX = '.page';

/**
 * Upper bound on links looked at per page, so a page with a huge number of
 * anchors costs a bounded amount of work.
 */
const MAX_LINKS_SCANNED = 5000;

/**
 * The NEAR account a link points at, if it is a link to a web4 site on the
 * public gateway (`https://alice.near.page/...` -> `alice.near`). Undefined for
 * anything else: other hosts, sub-accounts, names that are not valid
 * top-level accounts, non-http(s) schemes, unparseable hrefs.
 */
export function nearWeb4AccountFromLink(
  href: string | null | undefined,
  pageUrl: string,
): string | undefined {
  if (!href) {
    return undefined;
  }

  let target: URL;

  try {
    target = new URL(href, pageUrl);
  } catch {
    return undefined;
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return undefined;
  }

  // URL lower-cases the hostname. A port, or credentials in the URL, mean it
  // is not a plain gateway link.
  if (target.port || target.username || target.password) {
    return undefined;
  }

  const host = target.hostname;

  if (!host.endsWith(WEB4_GATEWAY_SUFFIX)) {
    return undefined;
  }

  const account = host.slice(0, -WEB4_GATEWAY_SUFFIX.length);

  // The same check that guards every web4 fetch: one label + `.near`,
  // lowercase letters / digits / single hyphens.
  return isNearWeb4Account(account) ? account : undefined;
}

/**
 * Distinct NEAR accounts that a page links to as web4 sites, in document
 * order, at most `max`. `exclude` is the page's own account.
 */
export function extractNearWeb4Accounts(
  document: Document,
  pageUrl: string,
  opts: { exclude?: string; max: number },
): string[] {
  const found = new Set<string>();

  if (opts.max <= 0) {
    return [];
  }

  const anchors = [...document.querySelectorAll('a[href]')].slice(
    0,
    MAX_LINKS_SCANNED,
  );

  for (const anchor of anchors) {
    const account = nearWeb4AccountFromLink(
      anchor.getAttribute('href'),
      pageUrl,
    );

    if (account && account !== opts.exclude) {
      found.add(account);

      if (found.size >= opts.max) {
        break;
      }
    }
  }

  return [...found];
}
