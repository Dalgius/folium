import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';
import { PrivacyProvider } from '@/hooks/use-privacy';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Folium',
  description: 'Conti, depositi e investimenti in un unico posto: monitora il tuo patrimonio e come cresce nel tempo.',
};

// Le quotazioni vengono chieste a Yahoo poche alla volta: lasciamo alle server action
// il tempo di completare anche portafogli con molti titoli (60 s è il massimo sul piano Hobby di Vercel)
export const maxDuration = 60;

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PrivacyProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
