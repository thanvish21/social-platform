import type { Metadata } from 'next';
import './globals.css';
import { ApolloClientProvider } from '@/lib/ApolloClientProvider';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Sociable',
  description: 'A production-grade social platform built with GraphQL + Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ApolloClientProvider>
          <Nav />
          <main className="mx-auto flex max-w-5xl">{children}</main>
        </ApolloClientProvider>
      </body>
    </html>
  );
}
