import type { ButtonHTMLAttributes, ReactNode } from 'react';

// The few building blocks the pages share. No component library: classes live here once.

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-75';
const variants = {
  primary: 'bg-indigo-700 px-5 py-3 text-white hover:bg-indigo-800',
  secondary:
    'border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 hover:bg-slate-50',
  quiet: 'px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-100',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
    >
      {children}
    </div>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
  );
}
