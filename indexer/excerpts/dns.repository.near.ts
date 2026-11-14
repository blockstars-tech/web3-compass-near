/*
 * EXCERPT — NEAR parts only.
 * The two queue queries used by NearWeb4RefreshJob.
 * The rest of the file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

@CustomRepository(DnsEntity)
export class DnsRepository extends Repository<DnsEntity> {

  // … (non-NEAR code omitted) …

  /**
   * Insert skeleton rows for NEAR web4 candidates (the seed list). ON CONFLICT
   * DO NOTHING on the unique `name`, so an existing row — already probed, or
   * owned by anything else — is never touched. New rows have
   * `records_refreshed_at = NULL`, which queues them for NearWeb4RefreshJob.
   */
  async insertNearCandidates(names: readonly string[]): Promise<void> {
    if (names.length === 0) {
      return;
    }

    await this.createQueryBuilder()
      .insert()
      .into(DnsEntity)
      .values(
        names.map((name) => ({
          name,
          chain: ChainEnum.NEAR,
          main: NEAR_MAIN,
          address: name,
        })),
      )
      .orIgnore()
      .execute();
  }

  /**
   * Batch of NEAR accounts due for a web4 check: never checked
   * (`records_refreshed_at IS NULL`) or older than the TTL. NULLs first so new
   * candidates drain ahead of re-checks. Keyed on the varchar `main` to match
   * the partial index IDX_dns_near_refresh_queue.
   */
  async findNearDomainsForRefresh(
    limit: number,
    ttlDays: number,
  ): Promise<DnsEntity[]> {
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

    return this.createQueryBuilder('dns')
      .where('dns.main = :main', { main: NEAR_MAIN })
      .andWhere(
        '(dns.records_refreshed_at IS NULL OR dns.records_refreshed_at < :cutoff)',
        { cutoff },
      )
      .orderBy('dns.records_refreshed_at', 'ASC', 'NULLS FIRST')
      .limit(limit)
      .getMany();
  }

  // … (non-NEAR code omitted) …

}
