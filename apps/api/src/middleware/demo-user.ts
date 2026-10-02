import type { NextFunction, Request, Response } from 'express';
import { DEMO_USER_ID } from '../config/demo-user.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: { id: string }; // set by the demoUser middleware, which runs before every route
    }
  }
}

// Placeholder: injects a fixed demo user. To be replaced by real authentication
// in a future iteration; the rest of the code only relies on req.user.id.
export function demoUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = { id: DEMO_USER_ID };
  next();
}
