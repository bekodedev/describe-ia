import { Router, type RequestHandler } from 'express';
import type { Description } from '../db/descriptions.js';
import type { Product } from '../db/products.js';
import type { GenerationInput } from '../generation/service.js';
import { prepareImage } from '../images/prepare.js';
import { generationBody } from './schemas.js';
import { toDescriptionDto, toProductDto } from './serialize.js';

export type GenerateFn = (
  input: GenerationInput,
) => Promise<{ product: Product; descriptions: Description[] }>;

export function createGenerationsRouter(
  generate: GenerateFn,
  limiter: RequestHandler,
  upload: RequestHandler,
): Router {
  const router = Router();

  // JSON { title, category }, or multipart/form-data with the same fields plus an optional `image`.
  router.post('/generations', limiter, upload, async (req, res) => {
    const { title, category } = generationBody.parse(req.body);
    const image = req.file && (await prepareImage(req.file.buffer));
    const { product, descriptions } = await generate({
      userId: req.user.id,
      title,
      category,
      image,
    });
    res.status(201).json({
      product: toProductDto(product),
      descriptions: descriptions.map(toDescriptionDto),
    });
  });

  return router;
}
