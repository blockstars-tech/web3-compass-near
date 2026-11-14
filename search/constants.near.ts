/*
 * EXCERPT — NEAR parts only.
 * The NEAR enum values and the web4 cases in the link helpers.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// ns.enum.ts
export enum NsEnum {
  // … ENS, TOMI, UNS, BNB, SNS, TON …
  NEAR = 'NEAR',
  FIO = 'FIO',
}

// domain.enum.ts
export enum DomainEnum {
  // … 90+ other extensions …
  NEAR = '.near',
}

export const domainTypes = {
  // … other naming systems …
  [NsEnum.NEAR]: [DomainEnum.NEAR],
};

// cid-kind.enum.ts
export enum CidKindEnum {
  // … ipfs, ipns, swarm, ton …
  // NEAR web4 site (`near-web4`): addressed by account name, no content CID.
  WEB4 = 'web4',
}

// cid-kind.enum.ts — inside resolveCidKind(), content-type checks:
    // Order matters: ipns must be checked before ipfs (substring overlap).
    if (ct.includes('ipns')) return CidKindEnum.IPNS;
    if (ct.includes('swarm')) return CidKindEnum.SWARM;
    if (ct.includes('ton')) return CidKindEnum.TON;
    if (ct.includes('web4')) return CidKindEnum.WEB4;
    // dnslink resolves to an IPFS CID, so it serves IPFS content.
    if (ct.includes('ipfs') || ct.includes('dnslink')) return CidKindEnum.IPFS;

// gateway.enum.ts — inside buildCidGatewayUrl():
  switch (kind) {
    case CidKindEnum.WEB4:
      // A NEAR web4 site has no content CID (its `cid` column holds the
      // account id), so there is no content-address URL. Without this case it
      // would fall to the IPFS default and produce `ipfs.io/ipfs/<account>`.
      return null;
    // … other kinds …
  }

// The public developer API accepts the same values
// as query filters — ns=NEAR, domains=.near, kind=web4.
// search-meili.dto.ts
  @ApiPropertyOptional({
    enum: ['ipfs', 'ipns', 'swarm', 'ton', 'web4'],
    description:
      'Content-address family, derived from the record contentType and CID ' +
      'shape. Filterable via the `kind` query parameter.',
  })
  kind?: CidKindEnum | null;

// Public developer API — constants/ns.enum.ts
/**
 * Naming services accepted by the `ns` search filter.
 *
 * Kept in sync with the search API, which owns the ns -> TLD mapping
 * (its search.service.ts resolves ENS->.eth, TOMI->.tomi, BNB->.bnb,
 * SNS->.sol, TON->.ton, NEAR->.near). Anything without an explicit branch
 * there — UNS and FIO — falls through to "every TLD except
 * eth/tomi/bnb/sol/ton/near", so FIO currently returns the same results as UNS.
 */
export enum NsEnum {
  ENS = 'ENS',
  TOMI = 'TOMI',
  UNS = 'UNS',
  BNB = 'BNB',
  SNS = 'SNS',
  TON = 'TON',
  NEAR = 'NEAR',
  FIO = 'FIO',
}

// Public developer API — constants/cid-kind.enum.ts
/**
 * UI-facing bucket for "what kind of content address is this".
 *
 * Mirrors `CidKindEnum` in the search API, which is the service that
 * actually derives the value (`resolveCidKind`) and puts it on every hit as
 * `url.kind`. This API only validates the query parameter and compares the
 * result, so the resolution logic is deliberately NOT duplicated here.
 */
export enum CidKindEnum {
  IPFS = 'ipfs',
  IPNS = 'ipns',
  SWARM = 'swarm',
  TON = 'ton',
  // NEAR web4 site: addressed by account name, no content CID.
  WEB4 = 'web4',
}

// The admin API adds the same two values to its own lists:
// NsEnum: NEAR = 'NEAR', and DomainEnum: NEAR = '.near'.
