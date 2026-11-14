/*
 * EXCERPT — NEAR parts only.
 * The gateway's NEAR enum values and the error-page hint that lists .near.
 * The rest of each file is unrelated to NEAR and is left out.
 */

// constants/chain.enum.ts
export enum ChainEnum {
  ETH = "ethereum",
  POLYGON = "polygon",
  SOLANA = "solana",
  TON = "ton",
  NEAR = "near",
}

// constants/domain.enum.ts
export enum DomainEnum {
  // … 90+ other extensions …
  NEAR = '.near',
}

// constants/error-page.constants.ts — the "Unsupported Domain Extension" page
  [ErrorPageKind.UNSUPPORTED_TLD]: {
    // …
    title: 'Unsupported Domain Extension',
    // …
    hints: [
      'Supported extensions include .eth, .crypto, .nft, .ton, .sol, .bnb, .near and more',
      // …
    ],
  },
