import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Footer from '@/components/Footer';

const inter = localFont({
  src: [
    { path: './fonts/Inter.woff2', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NetLogger',
  description: 'Amateur radio net logging application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Auto-reload on ChunkLoadError (e.g. after a dev server restart or deploy) */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('unhandledrejection', function(e) {
            if (e.reason && e.reason.name === 'ChunkLoadError') {
              window.location.reload();
            }
          });
          window.addEventListener('error', function(e) {
            if (e.message && e.message.indexOf('Loading chunk') !== -1) {
              window.location.reload();
            }
          });
        `}} />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-slate-100 flex flex-col">
            <div className="flex-1 flex flex-col">
              {children}
            </div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
