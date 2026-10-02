import { Router } from 'express';
import { listDescriptions } from '../db/descriptions.js';
import type { Db } from '../db/pool.js';
import { findProduct, listProducts } from '../db/products.js';
import { NotFoundError } from '../http-errors.js';
import { encodeCursor, idParams, listQuery } from './schemas.js';
import { toDescriptionDto, toProductDto } from './serialize.js';

export function createProductsRouter(db: Db): Router {
  const router = Router();

  router.get('/products', async (req, res) => {
    const { limit, cursor } = listQuery.parse(req.query);
    const { products, next } = await listProducts(db, req.user.id, limit, cursor);
    res.json({ products: products.map(toProductDto), nextCursor: next && encodeCursor(next) });
  });

  router.get('/products/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    const product = await findProduct(db, id, req.user.id);
    if (!product) throw new NotFoundError('Product not found');

    const descriptions = await listDescriptions(db, product.id);
    res.json({ product: toProductDto(product), descriptions: descriptions.map(toDescriptionDto) });
  });

  return router;
}
