/*
 * EXCERPT — NEAR parts only.
 * The capped insert of link-discovered candidate names.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// dns.service.ts
@Injectable()
export class DnsService {

  // … (non-NEAR code omitted) …

  /**
   * Store NEAR web4 candidates found by link discovery, within a budget.
   *
   * `maxWithoutSite` caps how many NEAR rows may exist that are not a web4
   * site (waiting to be checked, or checked and rejected). Names come from
   * pages we do not control, so without a cap a page could keep feeding us
   * made-up names forever; with it, discovery simply stops adding once the
   * pile of unconfirmed names is that large. Real sites leave the pile when
   * the indexer confirms them, so they never use the budget up.
   *
   * Returns the names actually inserted.
   */
  async addNearWeb4Candidates(
    names: string[],
    maxWithoutSite: number,
  ): Promise<string[]> {
    if (names.length === 0) {
      return [];
    }

    const withoutSite = await this.dnsRepository.countNearRowsWithoutSite();
    const room = maxWithoutSite - withoutSite;

    if (room <= 0) {
      this.logger.warn(
        `NEAR web4 discovery paused: ${withoutSite} unconfirmed .near names (cap ${maxWithoutSite})`,
      );

      return [];
    }

    return this.dnsRepository.insertNearCandidates(names.slice(0, room));
  }

  // … (non-NEAR code omitted) …

}

// dns.repository.ts
@CustomRepository(DnsEntity)
export class DnsRepository extends Repository<DnsEntity> {

  // … (non-NEAR code omitted) …

  /**
   * NEAR rows that are not a web4 site: candidates still waiting for the
   * indexer's on-chain check, plus names it checked and rejected. Used as the
   * budget for link discovery. Served by IDX_dns_near_refresh_queue
   * (`WHERE main = 'near'`).
   */
  async countNearRowsWithoutSite(): Promise<number> {
    const rows: Array<{ count: string }> = await this.query(
      `SELECT count(*) AS count FROM dns WHERE main = 'near' AND cid IS NULL`,
    );

    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Insert skeleton rows for NEAR web4 candidates found by link discovery.
   * ON CONFLICT DO NOTHING on the unique `name`, so an existing row is never
   * touched. New rows have `records_refreshed_at = NULL`, which queues them for
   * the indexer's NearWeb4RefreshJob; they have no cid and no content
   * type, so nothing in the scraper picks them up until that job has verified
   * them on-chain. Returns the names actually inserted.
   *
   * Raw SQL, like the indexer's own skeleton inserts: the scraper's ChainEnum
   * does not list every chain the database has.
   */
  async insertNearCandidates(names: string[]): Promise<string[]> {
    if (names.length === 0) {
      return [];
    }

    const rows: Array<{ name: string }> = await this.query(
      `INSERT INTO dns (id, name, chain, main, address, created_at, updated_at)
       SELECT uuid_generate_v4(), n, 'near', 'near', n, now(), now()
       FROM unnest($1::text[]) AS n
       ON CONFLICT (name) DO NOTHING
       RETURNING name`,
      [names],
    );

    return rows.map((row) => row.name);
  }
}
