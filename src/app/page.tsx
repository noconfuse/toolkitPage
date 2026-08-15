import type { Metadata } from 'next';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { SITE_URL } from '@/lib/site-config';
import { TOOLS } from '@/lib/tools-registry';
import {
  HeroComposition,
  ThumbImageCombine,
  ThumbImageCompress,
  ThumbImageConvert,
  ThumbPdfImageConvert,
  ThumbPdfMerge,
  ThumbPdfStamp,
  ThumbQrCode,
  ThumbRemoveWatermark,
  ThumbBackgroundReplace,
  ThumbWatermark,
} from '@/components/visuals';

const TITLE = 'Toolkit · 浏览器即用的小工具';
const DESCRIPTION =
  '图片合成、PDF 贴图，以及更多本地优先的浏览器工具。所有处理都在你的设备上完成，文件不上传。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    type: 'website',
  },
};

const THUMBS: Record<string, React.ReactNode> = {
  'image-combine': <ThumbImageCombine />,
  'image-compress': <ThumbImageCompress />,
  'image-convert': <ThumbImageConvert />,
  'qrcode-generator': <ThumbQrCode />,
  'pdf-stamp': <ThumbPdfStamp />,
  'pdf-image-convert': <ThumbPdfImageConvert />,
  'pdf-merge': <ThumbPdfMerge />,
  'image-watermark': <ThumbWatermark />,
  'image-remove-watermark': <ThumbRemoveWatermark />,
  'image-background-replace': <ThumbBackgroundReplace />,
};

export default function HomePage() {
  const availableTools = TOOLS.filter((t) => t.available);
  const feature = availableTools[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Toolkit Page',
    url: SITE_URL,
    description: DESCRIPTION,
  };

  return (
    <Box>
      {/* ───────── 刊头 ───────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
          gap: { xs: 6, md: 8 },
          alignItems: 'center',
          pt: { xs: 2, md: 4 },
          pb: { xs: 6, md: 10 },
        }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mb: 4, alignItems: 'center' }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'primary.main',
              }}
            />
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              No.{' '}
              {String(new Date().getFullYear()).slice(-2)}.
              {String(new Date().getMonth() + 1).padStart(2, '0')} · 本地优先
            </Typography>
          </Stack>

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: 44, sm: 64, md: 88 },
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: '-0.04em',
              mb: 4,
            }}
          >
            浏览器里，
            <Box
              component="span"
              sx={{
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'text.secondary',
              }}
            >
              即开即用
            </Box>
            <br />
            的小工具。
          </Typography>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              component={Link}
              href={feature?.href ?? '/tools'}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
            >
              开始使用
            </Button>
            <Button
              component={Link}
              href="/about"
              size="large"
              sx={{ color: 'text.secondary' }}
            >
              了解本站
            </Button>
          </Stack>
        </Box>

        {/* Hero 视觉 */}
        <Box
          sx={{
            position: 'relative',
            color: 'primary.main',
            mx: { xs: 'auto', md: 0 },
            width: '100%',
            maxWidth: 360,
            aspectRatio: '1 / 1',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '6%',
              borderRadius: '50%',
              border: 1,
              borderColor: 'divider',
              background:
                'radial-gradient(circle at 50% 50%, rgba(15,61,58,0.05), rgba(15,61,58,0.015) 55%, transparent 70%)',
            },
            '& svg': {
              position: 'relative',
              zIndex: 1,
              inset: 0,
            },
          }}
        >
          <HeroComposition />
        </Box>
      </Box>

      {/* ───────── 主推 ───────── */}
      {feature && (
        <Box
          component={Link}
          href={feature.href}
          sx={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            pt: { xs: 4, md: 6 },
            pb: { xs: 3, md: 4 },
            borderTop: 1,
            borderColor: 'divider',
            transition: 'opacity 200ms ease',
            '&:hover': { opacity: 0.7 },
            '&:hover .feature-arrow': { transform: 'translate(4px, -4px)' },
            '&:hover .feature-thumb': { color: 'primary.main' },
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mb: 3, alignItems: 'baseline' }}
          >
            <Typography
              variant="overline"
              sx={{
                color: 'primary.main',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              — 精选
            </Typography>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary' }}
            >
              Featured
            </Typography>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '80px 2fr 1fr 24px' },
              gap: { xs: 3, md: 6 },
              alignItems: 'center',
            }}
          >
            {/* 缩略图 */}
            <Box
              className="feature-thumb"
              sx={{
                color: 'text.primary',
                transition: 'color 200ms ease',
                width: 80,
                height: 80,
                mx: { xs: 'auto', md: 0 },
              }}
            >
              {THUMBS[feature.id]}
            </Box>

            <Box>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: 32, md: 48 },
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  mb: 1,
                }}
              >
                {feature.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15 }}>
                {feature.description}
              </Typography>
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              本地处理 · 即开即用
            </Typography>

            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <ArrowOutwardIcon
                className="feature-arrow"
                sx={{ fontSize: 18, transition: 'transform 200ms ease' }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* ───────── 工具库 ───────── */}
      <Box sx={{ mt: { xs: 6, md: 10 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            mb: 4,
            borderTop: 1,
            borderColor: 'divider',
            pt: 4,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
            <Typography
              variant="overline"
              sx={{
                color: 'primary.main',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              §1
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 500 }}>
              工具
            </Typography>
          </Stack>
          <Typography
            component={Link}
            href="/tools"
            variant="body2"
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              transition: 'color 160ms ease',
              '&:hover': { color: 'primary.main' },
            }}
          >
            索引 <ArrowOutwardIcon sx={{ fontSize: 14 }} />
          </Typography>
        </Box>

        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {availableTools.map((tool, i) => (
            <Box
              key={tool.id}
              component={Link}
              href={tool.href}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '40px 40px 1fr',
                  md: '40px 56px 2fr 3fr 80px',
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
                '&:hover .row-thumb': { color: 'primary.main' },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'var(--font-geist-mono)',
                  color: 'text.secondary',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </Typography>

              {/* 缩略图 */}
              <Box
                className="row-thumb"
                sx={{
                  width: { xs: 36, md: 48 },
                  height: { xs: 36, md: 48 },
                  color: 'text.primary',
                  transition: 'color 200ms ease',
                }}
              >
                {THUMBS[tool.id]}
              </Box>

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
          ))}
        </Stack>
      </Box>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Box>
  );
}