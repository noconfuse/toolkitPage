import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import { SITE_URL } from '@/lib/site-config';
import {
  IconArrow,
  IconExternal,
  IconChat,
} from '@/components/visuals';

const TITLE = '关于本站';
const DESCRIPTION =
  'Toolkit Page 是一个个人维护的极简工具集合站点。本地优先、能用浏览器完成的就不上服务器，文件不会上传。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/about`,
    type: 'website',
  },
};

const STACK = [
  { k: '框架', v: 'Next.js 14 · App Router' },
  { k: 'UI', v: 'MUI v5 · Geist Sans & Mono' },
  { k: '部署', v: 'Vercel' },
  { k: '源码', v: 'MIT 协议' },
];

const CONTACT = [
  { k: 'GitHub', v: 'github.com/yourname/toolkit-page', href: 'https://github.com/yourname/toolkit-page', icon: IconExternal },
  { k: 'llms.txt', v: '/llms.txt', href: '/llms.txt', icon: IconChat },
  { k: '工具索引', v: '/tools', href: '/tools', icon: IconArrow },
];

export default function AboutPage() {
  return (
    <Box>
      {/* 刊头 */}
      <Box sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 4, md: 6 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 3, alignItems: 'center' }}
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
            sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)' }}
          >
            §00 · About
          </Typography>
        </Stack>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 44, md: 80 },
            fontWeight: 500,
            lineHeight: 1.0,
            letterSpacing: '-0.035em',
            maxWidth: 920,
          }}
        >
          一个
          <Box
            component="span"
            sx={{
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'text.secondary',
            }}
          >
            极简
          </Box>
          <br />
          工具集合。
        </Typography>
      </Box>

      {/* 技术栈 */}
      <Box sx={{ pt: { xs: 4, md: 6 }, borderTop: 1, borderColor: 'divider' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 4, alignItems: 'baseline' }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-geist-mono)' }}
          >
            §01
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>
            技术栈
          </Typography>
        </Stack>

        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {STACK.map((s, i) => (
            <Box
              key={s.k}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '40px 1fr', md: '40px 200px 1fr' },
                alignItems: 'center',
                gap: { xs: 2, md: 4 },
                py: 2.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontFamily: 'var(--font-geist-mono)', color: 'text.secondary' }}
              >
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {s.k}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {s.v}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* 链接（带 icon） */}
      <Box sx={{ mt: { xs: 6, md: 10 }, pt: { xs: 4, md: 6 }, borderTop: 1, borderColor: 'divider' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 4, alignItems: 'baseline' }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-geist-mono)' }}
          >
            §02
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>
            链接
          </Typography>
        </Stack>

        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {CONTACT.map((c, i) => {
            const isInternal = c.href.startsWith('/');
            const Icon = c.icon;
            return (
              <MuiLink
                key={c.k}
                href={c.href}
                {...(isInternal
                  ? { component: NextLink }
                  : { target: '_blank', rel: 'noopener' })}
                underline="none"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '32px 32px 1fr', md: '40px 40px 200px 1fr 24px' },
                  alignItems: 'center',
                  gap: { xs: 2, md: 4 },
                  py: 2.5,
                  color: 'inherit',
                  transition: 'background-color 160ms ease, padding-inline 200ms ease',
                  '&:hover': { bgcolor: 'rgba(15, 31, 29, 0.03)', pl: 1.5 },
                  '&:hover .c-arrow': { transform: 'translateX(4px)', color: 'primary.main' },
                  '&:hover .c-icon': { color: 'primary.main' },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'var(--font-geist-mono)', color: 'text.secondary' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </Typography>
                <Box
                  className="c-icon"
                  sx={{ color: 'text.secondary', transition: 'color 200ms ease', display: 'flex' }}
                >
                  <Icon />
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {c.k}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {c.v}
                </Typography>
                <Box
                  className="c-arrow"
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    color: 'text.secondary',
                    transition: 'transform 200ms ease, color 200ms ease',
                  }}
                >
                  →
                </Box>
              </MuiLink>
            );
          })}
        </Stack>

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', mt: 6, fontFamily: 'var(--font-geist-mono)' }}
        >
          © {new Date().getFullYear()} toolkit · made local
        </Typography>
      </Box>
    </Box>
  );
}