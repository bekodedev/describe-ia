import Link from 'next/link';
import { NavLink } from './NavLink';

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-lg font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-indigo-700 text-sm font-bold text-white"
          >
            D
          </span>
          DescribeIA
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <NavLink href="/" exact>
            New description
          </NavLink>
          <NavLink href="/products">History</NavLink>
        </nav>
      </div>
    </header>
  );
}
