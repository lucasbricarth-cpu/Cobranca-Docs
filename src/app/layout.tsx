import type { Metadata, Viewport } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import AppBackground from '@/components/design/AppBackground';
import { BackgroundPrefsProvider } from '@/components/design/BackgroundPrefsProvider';
import { RegistrarSW } from '@/components/pwa/RegistrarSW';
import { IDS_PALETA, PALETA_PADRAO } from '@/lib/paletas';
import { CHAVE_LOCAL, ROTAS_PUBLICAS } from '@/lib/backgroundPrefs';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const merriweather = Merriweather({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-merriweather', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Portal de Documentos', template: '%s · Portal de Documentos' },
  description: 'Documentos do escritório e do cliente, organizados por mês.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Documentos' },
  icons: { icon: '/icone.svg', apple: '/icone-192.png' },
};
export const viewport: Viewport = {
  themeColor: '#0F0E0C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Cor de destaque antes da primeira pintura (técnica do next-themes): lê o
 * cache local, confere o id na lista fechada e põe o data-destaque no <html>
 * antes de o React montar. Em rota pública não aplica nada (sempre Dourado).
 * Roda como primeiro filho do <body>.
 */
const SCRIPT_DESTAQUE =
  `(function(){try{var p=location.pathname,pub=${JSON.stringify(ROTAS_PUBLICAS)};if(p==='/')return;` +
  `for(var i=0;i<pub.length;i++){if(p===pub[i]||p.indexOf(pub[i]+'/')===0)return}` +
  `var r=localStorage.getItem(${JSON.stringify(CHAVE_LOCAL)});if(!r)return;` +
  `var d=JSON.parse(r).destaque;if(${JSON.stringify([...IDS_PALETA])}.indexOf(d)>=0&&d!==${JSON.stringify(PALETA_PADRAO)})` +
  `document.documentElement.setAttribute('data-destaque',d)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${merriweather.variable}`} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DESTAQUE }} />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <BackgroundPrefsProvider>
            <AppBackground />
            {children}
            <RegistrarSW />
          </BackgroundPrefsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
