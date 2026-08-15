import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import { SITE_URL } from '@/lib/site-config';
import { IconArrow } from '@/components/visuals';

const TITLE = '关于本站';
const DESCRIPTION =
  '一个独立开发者在日常工作中高频使用的小工具集合。本地优先，文件不会上传。';

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

const LINKS = [
  { k: 'llms.txt', v: '为 AI 准备的站点清单', href: '/llms.txt' },
  { k: '工具索引', v: '查看全部工具', href: '/tools' },
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

      {/* §01 为什么会做 */}
      <Box sx={{ pt: { xs: 4, md: 6 }, borderTop: 1, borderColor: 'divider' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 3, alignItems: 'baseline' }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-geist-mono)' }}
          >
            §01
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>
            为什么会做
          </Typography>
        </Stack>
        <Stack spacing={2.5} sx={{ maxWidth: 720, color: 'text.secondary', fontSize: 16, lineHeight: 1.75 }}>
          <Typography variant="body1">
            这是一个独立开发者在日常工作中会高频使用的小工具集合。
          </Typography>
          <Typography variant="body1">
            起因很朴素：平时总要在网上找 PDF 合并、图片压缩、二维码生成这类小工具，每用一个都要上传一次文件，还要看一堆广告。把这些整理成自己顺手的样子，比每次重新搜索更省事。
          </Typography>
          <Typography variant="body1">
            所以这里没有账号系统、没有付费墙、没有「邀请好友得奖励」。打开就能用，用完就走。
          </Typography>
          <Typography variant="body1">
            后续会持续更新——遇到新的常用场景会加进来；已有工具做得不顺手的地方也会改。
          </Typography>
        </Stack>
      </Box>

      {/* §02 使用约定 */}
      <Box sx={{ pt: { xs: 6, md: 8 }, borderTop: 1, borderColor: 'divider' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 3, alignItems: 'baseline' }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-geist-mono)' }}
          >
            §02
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>
            使用约定
          </Typography>
        </Stack>
        <Stack spacing={2.5} sx={{ maxWidth: 720, color: 'text.secondary', fontSize: 16, lineHeight: 1.75 }}>
          <Typography variant="body1">
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>本地优先。</Box>{' '}
            能用浏览器完成的就不上服务器。你的文件不会上传——打开浏览器开发者工具看一眼网络请求就能确认这一点。
          </Typography>
          <Typography variant="body1">
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>无追踪。</Box>{' '}
            没有第三方统计脚本在后台悄悄记录你的行为；如果将来接入流量统计，会在这一页明确告知。
          </Typography>
          <Typography variant="body1">
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>诚实标注。</Box>{' '}
            工具的能力边界会写清楚——不能做的、依赖浏览器版本的、需要付费 API 的，都会注明。
          </Typography>
          <Typography variant="body1">
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>持续可用。</Box>{' '}
            一旦一个工具上线，不会静默下线或大幅改版到原来的功能找不到。
          </Typography>
        </Stack>
      </Box>

      {/* §03 反馈与链接 */}
      <Box sx={{ pt: { xs: 6, md: 8 }, pb: { xs: 4, md: 6 }, borderTop: 1, borderColor: 'divider' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 3, alignItems: 'baseline' }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-geist-mono)' }}
          >
            §03
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>
            反馈与链接
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ maxWidth: 720, color: 'text.secondary', fontSize: 16, lineHeight: 1.75, mb: 4 }}>
          如果某个工具坏了、缺了常用功能，或者使用上哪里别扭，告诉我，我会尽快处理。
        </Typography>

        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {LINKS.map((c, i) => (
            <MuiLink
              key={c.k}
              href={c.href}
              component={NextLink}
              underline="none"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '40px 1fr 24px', md: '40px 200px 1fr 24px' },
                alignItems: 'center',
                gap: { xs: 2, md: 4 },
                py: 2.5,
                color: 'inherit',
                transition: 'background-color 160ms ease, padding-inline 200ms ease',
                '&:hover': { bgcolor: 'rgba(15, 31, 29, 0.03)', pl: 1.5 },
                '&:hover .c-arrow': { transform: 'translateX(4px)', color: 'primary.main' },
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontFamily: 'var(--font-geist-mono)', color: 'text.secondary' }}
              >
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {c.k}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {c.v}
              </Typography>
              <Box
                className="c-arrow"
                sx={{
                  display: 'flex',
                  color: 'text.secondary',
                  transition: 'transform 200ms ease, color 200ms ease',
                }}
              >
                <IconArrow />
              </Box>
            </MuiLink>
          ))}
        </Stack>
      </Box>

      {/* §04 关注公众号 */}
      <Box sx={{ pt: { xs: 6, md: 8 }, pb: { xs: 4, md: 6 }, borderTop: 1, borderColor: 'divider' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 3, alignItems: 'baseline' }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-geist-mono)' }}
          >
            §04
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>
            关注公众号
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ maxWidth: 720, color: 'text.secondary', fontSize: 16, lineHeight: 1.75, mb: 4 }}>
          独立开发者的日常记录：新工具上线、踩坑笔记、产品思考，都在这里第一时间同步。
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.5 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qrcode_for_gh_b6f16bbc0480_344.jpg"
            alt="公众号二维码"
            width={180}
            height={180}
            style={{ borderRadius: 8, border: '1px solid rgba(15, 31, 29, 0.12)' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)' }}>
            微信扫一扫 · 关注公众号
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          pt: 4,
          pb: { xs: 2, md: 4 },
        }}
      >
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', fontFamily: 'var(--font-geist-mono)' }}
        >
          © {new Date().getFullYear()} toolkit · made local
        </Typography>
      </Box>
    </Box>
  );
}