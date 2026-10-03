import { ApiError } from './api';

// What the user reads. The API's own messages are written for developers, except for the
// validation ones (bad photo, bad field), which are plain enough to show as they are.
export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';

  switch (error.status) {
    case 0:
      return 'Cannot reach the server. Check your connection and try again.';
    case 429:
    case 503:
      return 'Too many requests, wait a few seconds and try again.';
    case 422:
      return 'The model returned an invalid format, please retry.';
    case 504:
      return 'The AI service took too long to answer. Please try again.';
    case 404:
      return 'We could not find that. It may have been removed.';
    case 400:
      return error.message;
    default:
      return `Something went wrong. Please try again.${error.requestId ? ` (reference ${error.requestId.slice(0, 8)})` : ''}`;
  }
}
