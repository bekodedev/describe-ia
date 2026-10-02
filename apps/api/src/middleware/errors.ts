import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ErrorResponse } from '@describe-ia/shared';
import { InvalidOutputError } from '../generation/errors.js';
import { HttpError, NotFoundError } from '../http-errors.js';
import { LlmRateLimitError, LlmTimeoutError } from '../llm/errors.js';

type Mapped = Pick<ErrorResponse['error'], 'code' | 'message' | 'details'> & {
  status: number;
  retryAfter?: number;
};

// Decides what the client is told. Anything not listed here is a bug on our side: a generic
// 500, never the original message (it could mention queries, file paths or provider details).
function toResponse(error: unknown): Mapped {
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return { status: 400, code: 'validation_error', message: 'Invalid request', details };
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return { status: 400, code: 'invalid_json', message: 'The request body is not valid JSON' };
  }
  if (error instanceof HttpError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      retryAfter: error.retryAfterSeconds,
    };
  }
  if (error instanceof LlmRateLimitError) {
    return {
      status: 503,
      code: 'llm_rate_limited',
      message: 'The AI service is busy. Try again in a moment.',
      retryAfter: error.retryAfterSeconds ?? 30,
    };
  }
  if (error instanceof InvalidOutputError) {
    return {
      status: error.status,
      code: 'invalid_model_output',
      message: 'The AI service returned an unusable answer. Try again.',
    };
  }
  if (error instanceof LlmTimeoutError) {
    return {
      status: 504,
      code: 'llm_timeout',
      message: 'The AI service took too long. Try again.',
    };
  }
  return { status: 500, code: 'internal_error', message: 'Something went wrong' };
}

export const notFound: RequestHandler = () => {
  throw new NotFoundError('Route not found');
};

// Express recognises an error handler by its 4 parameters.
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const { status, retryAfter, ...body } = toResponse(error);
  const detail =
    body.details?.map((d) => `${d.path}: ${d.message}`).join('; ') ??
    (error instanceof Error ? error.message : String(error));
  console.error(
    `[${req.id}] ${req.method} ${req.originalUrl} -> ${status} ${body.code}: ${detail}`,
  );
  if (status === 500 && error instanceof Error) console.error(error.stack);

  if (retryAfter) res.setHeader('Retry-After', String(retryAfter));
  res.status(status).json({ error: { ...body, requestId: req.id } } satisfies ErrorResponse);
};
