/**
 * Realtime Logger SDK
 * 
 * Usage:
 * import { Logger } from './sdk';
 * 
 * const logger = new Logger({
 *   endpoint: "https://your-logging-platform.com/v1/logs",
 *   project: "arivulabs",
 *   service: "api"
 * });
 * 
 * logger.info("request.completed", { requestId: "123", latencyMs: 42 });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  endpoint: string;
  project: string;
  service: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export class Logger {
  private queue: any[] = [];
  private timer: any = null;

  constructor(private options: LoggerOptions) {
    this.options.flushIntervalMs = options.flushIntervalMs || 2000;
    this.options.maxBatchSize = options.maxBatchSize || 100;
  }

  private log(level: LogLevel, event: string, message: string, metadata?: any) {
    const payload = {
      project: this.options.project,
      service: this.options.service,
      level,
      event,
      message,
      timestamp: new Date().toISOString(),
      request_id: metadata?.requestId,
      trace_id: metadata?.traceId,
      metadata
    };

    // Note: The /v1/logs endpoint currently expects a single log object in the demo,
    // but in a real batching scenario we'd send an array. For this MVP, we send individually async.
    this.send(payload);
  }

  private send(payload: any) {
    // Fire and forget
    fetch(this.options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Ignore errors so we don't crash the main app
    });
  }

  debug(event: string, message: string, metadata?: any) { this.log('debug', event, message, metadata); }
  info(event: string, message: string, metadata?: any) { this.log('info', event, message, metadata); }
  warn(event: string, message: string, metadata?: any) { this.log('warn', event, message, metadata); }
  error(event: string, message: string, metadata?: any) { this.log('error', event, message, metadata); }
}
