import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'DescribeIA - product descriptions in seconds',
  description:
    'Generate a short, a medium and an SEO description for your products from a title and an optional photo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl px-6 py-10 lg:py-14">
          {children}
        </main>
      </body>
    </html>
  );
}
