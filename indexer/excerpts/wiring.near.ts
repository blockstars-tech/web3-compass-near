/*
 * EXCERPT — NEAR parts only.
 * How the NEAR module and the refresh job are registered in the indexer.
 * The rest of each file is unrelated to NEAR and is left out, so this file does
 * not compile on its own; it shows exactly the NEAR code as it runs in production.
 */

// app.module.ts
import { NearModule } from './modules/near/near.module';
@Module({
  imports: [
    // … ConfigModule, SharedModule, DnsModule …
    TonModule,
    NearModule,
    // … TypeORM, schedule, logger …
  ],
})

// modules/dns/dns.module.ts
import { NearModule } from '../near/near.module';
import { NearWeb4RefreshJob } from './jobs/near-web4-refresh.job';
@Module({
  imports: [
    // … TypeORM repositories …
    PointerModule,
    TonModule,
    NearModule,
  ],
  providers: [
    // … the other chains' jobs …
    TonRegisterJob,
    NearWeb4RefreshJob,
  ],
})

// modules/dns/dns.repository.ts
import { NEAR_MAIN } from '../near/near.constants';
