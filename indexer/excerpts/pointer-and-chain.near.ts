/*
 * EXCERPT — NEAR parts only.
 * The NEAR enum values and the content-type -> pointer-kind mapping.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// chain.enum.ts
export enum ChainEnum {
  ETH = 'ethereum',
  POLYGON = 'polygon',
  BSC = 'bsc',
  SOLANA = 'solana',
  TON = 'ton',
  NEAR = 'near',
}

// Backs the Postgres enum `ens_resolvers_type_enum`. NEAR is deliberately not
// listed: no NEAR code writes resolver rows, and `dns.main` for NEAR comes
// from NEAR_MAIN (modules/near/near.constants.ts).
export enum DnsTypeEnum {
  // … ens, tomi, uns … (NEAR deliberately not listed)
}

// content-pointer.entity.ts
export enum PointerKind {
  // … ipns, swarm_feed, dnslink, ton_dns_http …
  NEAR_WEB4 = 'near_web4',
}

// content-pointer.service.ts — inside pointerKindFromContentType()
  // NEAR web4 sites (`near-web4`): the account is a stable pointer, the page
  // it serves mutates — same shape as a TON site.
  if (t.includes('web4')) {
    return PointerKind.NEAR_WEB4;
  }
