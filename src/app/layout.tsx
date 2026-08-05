import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import * as React from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';
import ThemeRegistry from '@/lib/ThemeRegistry';
import AppShell from '@/components/layout/AppShell';
import NoiseOverlay from '@/components/layout/NoiseOverlay';
import SkipLink from '@/components/layout/SkipLink';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site-config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    '在线工具',
    '图片处理',
    '图片叠加',
    '图片合成',
    'Canvas',
    'PDF 贴图',
    '实用工具',
    '工具集合',
  ],
  applicationName: SITE_NAME,
  authors: [{ name: 'Toolkit' }],
  creator: 'Toolkit',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      { url: '/og-cover.png', width: 1200, height: 630, alt: SITE_NAME },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  themeColor: '#0f3d3a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Google Analytics：在 Vercel 配置 NEXT_PUBLIC_GA_ID（GA4 的 G- 开头 ID）后自动生效
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <SkipLink />
        <ThemeRegistry>
          <NoiseOverlay />
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}