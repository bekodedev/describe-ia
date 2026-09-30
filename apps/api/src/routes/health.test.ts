import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('GET /health', () => {
  it('reports db ok when the query succeeds', async () => {
    const app = createApp({ query: async () => ({}) });
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('reports db down when the query fails', async () => {
    const app = createApp({ query: async () => Promise.reject(new Error('refused')) });
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', db: 'down' });
  });
});
