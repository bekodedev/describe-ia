// What went wrong when talking to the provider. Callers branch on the class, not on status codes.
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 429 that kept coming back after every attempt. */
export class LlmRateLimitError extends LlmError {
  constructor(
    message: string,
    status?: number,
    readonly retryAfterSeconds?: number, // from the provider's retry-after header, if it sent one
  ) {
    super(message, status);
  }
}

/** The request did not finish within the configured timeout. */
export class LlmTimeoutError extends LlmError {}

/** 4xx other than 429: our request is wrong (bad body, bad key, unknown model). Never retried. */
export class LlmBadRequestError extends LlmError {}

/** 5xx / 529, a network failure or an unreadable response. */
export class LlmUpstreamError extends LlmError {}
