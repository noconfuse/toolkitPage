import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import { SITE_URL } from '@/lib/site-config';
import { breadcrumbJsonLd } from '@/lib/json-ld';
import { CATEGORIES, getToolByHref } from '@/lib/tools-registry';

// pdfjs + pdf-lib 都需 client side
const PdfImageConvert = dynamic(() => import('@/tools/document/pdf-image-convert/PdfImageConvert'), {
  ssr: false,
});

const TOOL = getToolByHref('/tools/document/pdf-image-convert')!;
const TITLE = TOOL.title;

export const metadata: Metadata = {
  title: TITLE,
  description: TOOL.longDescription,
  keywords: TOOL.keywords,
  alternates: { canonical: `${SITE_URL}${TOOL.href}` },
  openGraph: {
    title: TITLE,
    description: TOOL.longDescription,
    url: `${SITE_URL}${TOOL.href}`,
    type: 'website',
  },
};

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: TITLE,
    description: TOOL.longDescription,
    url: `${SITE_URL}${TOOL.href}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (Browser)',
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'CNY' },
  };

  const category = CATEGORIES.find((c) => c.id === TOOL.categoryId)!;
  const breadcrumb = breadcrumbJsonLd([
    { name: '首页', href: '/' },
    { name: category.label, href: category.href },
    { name: TITLE, href: TOOL.href },
  ]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <PdfImageConvert title={TITLE} description={TOOL.description} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </Box>
  );
}