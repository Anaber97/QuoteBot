/* oxlint-disable react/only-export-components -- Next.js metadata is intentionally colocated with the root layout. */
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://towcalc.com'),
  title: 'TowCalc — Quoting software for towing and heavy haul',
  description: 'TowCalc applies your rates, zones and permit rules to every call, so each dispatcher quotes the same job the same way.',
  openGraph: { title: 'TowCalc — Price the tow while they wait.', description: 'Quoting software for towing and heavy haul.', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TowCalc' }] },
  twitter: { card: 'summary_large_image', title: 'TowCalc — Price the tow while they wait.', description: 'Quoting software for towing and heavy haul.', images: ['/og.png'] },
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export const viewport: Viewport = { themeColor: '#eef0ea' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
