import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SITE_URL } from '@/lib/site-config';
import { breadcrumbJsonLd } from '@/lib/json-ld';
import { CATEGORIES, getToolByHref } from '@/lib/tools-registry';

const PdfMerge = dynamic(() => import('@/tools/document/pdf-merge/PdfMerge'), {
  ssr: false,
});

const TOOL = getToolByHref('/tools/document/pdf-merge')!;
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
    <Box>
      <Typography
        variant="h2"
        sx={{
          fontSize: { xs: 24, md: 32 },
          fontWeight: 500,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          mb: 1,
        }}
      >
        {TITLE}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {TOOL.description}
      </Typography>

      <PdfMerge />

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
