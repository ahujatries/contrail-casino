import type { Metadata } from 'next';
import { Archivo, Archivo_Narrow, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const display = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const narrow = Archivo_Narrow({
  subsets: ['latin'],
  variable: '--font-narrow',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Contrail Casino — Live',
  description:
    'Two planes, one race. Bet on real aviation events at JFK, ORD, ATL, LAX. Play money only — no real currency, no gambling.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${narrow.variable} ${mono.variable}`}
      data-theme="light"
    >
      <body>{children}</body>
    </html>
  );
}
