// The model answered, but not in a usable shape. `status` is what the HTTP layer will answer (T06).
export class InvalidOutputError extends Error {
  readonly status = 422;

  constructor(
    message: string,
    readonly text: string, // the raw answer, kept to show it and to feed it back on a retry
  ) {
    super(message);
  }
}
