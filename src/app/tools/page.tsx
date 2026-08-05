import type { Metadata } from 'next';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import { SITE_URL } from '@/lib/site-config';
import { breadcrumbJsonLd } from '@/lib/json-ld';
import { TOOLS_BY_CATEGORY } from '@/lib/tools-registry';

const TITLE = '工具索引';
const DESCRIPTION =
  '按分类浏览 Toolkit Page 提供的全部在线工具，所有工具均在浏览器内运行。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tools` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/tools`,
    type: 'website',
  },
};

export default function ToolsIndexPage() {
  const breadcrumb = breadcrumbJsonLd([
    { name: '首页', href: '/' },
    { name: '工具索引', href: '/tools' },
  ]);
  return (
    <Box>
      <Box sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 4, md: 6 } }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "baseline" }}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontFamily: 'var(--font-geist-mono)',
            }}
          >
            Index
          </Typography>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {TOOLS_BY_CATEGORY.reduce((n, c) => n + c.tools.length, 0)} 个工具 ·{' '}
            {TOOLS_BY_CATEGORY.length} 个分类
          </Typography>
        </Stack>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 40, md: 64 },
            fontWeight: 500,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
          }}
        >
          {TITLE}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mt: 2, maxWidth: 560, fontSize: 17 }}
        >
          {DESCRIPTION}
        </Typography>
      </Box>

      {TOOLS_BY_CATEGORY.map(({ category, tools }, ci) => (
        <Box
          key={category.id}
          sx={{
            mt: { xs: 4, md: 6 },
            pt: { xs: 4, md: 5 },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              mb: 3,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
              <Typography
                variant="overline"
                sx={{
                  color: 'primary.main',
                  fontFamily: 'var(--font-geist-mono)',
                }}
              >
                §{String(ci + 1).padStart(2, '0')}
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 500 }}>
                {category.label}
              </Typography>
            </Stack>
            <Typography
              component={Link}
              href={category.href}
              variant="body2"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              {category.description}
            </Typography>
          </Box>

          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {tools.map((tool, i) => {
              const globalIndex = ci * 10 + i + 1;
              return (
                <Box
                  key={tool.id}
                  component={Link}
                  href={tool.href}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '40px 1fr',
                      md: '40px 2fr 3fr 80px',
                    },
                    alignItems: 'center',
                    gap: { xs: 2, md: 4 },
                    py: { xs: 2.5, md: 3 },
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background-color 160ms ease',
                    '&:hover': { bgcolor: 'rgba(15, 31, 29, 0.03)' },
                    '&:hover .row-arrow': { transform: 'translateX(4px)' },
                    '&:hover .row-title': { color: 'primary.main' },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'var(--font-geist-mono)',
                      color: 'text.secondary',
                    }}
                  >
                    {String(globalIndex).padStart(2, '0')}
                  </Typography>
                  <Typography
                    className="row-title"
                    variant="h5"
                    sx={{
                      fontWeight: 500,
                      fontSize: { xs: 18, md: 22 },
                      transition: 'color 160ms ease',
                    }}
                  >
                    {tool.title}
                    {!tool.available && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ ml: 1, color: 'text.disabled' }}
                      >
                        · 即将
                      </Typography>
                    )}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', md: 'block' } }}
                  >
                    {tool.description}
                  </Typography>
                  <Box
                    className="row-arrow"
                    sx={{
                      display: 'flex',
                      justifyContent: { xs: 'flex-end', md: 'flex-start' },
                      color: 'text.secondary',
                      transition: 'transform 200ms ease',
                    }}
                  >
                    <ArrowOutwardIcon sx={{ fontSize: 18 }} />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ))}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </Box>
  );
}