/*
 * EXCERPT — NEAR parts only.
 * The only NEAR setting: proxy or redirect.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

@Injectable()
export class ApiConfigService {

  // … (non-NEAR code omitted) …

  // How `.near` web4 sites are served:
  //  - 'proxy' (default): Caddy fetches the page from <account>.near.page and
  //    serves it under our own domain.
  //  - 'redirect': every request is sent on to <account>.near.page. The
  //    fallback if the web4 gateway (it sits behind Cloudflare) starts
  //    challenging requests coming from our server.
  // Optional key; anything other than 'redirect' means 'proxy'.
  get web4GatewayMode(): 'proxy' | 'redirect' {
    return this.getString('WEB4_GATEWAY_MODE', 'proxy').trim().toLowerCase() ===
      'redirect'
      ? 'redirect'
      : 'proxy';
  }

  // … (non-NEAR code omitted) …

}
