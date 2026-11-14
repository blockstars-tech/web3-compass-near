import { Module } from '@nestjs/common';

import { NearRpcClient } from './near-rpc.client';
import { NearWeb4Service } from './near-web4.service';

/**
 * NEAR web4 module: RPC view-call client + the web4 probe. `ApiConfigService`
 * comes from the @Global SharedModule. The job that consumes
 * `NearWeb4Service` lives in `indexer/jobs/` and is registered in
 * DnsModule (which imports this module), mirroring the TON layout.
 */
@Module({
  providers: [NearRpcClient, NearWeb4Service],
  exports: [NearWeb4Service],
})
export class NearModule {}
