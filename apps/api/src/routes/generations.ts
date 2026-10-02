import { Router, type RequestHandler } from 'express';
import type { Description } from '../db/descriptions.js';
import type { Product } from '../db/products.js';
import type { GenerationInput } from '../generation/service.js';
import { generationBody } from './schemas.js';
import { toDescriptionDto, toProductDto } from './serialize.js';

export type GenerateFn = (
  input: GenerationInput,
) => Promise<{ product: Product; descriptions: Description[] }>;

export function createGenerationsRouter(generate: GenerateFn, limiter: RequestHandler): Router {
  const router = Router();

  router.post('/generations', limiter, async (req, res) => {
    const { title, category } = generationBody.parse(req.body);
    const { product, descriptions } = await generate({ userId: req.user.id, title, category });
    res.status(201).json({
      product: toProductDto(product),
      descriptions: descriptions.map(toDescriptionDto),
    });
  });

  return router;
}
