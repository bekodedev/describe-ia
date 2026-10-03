'use client';

import type { ProductDto } from '@describe-ia/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ErrorAlert, Skeleton, Spinner } from '@/components/ui';
import { listProducts } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';

export default function HistoryPage() {
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after: string | null) => {
    setError(null);
    try {
      const page = await listProducts(after);
      setProducts((current) => (after && current ? [...current, ...page.products] : page.products));
      setCursor(page.nextCursor);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    await load(cursor);
    setLoadingMore(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">History</h1>
      <p className="mt-2 text-slate-700">The products you generated, newest first.</p>

      {error && (
        <div className="mt-6">
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      )}

      {!products && !error && (
        <div role="status" aria-label="Loading the history" className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {products?.length === 0 && (
        <Card className="mt-6 p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">Nothing here yet</p>
          <p className="mt-1 text-slate-700">
            Generate your first description to see it in this list.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800"
          >
            Describe a product
          </Link>
        </Card>
      )}

      {products && products.length > 0 && (
        <>
          <ul className="mt-6 space-y-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/products/${product.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <Thumbnail product={product} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{product.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {product.category} ·{' '}
                      <time dateTime={product.createdAt}>{formatDate(product.createdAt)}</time>
                    </p>
                  </div>
                  <span aria-hidden="true" className="pr-2 text-slate-500">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {cursor && (
            <div className="mt-6 flex justify-center">
              <Button onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Spinner />}
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Thumbnail({ product }: { product: ProductDto }) {
  const [failed, setFailed] = useState(false);
  const box = 'size-14 shrink-0 rounded-xl';

  if (!product.imageUrl || failed) {
    return (
      <span
        aria-hidden="true"
        className={`${box} grid place-items-center bg-slate-100 text-lg font-bold text-slate-500`}
      >
        {product.title.charAt(0).toUpperCase()}
      </span>
    );
  }
  // Empty alt: the title next to it already says what the product is
  return (
    <img
      src={product.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} bg-slate-100 object-cover`}
    />
  );
}
