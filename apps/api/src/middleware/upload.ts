import { IMAGE_TYPES } from '@describe-ia/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../http-errors.js';

// Reads an optional `image` file of a multipart request into memory (req.file). JSON requests
// pass through untouched. The declared type is only a first filter; the bytes are checked later.
export function uploadImage(maxBytes: number): RequestHandler {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10 },
    fileFilter: (_req, file, accept) => {
      if ((IMAGE_TYPES as readonly string[]).includes(file.mimetype)) return accept(null, true);
      accept(new HttpError(400, 'invalid_image', 'Only JPEG, PNG and WebP images are accepted'));
    },
  }).single('image');

  return (req, res, next) => parse(req, res, (error) => next(toHttpError(error, maxBytes)));
}

function toHttpError(error: unknown, maxBytes: number): unknown {
  if (!(error instanceof multer.MulterError)) return error;
  const messages: Record<string, string> = {
    LIMIT_FILE_SIZE: `The image is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`,
    LIMIT_UNEXPECTED_FILE: 'Send one file, in the "image" field',
    LIMIT_FILE_COUNT: 'Send one file, in the "image" field',
  };
  return new HttpError(400, 'invalid_image', messages[error.code] ?? 'Invalid upload');
}
