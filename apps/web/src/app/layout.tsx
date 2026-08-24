import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistrar } from '@/components/offline/sw-register';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'LoklFlow',
  description: 'Sistema integral de gestión para establecimientos F&B',
  manifest: '/manifest.webmanifest',
  // Instalable en la pantalla de inicio de una tablet, que es donde vive esto en un local.
  appleWebApp: { capable: true, title: 'LoklFlow', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  // `viewportFit: 'cover'` para que las barras fijas del mesero puedan usar
  // `env(safe-area-inset-bottom)` en un teléfono con muesca.
  viewportFit: 'cover',
  /**
   * El teclado virtual **reduce** el viewport en vez de flotar sobre él.
   *
   * Sin esto, `dvh` sigue a la barra del navegador pero no se entera de que hay un teclado
   * abierto, así que la hoja de diálogo anclada abajo se calcula contra la pantalla entera y
   * queda **debajo de las teclas**. Es la mitad que falta del `max-h`/`overflow` de
   * `ui/dialog.tsx`: sin las dos, un formulario largo en un teléfono no se puede terminar.
   */
  interactiveWidget: 'resizes-content',
  // Sin `maximumScale`: limitar el zoom en una aplicación que se usa a pulso, con las manos
  // ocupadas y a contraluz, es quitarle a alguien la única forma de leer la pantalla.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={cn('font-sans', geist.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            {children}
            <Toaster />
            <ServiceWorkerRegistrar />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
