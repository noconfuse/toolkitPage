'use client';

// 工作流胶囊：结果态的串流出口，渲染在工具右侧栏底部（显眼的主按钮样式）。
// 把当前工具的产物（FlowImage[]）写入 flowStore，跳转到下一个图片工具页（?flow=<id>），
// 实现「裁剪 → 压缩 → 转换」这类单线串流。批量工具整包消费、单图工具逐张处理，
// 统一抽象为图片集合，因此对任意产物数量都兼容。
//
// 候选规则：图片分类下可承接图片输入的工具（text 输入的生成器只能做链路起点），
// 排除当前工具自身。集合 >1 张且下一步工具 output 为 'single' 时给出「N 张 → 1 张」收敛提示。

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { createFlow, type FlowImage } from '@/lib/flow';
import { TOOLS } from '@/lib/tools-registry';
import { SidebarTitle } from '@/components/tools/ToolWorkbench';

export default function FlowPill({ images }: { images: FlowImage[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  // 下一站候选：图片工具 + 可承接图片输入 + 非当前工具
  const candidates = React.useMemo(
    () =>
      TOOLS.filter(
        (t) => t.categoryId === 'image' && t.flow && t.flow.input !== 'text' && t.href !== pathname,
      ),
    [pathname],
  );

  const go = (href: string) => {
    const id = createFlow(images);
    setAnchorEl(null);
    router.push(`${href}?flow=${id}`);
  };

  return (
    <Box>
      <SidebarTitle>继续处理</SidebarTitle>

      {/* 主按钮：渐变深色胶囊，悬停上浮，明显区别于普通文字链接 */}
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          pl: 1.5,
          pr: 1,
          py: 1.1,
          borderRadius: 1.5,
          border: 1,
          borderColor: 'rgba(15, 61, 58, 0.3)',
          background: 'linear-gradient(135deg, #0f3d3a 0%, #17605a 100%)',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(15, 61, 58, 0.25)',
          transition: 'box-shadow 160ms ease, transform 160ms ease',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(15, 61, 58, 0.35)',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <ArrowForwardIcon sx={{ fontSize: 18, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>继续处理</Typography>
          <Chip
            label={`${images.length} 张图`}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              color: '#0f3d3a',
              bgcolor: 'rgba(255,255,255,0.92)',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
        <KeyboardArrowDownIcon sx={{ fontSize: 20, opacity: 0.85, flexShrink: 0 }} />
      </Box>

      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
        选择下一步工具，产物将自动传入，无需重新上传
      </Typography>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.25, maxWidth: 360, borderRadius: 1.5 } } }}
      >
        <Typography
          variant="overline"
          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', mb: 1 }}
        >
          下一步工具
        </Typography>
        <Stack spacing={0.5}>
          {candidates.map((t) => {
            const shrink = t.flow?.output === 'single' && images.length > 1;
            return (
              <Stack
                key={t.id}
                direction="row"
                spacing={1}
                onClick={() => go(t.href)}
                sx={{
                  alignItems: 'center',
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(15, 61, 58, 0.06)' },
                }}
              >
                <Box sx={{ display: 'flex', color: 'text.secondary', fontSize: 17 }}>{t.icon}</Box>
                <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }}>
                  {t.title}
                </Typography>
                {shrink ? (
                  <Chip
                    label={`${images.length} 张 → 1 张`}
                    size="small"
                    sx={{ height: 20, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }}
                  />
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </Popover>
    </Box>
  );
}
