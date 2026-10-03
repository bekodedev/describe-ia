// Code and types shared by the API and the web app. No dependencies, so both can import it.

// Closed list: the form shows exactly these and the API rejects anything else.
export const CATEGORIES = [
  'Fashion',
  'Electronics',
  'Beauty',
  'Home & Kitchen',
  'Furniture',
  'Sports',
  'Toys',
  'Books',
  'Pets',
  'Food & Drink',
  'Health',
  'Automotive',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TITLE_LENGTH = { min: 3, max: 200 } as const;
// Generated texts are at most 1600 characters; an edit may be a bit longer.
export const EDITED_CONTENT_MAX = 3000;

// Photo upload: the same limits are checked by the form and by the API.
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type DescriptionVariant = 'short' | 'medium' | 'seo';

// What the API returns (camelCase, dates as ISO strings). The web app uses these types.
export interface ProductDto {
  id: string;
  title: string;
  category: string;
  imageUrl: string | null; // path of the photo endpoint, null when the product has no photo
  createdAt: string;
}

export interface DescriptionDto {
  id: string;
  productId: string;
  variant: DescriptionVariant;
  content: string; // the generated text, never modified
  editedContent: string | null; // the user's edit, if any
  createdAt: string;
  updatedAt: string;
}

export interface GenerationResponse {
  product: ProductDto;
  descriptions: DescriptionDto[];
}

// GET /api/products/:id has the same shape as the generation response.
export type ProductDetailResponse = GenerationResponse;

export interface EditResponse {
  description: DescriptionDto;
}

export interface ProductListResponse {
  products: ProductDto[];
  nextCursor: string | null;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId: string;
  };
}
