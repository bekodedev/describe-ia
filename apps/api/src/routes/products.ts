import { Router } from 'express';
import { listDescriptions } from '../db/descriptions.js';
import type { Db } from '../db/pool.js';
import { findProduct, listProducts } from '../db/products.js';
import { NotFoundError } from '../http-errors.js';
import type { ImageStore } from '../images/storage.js';
import { encodeCursor, idParams, listQuery } from './schemas.js';
import { toDescriptionDto, toProductDto } from './serialize.js';

export function createProductsRouter(db: Db, imageStore: ImageStore): Router {
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

  // The photo as it was uploaded; only its owner can see it.
  router.get('/products/:id/image', async (req, res, next) => {
    const { id } = idParams.parse(req.params);
    const product = await findProduct(db, id, req.user.id);
    if (!product?.image_path) throw new NotFoundError('This product has no image');

    res.set({ 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(product.image_path, { root: imageStore.dir }, (error) => {
      if (error) next(new NotFoundError('Image file not found'));
    });
  });

  return router;
}
