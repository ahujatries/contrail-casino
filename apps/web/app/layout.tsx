import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const wordmark = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-wordmark',
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Contrail Casino — Live',
  description:
    'Live competitive aviation race between JFK, ORD, ATL, LAX. Place play-money bets and watch real planes resolve them in real time. Hosted at contrail.raghavahuja.com.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${wordmark.variable}`}>
      <body>{children}</body>
    </html>
  );
}
