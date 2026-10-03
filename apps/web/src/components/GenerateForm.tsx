'use client';

import { CATEGORIES, TITLE_LENGTH } from '@describe-ia/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { generate } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { PhotoDropzone } from './PhotoDropzone';
import { Button, Card, ErrorAlert, Spinner } from './ui';

interface FieldErrors {
  title?: string;
  category?: string;
}

function validate(title: string, category: string): FieldErrors {
  const errors: FieldErrors = {};
  const length = title.trim().length;
  if (length === 0) errors.title = 'Enter a product title.';
  else if (length < TITLE_LENGTH.min)
    errors.title = `The title needs at least ${TITLE_LENGTH.min} characters.`;
  else if (length > TITLE_LENGTH.max)
    errors.title = `Keep the title under ${TITLE_LENGTH.max} characters.`;
  if (!category) errors.category = 'Choose a category.';
  return errors;
}

const fieldClass = (invalid: boolean) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500 ${
    invalid ? 'border-red-600' : 'border-slate-300'
  }`;

export function GenerateForm() {
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);

    const found = validate(title, category);
    setErrors(found);
    if (found.title) return titleRef.current?.focus();
    if (found.category) return categoryRef.current?.focus();

    setLoading(true);
    try {
      const { product } = await generate({ title: title.trim(), category, image: photo });
      router.push(`/products/${product.id}`);
    } catch (error) {
      setApiError(friendlyError(error));
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate aria-busy={loading}>
        <fieldset disabled={loading} className="space-y-6">
          <legend className="sr-only">Product details</legend>

          <div>
            <label htmlFor="title" className="text-sm font-semibold text-slate-900">
              Product title
            </label>
            <input
              id="title"
              ref={titleRef}
              value={title}
              maxLength={TITLE_LENGTH.max}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Stainless steel water bottle 750 ml"
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
              className={fieldClass(Boolean(errors.title))}
            />
            {errors.title && (
              <p id="title-error" className="mt-1.5 text-sm font-medium text-red-800">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="text-sm font-semibold text-slate-900">
              Category
            </label>
            <select
              id="category"
              ref={categoryRef}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={errors.category ? 'category-error' : undefined}
              className={fieldClass(Boolean(errors.category))}
            >
              <option value="">Choose a category</option>
              {CATEGORIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p id="category-error" className="mt-1.5 text-sm font-medium text-red-800">
                {errors.category}
              </p>
            )}
          </div>

          <PhotoDropzone file={photo} onChange={setPhoto} />
        </fieldset>

        {apiError && (
          <div className="mt-6">
            <ErrorAlert>{apiError}</ErrorAlert>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="mt-6 w-full">
          {loading ? (
            <>
              <Spinner />
              Generating 3 descriptions…
            </>
          ) : (
            'Generate descriptions'
          )}
        </Button>
      </form>
    </Card>
  );
}
