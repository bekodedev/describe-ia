import type {
  EditResponse,
  ErrorResponse,
  GenerationResponse,
  ProductDetailResponse,
  ProductListResponse,
} from '@describe-ia/shared';

// The single place that talks to the API. Types come from the shared package, so the contract
// is checked at compile time on both sides.

export class ApiError extends Error {
  constructor(
    readonly status: number, // 0 = the server could not be reached
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

// In the browser the requests are relative (Next forwards /api/* to the API); on the server
// they go straight to the API.
const base = typeof window === 'undefined' ? (process.env.API_URL ?? 'http://localhost:4000') : '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, init);
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | null;
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'unknown',
      error?.details?.[0]?.message ?? error?.message ?? response.statusText,
      error?.requestId,
    );
  }
  return (await response.json()) as T;
}

export interface GenerateInput {
  title: string;
  category: string;
  image?: File | null;
}

export function generate({ title, category, image }: GenerateInput) {
  const form = new FormData();
  form.set('title', title);
  form.set('category', category);
  if (image) form.set('image', image);
  return request<GenerationResponse>('/api/generations', { method: 'POST', body: form });
}

export function listProducts(cursor?: string | null, limit = 20) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return request<ProductListResponse>(`/api/products?${query}`);
}

export function getProduct(id: string) {
  return request<ProductDetailResponse>(`/api/products/${encodeURIComponent(id)}`);
}

export function saveEdit(descriptionId: string, editedContent: string) {
  return request<EditResponse>(`/api/descriptions/${encodeURIComponent(descriptionId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ editedContent }),
  });
}
