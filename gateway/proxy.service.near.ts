/*
 * EXCERPT — NEAR parts only.
 * The .near branch of the request handler and the web4 routing method.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

import {
  GatewayKey,
  NEAR_WEB4_ACCOUNT,
  SUPPORTED_CODECS,
} from '../../constants/supported-codecs';

@Injectable()
export class ProxyService {
  // inside the request handler, after the domain was looked up and its
  // content type mapped to a route (see supported-codecs.near.ts):

  // … (non-NEAR code omitted) …

      // NEAR web4 sites: addressed by account name, not by a CID path.
      if (route.gateway === 'web4') {
        this.routeToWeb4(req, res, { domainName, cid, codec, requestPath });
        return;
      }

  // … (non-NEAR code omitted) …

  /**
   * Serve a `.near` web4 site. The site lives at https://<account>.near.page
   * (the public web4 gateway), so there is no CID path: we hand Caddy that
   * host and the visitor's own path, and its existing TLS second hop
   * (`@proxy_tls` in the Caddyfile — the one Swarm uses) fetches the page.
   *
   * Only plain page loads are proxied. Anything that is not GET/HEAD, and
   * everything under /web4/ (the gateway's wallet sign-in and transaction
   * endpoints), is redirected to near.page instead: those flows set wallet
   * keys in cookies, and they must land on near.page's origin, never on ours.
   * WEB4_GATEWAY_MODE=redirect sends every request that way.
   */
  private routeToWeb4(
    req: Request,
    res: Response,
    site: {
      domainName: string;
      cid: string;
      codec: string;
      requestPath: string;
    },
  ): void {
    const { domainName, cid, codec, requestPath } = site;

    // The name becomes the host Caddy dials, so accept nothing but a plain
    // top-level account — never a value that could point somewhere else.
    if (!NEAR_WEB4_ACCOUNT.test(domainName)) {
      this.errorsService.contentNotFound(res, domainName);
      return;
    }

    const upstreamHost = `${domainName}.page`;
    const isPageLoad = req.method === 'GET' || req.method === 'HEAD';
    const isWalletPath =
      requestPath === '/web4' || requestPath.startsWith('/web4/');

    if (
      this.configService.web4GatewayMode === 'redirect' ||
      !isPageLoad ||
      isWalletPath
    ) {
      const queryStart = req.originalUrl.indexOf('?');
      const query = queryStart >= 0 ? req.originalUrl.slice(queryStart) : '';

      // 307 keeps the method and body for non-GET requests.
      res.redirect(
        isPageLoad ? 302 : 307,
        `https://${upstreamHost}${requestPath}${query}`,
      );
      return;
    }

    res.writeHead(200, {
      'X-Content-Location': upstreamHost,
      'X-Content-Path': requestPath,
      'X-Content-Tls': 'true',
      'X-Content-Storage-Type': codec,
      'X-Id-Name': domainName,
      'X-Id-Cid': cid,
    });

    res.end();
  }

  // … (non-NEAR code omitted) …

}
