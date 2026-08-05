import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { SITE_URL } from '@/lib/site-config';
import { breadcrumbJsonLd } from '@/lib/json-ld';
import { CATEGORIES, getToolByHref } from '@/lib/tools-registry';

// react-pdf 依赖 pdfjs-dist，必须完全跳过 SSR
const PdfStamp = dynamic(() => import('@/tools/document/pdf-stamp/PdfStamp'), {
  ssr: false,
});

const TOOL = getToolByHref('/tools/document/pdf-stamp')!;
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

const PRESET_TOOLTIP = (
  <Box sx={{ p: 0.5, maxWidth: 280 }}>
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        fontWeight: 500,
        color: 'inherit',
        mb: 0.5,
      }}
    >
      常见场景
    </Typography>
    {[
      { t: '电子印章', m: 'PNG 透明底图' },
      { t: '签名 / Logo', m: 'PNG 透明底图' },
      { t: '水印', m: '降低不透明度' },
      { t: '表格盖章', m: '精确拖动位置' },
    ].map((p) => (
      <Box
        key={p.t}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <span>{p.t}</span>
        <span style={{ opacity: 0.6, fontFamily: 'var(--font-geist-mono)' }}>
          {p.m}
        </span>
      </Box>
    ))}
  </Box>
);

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
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: 24, md: 32 },
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {TITLE}
        </Typography>
        <Tooltip title={PRESET_TOOLTIP} placement="bottom-start" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              py: 0.5,
              fontSize: 12,
              fontWeight: 500,
              color: 'text.secondary',
              border: 1,
              borderColor: 'divider',
              borderRadius: 999,
              cursor: 'help',
              transition: 'all 160ms ease',
              '&:hover': {
                borderColor: 'text.secondary',
                color: 'text.primary',
              },
            }}
          >
            常见场景
            <Box
              component="span"
              sx={{
                fontSize: 10,
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: 'rgba(15, 31, 29, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              ?
            </Box>
          </Box>
        </Tooltip>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {TOOL.description}
      </Typography>

      <PdfStamp />

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