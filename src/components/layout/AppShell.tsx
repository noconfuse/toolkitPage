'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Footer from './Footer';

// 页面统一水平内边距（移动端更紧凑，桌面端舒展）。
// 全宽布局：顶栏/主内容/底部都不再套 max-width 容器，
// 内容自然撑满视口，左右留白由该 padding 统一控制。
const HORIZONTAL_PADDING = { xs: 2, sm: 3, md: 4, lg: 5 };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 工具页由 tools/layout 自己管理 padding（侧边栏顶到上下两边、右侧内容区自行加内边距），
  // 这里不再给主内容套 padding，避免两处重复。
  const isToolRoute = pathname.startsWith('/tools');

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 — 极简单行：Logo + 关于（工具导航已迁移到工具页侧边栏） */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'rgba(247, 246, 243, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          direction="row"
          sx={{
            height: 56,
            alignItems: 'center',
            px: HORIZONTAL_PADDING,
          }}
        >
          {/* Logo */}
          <Box
            component={NextLink}
            href="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              textDecoration: 'none',
              color: 'inherit',
              fontFamily: 'var(--font-geist-mono)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '4px',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              T
            </Box>
            Toolkit
          </Box>

          <Stack direction="row" sx={{ ml: 3, alignItems: 'center' }}>
            <Button
              component={NextLink}
              href="/about"
              size="small"
              sx={{
                color: pathname === '/about' ? 'text.primary' : 'text.secondary',
                fontSize: 14,
                fontWeight: 500,
                px: 1.25,
                py: 0.5,
                minWidth: 0,
                '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
              }}
            >
              关于
            </Button>
          </Stack>

          <Box sx={{ flex: 1 }} />
        </Stack>
      </Box>

      {/* 主内容（全宽；工具页由 tools/layout 自行管理内边距） */}
      <Box
        component="main"
        id="main-content"
        sx={{
          flex: 1,
          width: '100%',
          px: isToolRoute ? 0 : HORIZONTAL_PADDING,
          pt: isToolRoute ? 0 : { xs: 3, md: 5 },
          pb: isToolRoute ? 0 : { xs: 6, md: 10 },
        }}
      >
        {children}
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ px: HORIZONTAL_PADDING }}>
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}