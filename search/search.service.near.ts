/*
 * EXCERPT — NEAR parts only.
 * The ns=NEAR filter and how result links are built for .near sites.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// 1) Naming-system filter: ns=NEAR -> only .near domains; and .near is
//    excluded from the catch-all (UNS/FIO) branch.
    const domains = (
      searchPageOptionDto.ns
        ? searchPageOptionDto.ns === NsEnum.BNB
          ? [DomainEnum.BNB]
          : searchPageOptionDto.ns === NsEnum.ENS
          ? [DomainEnum.ETH]
          : searchPageOptionDto.ns === NsEnum.TOMI
          ? [DomainEnum.TOMI]
          : searchPageOptionDto.ns === NsEnum.SNS
          ? [DomainEnum.SOL]
          : searchPageOptionDto.ns === NsEnum.TON
          ? [DomainEnum.TON]
          : searchPageOptionDto.ns === NsEnum.NEAR
          ? [DomainEnum.NEAR]
          : Object.values(DomainEnum).filter(
              (elem) =>
                elem !== DomainEnum.ETH &&
                elem !== DomainEnum.TOMI &&
                elem !== DomainEnum.BNB &&
                elem !== DomainEnum.SOL &&
                elem !== DomainEnum.TON &&
                elem !== DomainEnum.NEAR,
            )
        : typeof searchPageOptionDto.domains === 'string'
        ? [searchPageOptionDto.domains]
        : searchPageOptionDto.domains
    )?.map((elem) => elem.replace('.', ''));

  // … (non-NEAR code omitted) …

// 2) Result links: a web4 site has no content CID, so it gets only the
//    dweb3.wtf subdomain link (https://<account>.near.dweb3.wtf).
      // subdomain's `*.*.dweb3.wtf` link can't resolve — we hand the frontend a
      // CID-based gateway URL instead. Plain 2-label names are unaffected.
      const isSubdomain = (domainName?.split('.').length ?? 0) > 2;

      // TON ADNL sites: cid is an ADNL hash (not an IPFS CID) and they're served
      // through the dweb3 subdomain gateway, so the IPFS gateway link is invalid.
      const isTon = !!domainName?.endsWith(DomainEnum.TON);
      const isTonAdnl = !!contentType?.toLowerCase().includes('adnl');

      // NEAR web4 sites: cid is the account id (not a content CID) and they're
      // served through the dweb3 subdomain gateway, so — as for TON ADNL —
      // neither the CID gateway URL nor the ipfs.io link is valid.
      const isWeb4 = !!contentType?.toLowerCase().includes('web4');

      // extractRefAndSubPath normalises both stored gateway shapes into
      // {rootCid, subPath}. We split them so each gateway gets the right form:
      //   - CID-based (ipfs.io, dweb3.wtf):   /ipfs/{rootCid}/{subPath}
      //   - Subdomain-based (eth.limo, dweb3 subdomain): {subPath}
      // Without {subPath} the subdomain forms bounce back to the homepage.
      const { rootRef: urlRootCid, subPath } = this.extractRefAndSubPath(
        elem.url?.url,
        cid,
      );
      const cidGatewayPath = urlRootCid
        ? `/ipfs/${urlRootCid}${subPath}`
        : null;

      const ethLimoBase = domainName ? buildEthLimoUrl(domainName) : null;
      const dweb3SubdomainBase = domainName
        ? buildDweb3GatewayUrl(domainName)
        : null;

      // CID/content-address URL, per codec — the primary (and only resolvable)
      // link for subdomains. Skipped for TON ADNL and NEAR web4, which have no
      // content CID.
      const kind = resolveCidKind(contentType, urlRootCid ?? cid, domainName);
      const hasNoContentCid = isTonAdnl || isWeb4;
      const cidGatewayUrl = hasNoContentCid
        ? null
        : buildCidGatewayUrl(
            kind,
            urlRootCid,
            subPath,
            this.searchGatewayBases,
          );

      const gatewayUrls = (
        isSubdomain
          ? // Subdomains point straight at the content provider. Neither the
            // one-level `*.dweb3.wtf` wildcard nor eth.limo (which we don't use)
            // resolves a 3-label name — this includes ENS `.eth` subdomains.
            [cidGatewayUrl]
          : [
              ethLimoBase ? `${ethLimoBase}${subPath}` : null,
              !isTon && !isWeb4 && cidGatewayPath
                ? `${CidGatewayEnum.IPFS_IO}${cidGatewayPath}`
                : null,
              dweb3SubdomainBase ? `${dweb3SubdomainBase}${subPath}` : null,
            ]
      ).filter(Boolean);
