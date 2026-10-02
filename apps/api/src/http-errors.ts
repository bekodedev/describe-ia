// Errors the routes and middleware throw on purpose; the error middleware turns them into responses.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}

export class RateLimitedError extends HttpError {
  constructor(retryAfterSeconds: number) {
    super(429, 'rate_limited', 'Too many requests. Try again later.', retryAfterSeconds);
  }
}
