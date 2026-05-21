import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LoklFlow',
  description: 'Sistema integral de gestión para establecimientos F&B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
