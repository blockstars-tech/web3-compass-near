import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEAR web4 support.
 *  - extends the chain enums (dns, dns_migrations) with 'near'
 *  - adds the queue index for NearWeb4RefreshJob
 *
 * Unlike AddSnsSupport / AddTonSupport, the enums are extended with
 * `ALTER TYPE ... ADD VALUE` instead of the rename-and-recreate pattern:
 * recreating `dns_chain_enum` rewrites the whole dns table under
 * an exclusive lock at startup, while ADD VALUE is a catalog-only change.
 * Requires PostgreSQL 12+ (ADD VALUE inside a transaction block).
 *
 * The catch with ADD VALUE is that the new value cannot be USED in the same
 * transaction, and all pending migrations run in one. Nothing below uses it:
 * the index predicate is on the varchar `main` column, not on `chain`.
 *
 * IF NOT EXISTS on the index because prod should get it ahead of time, as for
 * AddJobQueueIndexes1784851200000 — a plain CREATE INDEX here locks writes on
 * dns for the build duration:
 *
 *   CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_dns_near_refresh_queue"
 *     ON "dns" ("records_refreshed_at" ASC NULLS FIRST) WHERE "main" = 'near';
 *
 * The other enum-backed columns are left alone on purpose: no NEAR job keeps a
 * dns_migrations cursor type or writes ens_resolvers rows.
 */
export class AddNearSupport1794528000000 implements MigrationInterface {
  name = 'AddNearSupport1794528000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "public"."dns_chain_enum" ADD VALUE IF NOT EXISTS \'near\'',
    );
    // Same ChainEnum backs dns_migrations.chain; keep the two in step so the
    // entity metadata and the database agree.
    await queryRunner.query(
      'ALTER TYPE "public"."dns_migrations_chain_enum" ADD VALUE IF NOT EXISTS \'near\'',
    );

    // NearWeb4RefreshJob: NULLS FIRST matches the queue's ORDER BY
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_dns_near_refresh_queue" ON "dns" ("records_refreshed_at" ASC NULLS FIRST) WHERE "main" = \'near\'',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_dns_near_refresh_queue"',
    );

    // The enum value can only be removed once no row uses it. urls and
    // content_pointer rows go with their dns row (ON DELETE CASCADE).
    await queryRunner.query('DELETE FROM "dns" WHERE "main" = \'near\'');
    await queryRunner.query(
      'DELETE FROM "dns_migrations" WHERE "chain"::"text" = \'near\'',
    );

    // Postgres cannot drop an enum value, so recreate both types without
    // 'near'. The list keeps 'ton' — do not copy AddTonSupport's down(), which
    // drops it.

    // dns_migrations.chain enum -> drop 'near'
    await queryRunner.query(
      "CREATE TYPE \"public\".\"dns_migrations_chain_enum_old\" AS ENUM('ethereum', 'polygon', 'bsc', 'solana', 'ton')",
    );
    await queryRunner.query(
      'ALTER TABLE "dns_migrations" ALTER COLUMN "chain" DROP DEFAULT',
    );
    await queryRunner.query(
      'ALTER TABLE "dns_migrations" ALTER COLUMN "chain" TYPE "public"."dns_migrations_chain_enum_old" USING "chain"::"text"::"public"."dns_migrations_chain_enum_old"',
    );
    await queryRunner.query(
      'ALTER TABLE "dns_migrations" ALTER COLUMN "chain" SET DEFAULT \'ethereum\'',
    );
    await queryRunner.query('DROP TYPE "public"."dns_migrations_chain_enum"');
    await queryRunner.query(
      'ALTER TYPE "public"."dns_migrations_chain_enum_old" RENAME TO "dns_migrations_chain_enum"',
    );

    // dns.chain enum -> drop 'near'
    //
    // IDX_dns_ton_refresh_queue (AddJobQueueIndexes1784851200000) has the
    // predicate `chain = 'ton'::dns_chain_enum`. Postgres refuses to change the
    // column's type while an index compares it to a constant of the old type
    // ("operator does not exist: dns_chain_enum_old = dns_chain_enum"), so the
    // index is dropped for the swap and recreated right after.
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_dns_ton_refresh_queue"');
    await queryRunner.query(
      "CREATE TYPE \"public\".\"dns_chain_enum_old\" AS ENUM('ethereum', 'polygon', 'bsc', 'solana', 'ton')",
    );
    await queryRunner.query(
      'ALTER TABLE "dns" ALTER COLUMN "chain" DROP DEFAULT',
    );
    await queryRunner.query(
      'ALTER TABLE "dns" ALTER COLUMN "chain" TYPE "public"."dns_chain_enum_old" USING "chain"::"text"::"public"."dns_chain_enum_old"',
    );
    await queryRunner.query(
      'ALTER TABLE "dns" ALTER COLUMN "chain" SET DEFAULT \'ethereum\'',
    );
    await queryRunner.query('DROP TYPE "public"."dns_chain_enum"');
    await queryRunner.query(
      'ALTER TYPE "public"."dns_chain_enum_old" RENAME TO "dns_chain_enum"',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_dns_ton_refresh_queue" ON "dns" ("records_refreshed_at" ASC NULLS FIRST) WHERE "chain" = \'ton\'',
    );
  }
}
