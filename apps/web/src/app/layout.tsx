import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SaleAssist — Video Commerce Platform',
    template: '%s | SaleAssist',
  },
  description:
    'Transform your e-commerce with live video shopping, AI chat, shoppable videos, and real-time customer engagement.',
  keywords: ['video commerce', 'live shopping', 'shoppable video', 'AI chat', 'e-commerce', 'CRM'],
  authors: [{ name: 'SaleAssist' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'SaleAssist',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
