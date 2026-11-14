/*
 * EXCERPT — NEAR parts only.
 * NEAR is a naming system on the site: a scope button in the search bar
 * (`?ns=NEAR`), a badge on each .near result, a dial tick on the index visual,
 * and an entry on the Statistics and About pages. Every line below is the NEAR
 * line in its file; the rest of each file is left out.
 */

// naming.js — the naming systems the scope bar and result badges know.
export const SYSTEMS = [
  // … ENS, UNS, TON, SNS, BNB, TOMI …
  // Added in this repo (not in the designers' source): `.near` accounts that
  // serve a web4 site. Last, as the smallest share of the index.
  { id: 'NEAR', label: 'NEAR', name: 'NEAR names', hue: 'near' },
];

// naming.js — label for a result's chain …
export const CHAINS = {
  // … ethereum, polygon, solana, ton, bsc, binance …
  near: 'NEAR',
};

// naming.js — … and for its content network (the API's `kind` field).
export const NETWORKS = {
  // … ipfs, ipns, swarm, ton …
  web4: 'Web4',
};

// data/records.js — colour of NEAR dots in the 3D index visual.
export const SYSTEM_COLOR = {
  // … other systems …
  NEAR: 0x5fa33a,
};

// views/field.js — order of systems in every index visual.
const GROUP_ORDER = ['UNS', 'ENS', 'TON', 'SNS', 'BNB', 'TOMI', 'NEAR'];

// pages/statistics.js — the NEAR entry in the Statistics page's system list.
const SYSTEMS = [
  // … other systems …
  [
    'NEAR',
    html`NEAR accounts use the <b>.near</b> extension and serve their websites on-chain through web4.`,
  ],
];

// pages/about.js — the About page's Coverage list.
const SYSTEMS = ['ENS', 'UNS', 'TON', 'SNS', 'BNB', 'TOMI', 'NEAR', 'FIO'];

// pages/about.js — the Coverage sentence on the About page.
            <p>Web3 Compass supports 93+ blockchain domain extensions across leading decentralized naming systems, including ENS, UNS, TON, Solana (SNS), BNB, TOMI, NEAR, and FIO. Our search index is continuously expanding.</p>
