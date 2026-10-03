'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({
  href,
  exact,
  children,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        active ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  );
}
