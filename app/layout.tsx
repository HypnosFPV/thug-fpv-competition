import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'THUG FPV Competition Platform',
  description: 'Created by Hypnos FPV. Presented by THUG and Nappy FPV.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
