'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { CATEGORIES, TOOLS } from '@/lib/tools-registry';
import Footer from './Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [toolsAnchor, setToolsAnchor] = React.useState<HTMLElement | null>(null);
  const open = Boolean(toolsAnchor);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 — 极简单行 */}
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
                size="small"
                onClick={(e) => setToolsAnchor(e.currentTarget)}
                endIcon={
                  <KeyboardArrowDownIcon
                    sx={{
                      fontSize: 16,
                      transition: 'transform 200ms ease',
                      transform: open ? 'rotate(180deg)' : 'none',
                    }}
                  />
                }
                sx={{
                  color: 'text.secondary',
                  fontSize: 14,
                  fontWeight: 500,
                  px: 1.25,
                  py: 0.5,
                  minWidth: 0,
                  '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
                }}
              >
                工具
              </Button>
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

        {/* 工具下拉 */}
        <Popover
          open={open}
          anchorEl={toolsAnchor}
          onClose={() => setToolsAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                ml: -1,
                borderRadius: 1.5,
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 10px 40px -10px rgba(15, 31, 29, 0.12)',
                minWidth: 340,
                maxWidth: 420,
              },
            },
          }}
        >
          <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {CATEGORIES.map((cat) => (
              <Box key={cat.id}>
                <Typography
                  variant="overline"
                  sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}
                >
                  {cat.label}
                </Typography>
                <Stack spacing={1.5}>
                  {TOOLS.filter((t) => t.categoryId === cat.id).map((tool) => {
                    const active = pathname === tool.href;
                    return (
                      <Box
                        key={tool.id}
                        component={NextLink}
                        href={tool.href}
                        onClick={() => setToolsAnchor(null)}
                        sx={{
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                          py: 0.5,
                          transition: 'color 160ms ease',
                          '&:hover .tool-title': { color: 'primary.main' },
                        }}
                      >
                        <Typography
                          className="tool-title"
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            color: active ? 'primary.main' : 'text.primary',
                          }}
                        >
                          {tool.title}
                          {tool.available ? null : (
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ ml: 0.5, color: 'text.disabled' }}
                            >
                              · 即将
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Box>
        </Popover>
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