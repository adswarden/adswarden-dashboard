import 'server-only';

/**
 * Structured error for extension serve / ad-block flows.
 * Route handlers catch this and return `error.body` with HTTP `error.status`.
 */
export class ExtensionAdBlockError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(body: Record<string, unknown>, status: number) {
    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : 'Extension ad block';
    super(message);
    this.name = 'ExtensionAdBlockError';
    this.body = body;
    this.status = status;
  }
}
