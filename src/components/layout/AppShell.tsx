'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Footer from './Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
        <Container maxWidth="lg">
          <Stack
            direction="row"
            sx={{ height: 56, alignItems: 'center' }}
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
        </Container>
      </Box>

      {/* 主内容 */}
      <Box
        component="main"
        id="main-content"
        sx={{ flex: 1, width: '100%' }}
      >
        <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 6, md: 10 } }}>
          {children}
        </Container>
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="lg">
          <Footer />
        </Container>
      </Box>
    </Box>
  );
}