import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Turizm Pazaryeri',
  description: 'Turizm sektörüne yönelik hizmet pazaryeri platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
