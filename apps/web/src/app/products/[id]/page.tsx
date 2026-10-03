'use client';

import type { DescriptionDto, ProductDetailResponse } from '@describe-ia/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DescriptionCard } from '@/components/DescriptionCard';
import { Card, ErrorAlert, Skeleton } from '@/components/ui';
import { getProduct } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProduct(id)
      .then((result) => {
        setData(result);
        document.title = `${result.product.title} - DescribeIA`;
      })
      .catch((e: unknown) => setError(friendlyError(e)));
  }, [id]);

  // After an edit only that description changes; the others keep their state.
  function replaceDescription(updated: DescriptionDto) {
    setData(
      (current) =>
        current && {
          ...current,
          descriptions: current.descriptions.map((d) => (d.id === updated.id ? updated : d)),
        },
    );
  }

  return (
    <div>
      <Link
        href="/products"
        className="rounded text-sm font-semibold text-indigo-800 hover:underline"
      >
        ← History
      </Link>

      {error && (
        <div className="mt-6 max-w-2xl">
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      )}
      {!data && !error && <ProductSkeleton />}
      {data && <ProductView data={data} onSaved={replaceDescription} />}
    </div>
  );
}

function ProductView({
  data,
  onSaved,
}: {
  data: ProductDetailResponse;
  onSaved: (d: DescriptionDto) => void;
}) {
  const { product, descriptions } = data;
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = photoFailed ? null : product.imageUrl;

  return (
    <>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {product.title}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-800">
          {product.category}
        </span>
        <time dateTime={product.createdAt}>{formatDate(product.createdAt)}</time>
      </p>

      <div className={`mt-8 grid items-start gap-8 ${photoUrl ? 'lg:grid-cols-3' : ''}`}>
        {photoUrl && (
          <Card className="overflow-hidden p-2 lg:sticky lg:top-6">
            {/* The photo as it was uploaded, served by the API */}
            <img
              src={photoUrl}
              alt={`Photo of ${product.title}`}
              onError={() => setPhotoFailed(true)}
              className="max-h-[32rem] w-full rounded-xl bg-slate-100 object-contain"
            />
          </Card>
        )}
        <div className={`space-y-5 ${photoUrl ? 'lg:col-span-2' : 'max-w-3xl'}`}>
          {descriptions.map((description) => (
            <DescriptionCard key={description.id} description={description} onSaved={onSaved} />
          ))}
        </div>
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div role="status" aria-label="Loading the descriptions" className="mt-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-4 h-5 w-48" />
      <div className="mt-8 max-w-3xl space-y-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
