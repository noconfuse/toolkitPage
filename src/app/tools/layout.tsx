'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuIcon from '@mui/icons-material/Menu';
import Drawer from '@mui/material/Drawer';
import { CATEGORIES, TOOLS_BY_CATEGORY, type ToolCategory, type Tool } from '@/lib/tools-registry';

const SIDEBAR_W = 220;

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // 每个分类的展开/收起状态（默认全展开）
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c: ToolCategory) => [c.id, true])),
  );

  const toggleCat = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const sidebarContent = (
    <Box sx={{ py: 2 }}>
      <Typography
        variant="overline"
        sx={{
          px: 2,
          display: 'block',
          mb: 1.5,
          color: 'text.secondary',
          fontFamily: 'var(--font-geist-mono)',
          letterSpacing: '0.08em',
        }}
      >
        全部工具
      </Typography>

      {TOOLS_BY_CATEGORY.map(({ category: cat, tools }) => {
        const expanded = open[cat.id] ?? true;
        const hasActive = tools.some((t: Tool) => pathname === t.href);

        return (
          <Box key={cat.id} sx={{ mb: 0.5 }}>
            {/* 分类标题：点击展开/收起 */}
            <Box
              onClick={() => toggleCat(cat.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 0.75,
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: 'action.hover' },
                borderRadius: 0,
              }}
            >
              <Box
                sx={{
                  fontSize: 16,
                  color: hasActive ? 'primary.main' : 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {cat.icon}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontWeight: 600,
                  fontSize: 13,
                  color: hasActive ? 'primary.main' : 'text.primary',
                }}
              >
                {cat.label}
              </Typography>
              <KeyboardArrowDownIcon
                sx={{
                  fontSize: 16,
                  color: 'text.disabled',
                  transition: 'transform 200ms ease',
                  transform: expanded ? 'none' : 'rotate(-90deg)',
                }}
              />
            </Box>

            {/* 工具列表 */}
            <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
              <Stack sx={{ pb: 1 }}>
                {tools.map((tool: Tool) => {
                  const active = pathname === tool.href;
                  return (
                    <Box
                      key={tool.id}
                      component={NextLink}
                      href={tool.href}
                      onClick={() => setMobileOpen(false)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        pl: 5.25,
                        pr: 2,
                        py: 0.6,
                        textDecoration: 'none',
                        color: active ? 'primary.main' : 'text.secondary',
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        bgcolor: active ? 'action.selected' : 'transparent',
                        borderRight: active ? '2px solid' : '2px solid transparent',
                        borderColor: active ? 'primary.main' : 'transparent',
                        transition: 'all 150ms ease',
                        '&:hover': {
                          color: 'primary.main',
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          color: active ? 'primary.main' : 'text.disabled',
                        }}
                      >
                        {tool.icon}
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.4 }}>
                        {tool.title}
                        {!tool.available && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ ml: 0.5, color: 'text.disabled', fontSize: 10 }}
                          >
                            即将
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      {/* 移动端：汉堡按钮 */}
      <IconButton
        onClick={() => setMobileOpen(true)}
        sx={{
          display: { xs: 'inline-flex', lg: 'none' },
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1200,
          bgcolor: 'primary.main',
          color: '#fff',
          boxShadow: 3,
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <MenuIcon />
      </IconButton>

      {/* 移动端抽屉 */}
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { xs: 'block', lg: 'none' } }}
        slotProps={{
          paper: { sx: { width: SIDEBAR_W, bgcolor: 'background.paper' } },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* 桌面端侧边栏 */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: SIDEBAR_W,
          flexShrink: 0,
          position: 'sticky',
          top: 72, // 56(header) + 16(gap)
          maxHeight: 'calc(100vh - 88px)',
          overflowY: 'auto',
          borderRight: 1,
          borderColor: 'divider',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
        }}
      >
        {sidebarContent}
      </Box>

      {/* 主内容 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
