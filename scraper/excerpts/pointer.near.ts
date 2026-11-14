/*
 * EXCERPT — NEAR parts only.
 * The NEAR pointer/anchor kinds and how the resolver and ingester are registered.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// content-pointer.entity.ts
export enum PointerKind {
  // … ipns, swarm_feed, dnslink, ton_dns_http …
  NEAR_WEB4 = 'near_web4',
}

export enum AnchorKind {
  // … ipfs_cid, swarm_bzz, http_url, ton_site …
  // NEAR web4 site. Anchor is a content fingerprint, as for TON_SITE.
  WEB4_SITE = 'web4_site',
}

// pointer.module.ts — imports
import { NearWeb4Ingester } from './ingesters/near-web4.ingester';
import { NearWeb4Resolver } from './resolvers/near-web4.resolver';

// pointer.module.ts — providers
  providers: [
    // … the other resolvers …
    TonDnsResolver,
    NearWeb4Resolver,
    // … the other ingesters …
    TonHttpIngester,
    NearWeb4Ingester,
    // … jobs …
    {
      provide: POINTER_RESOLVERS,
      useFactory: (
        ipns: IpnsResolver,
        dnslink: DnslinkResolver,
        swarm: SwarmFeedResolver,
        ton: TonDnsResolver,
        nearWeb4: NearWeb4Resolver,
      ): PointerResolver[] => [ipns, dnslink, swarm, ton, nearWeb4],
      inject: [
        IpnsResolver,
        DnslinkResolver,
        SwarmFeedResolver,
        TonDnsResolver,
        NearWeb4Resolver,
      ],
    },
    {
      provide: CONTENT_INGESTERS,
      useFactory: (
        ipfs: IpfsIngester,
        swarm: SwarmIngester,
        ton: TonHttpIngester,
        nearWeb4: NearWeb4Ingester,
      ): ContentIngester[] => [ipfs, swarm, ton, nearWeb4],
      inject: [IpfsIngester, SwarmIngester, TonHttpIngester, NearWeb4Ingester],
    },
