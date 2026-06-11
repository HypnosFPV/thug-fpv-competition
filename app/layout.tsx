import './globals.css';
import type { Metadata, Viewport } from 'next';

import { AuthCookieSync } from '@/components/AuthCookieSync';

export const metadata: Metadata = {
  title: 'THUG FPV Competition Platform',
  description: 'Created by Hypnos FPV. Presented by THUG and Nappy FPV.'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0612'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthCookieSync />
        {children}
      </body>
    </html>
  );
}
