import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';

import {
  isRetryableRpcError,
  retryAfterMsFromHeaders,
  retryWithExponentialBackoff,
} from '../../providers/retry';
import { TokenBucket } from '../../providers/token-bucket';
import { ApiConfigService } from '../shared/services/api-config.service';
import { NEAR_RPC_REQUEST_TIMEOUT_MS } from './near.constants';

/**
 * Outcome of a contract view call:
 *  - `ok`: the method ran; `bytes` is its raw return value.
 *  - `contract-error`: the node answered, but the call failed inside the
 *    contract runtime (method missing, no code deployed, a panic, ...).
 *  - `unknown-account`: the account does not exist.
 * Transport failures (network, 429, 5xx, malformed answers) are thrown.
 */
export type NearViewResult =
  | { kind: 'ok'; bytes: number[] }
  | { kind: 'contract-error'; message: string }
  | { kind: 'unknown-account' };

interface INearRpcResponse {
  result?: { result?: number[]; error?: string };
  error?: {
    name?: string;
    message?: string;
    data?: unknown;
    cause?: { name?: string };
  };
}

/**
 * NEAR JSON-RPC client for read-only contract view calls (`query` /
 * `call_function`). Throttled by a process-wide token bucket and retried on
 * 429 / 5xx / connection errors, like the TON clients. One request object per
 * HTTP request: public NEAR endpoints reject batches.
 */
@Injectable()
export class NearRpcClient implements OnModuleInit {
  private readonly endpoint: string;

  private readonly apiKey: string;

  private readonly bucket: TokenBucket;

  constructor(
    @InjectPinoLogger(NearRpcClient.name)
    private readonly logger: PinoLogger,
    private readonly config: ApiConfigService,
  ) {
    const cfg = this.config.nearConfig;
    this.endpoint = cfg.rpcUrl;
    this.apiKey = cfg.rpcApiKey;
    this.bucket = new TokenBucket(cfg.rpcRps);
  }

  onModuleInit(): void {
    this.logger.info(
      `NearRpcClient ready (endpoint=${this.endpoint}, auth=${
        this.apiKey ? 'key' : 'anon'
      })`,
    );
  }

  /** Call a contract view method with JSON args at final finality. */
  async viewFunction(
    accountId: string,
    methodName: string,
    args: Record<string, unknown>,
  ): Promise<NearViewResult> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'web3compass',
      method: 'query',
      params: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        request_type: 'call_function',
        finality: 'final',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        account_id: accountId,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        method_name: methodName,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    });

    const json = await this.post(body, `${methodName}@${accountId}`);

    if (json.error) {
      if (json.error.cause?.name === 'UNKNOWN_ACCOUNT') {
        return { kind: 'unknown-account' };
      }

      // Any other RPC-level error (node behind, timeout, bad request) says
      // nothing about the contract — surface it so the caller retries later.
      throw new Error(
        `near rpc ${methodName}@${accountId} -> ${
          json.error.cause?.name ?? json.error.name ?? 'error'
        }: ${String(json.error.data ?? json.error.message ?? '')}`,
      );
    }

    if (typeof json.result?.error === 'string') {
      return { kind: 'contract-error', message: json.result.error };
    }

    if (Array.isArray(json.result?.result)) {
      return { kind: 'ok', bytes: json.result.result };
    }

    throw new Error(
      `near rpc ${methodName}@${accountId} -> unrecognised response`,
    );
  }

  private async post(body: string, label: string): Promise<INearRpcResponse> {
    return retryWithExponentialBackoff(
      async () => {
        await this.bucket.acquire();

        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          NEAR_RPC_REQUEST_TIMEOUT_MS,
        );

        try {
          const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Content-Type': 'application/json',
              ...(this.apiKey
                ? { Authorization: `Bearer ${this.apiKey}` }
                : {}),
            },
            body,
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = new Error(
              `near rpc ${label} -> ${res.status} ${res.statusText}`,
            ) as Error & { status?: number; retryAfterMs?: number };
            err.status = res.status;
            const retryAfterMs = retryAfterMsFromHeaders(res.headers);

            if (retryAfterMs !== null) {
              err.retryAfterMs = retryAfterMs;
            }

            throw err;
          }

          return (await res.json()) as INearRpcResponse;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        shouldRetry: isRetryableRpcError,
        onRetry: (error, attempt, delayMs) =>
          this.logger.warn(
            `near rpc ${label} retry #${attempt} in ${delayMs}ms: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
      },
    );
  }
}
