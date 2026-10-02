import { Router } from 'express';
import { updateEditedContent } from '../db/descriptions.js';
import type { Db } from '../db/pool.js';
import { NotFoundError } from '../http-errors.js';
import { editBody, idParams } from './schemas.js';
import { toDescriptionDto } from './serialize.js';

export function createDescriptionsRouter(db: Db): Router {
  const router = Router();

  // Saves the user's edit next to the generated text; the original is never touched.
  router.patch('/descriptions/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { editedContent } = editBody.parse(req.body);
    const description = await updateEditedContent(db, id, req.user.id, editedContent);
    if (!description) throw new NotFoundError('Description not found');

    res.json({ description: toDescriptionDto(description) });
  });

  return router;
}
