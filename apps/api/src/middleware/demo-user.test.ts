import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { demoUser } from './demo-user.js';

describe('demoUser middleware', () => {
  it('sets req.user to the fixed demo user', async () => {
    const app = express();
    app.use(demoUser);
    app.get('/me', (req, res) => {
      res.json(req.user);
    });

    const res = await request(app).get('/me');
    expect(res.body).toEqual({ id: DEMO_USER_ID });
  });
});
