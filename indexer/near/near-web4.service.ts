import { Injectable } from '@nestjs/common';

import { isIndexableNearAccount, NEAR_WEB4_METHOD } from './near.constants';
import { NearRpcClient } from './near-rpc.client';

/**
 * Runtime errors that mean "this account has no web4 site": no contract
 * deployed, or a contract without a `web4_get` method. Matched on the error
 * text the node returns, e.g.
 * `wasm execution failed with error: MethodResolveError(MethodNotFound)` or
 * `... CompilationError(CodeDoesNotExist { account_id: ... })`.
 */
const NOT_WEB4_ERRORS = ['MethodResolveError', 'CodeDoesNotExist'];

/**
 * Decides whether a NEAR account serves a web4 site, by calling its
 * `web4_get` view method for the root path.
 */
@Injectable()
export class NearWeb4Service {
  constructor(private readonly rpc: NearRpcClient) {}

  /**
   * True when the account's contract has a `web4_get` method. Whether the
   * site actually answers is the scraper's concern (it fetches the page);
   * this only establishes that the account is a web4 site at all.
   *
   * A contract error other than "method missing" (e.g. a panic on our probe
   * request) still proves the method exists, so it counts as web4. Transport
   * failures throw, so the caller leaves the row for the next tick instead of
   * recording a wrong answer.
   */
  async hasWeb4Site(account: string): Promise<boolean> {
    if (!isIndexableNearAccount(account)) {
      return false;
    }

    const result = await this.rpc.viewFunction(account, NEAR_WEB4_METHOD, {
      request: { path: '/' },
    });

    if (result.kind === 'unknown-account') {
      return false;
    }

    if (result.kind === 'contract-error') {
      return !NOT_WEB4_ERRORS.some((marker) => result.message.includes(marker));
    }

    return true;
  }
}
