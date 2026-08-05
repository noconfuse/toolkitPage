'use client';

import * as React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { EmotionCache } from '@emotion/cache';

// 浅色 paper / off-white 体系，参考 Linear / Cron / Notion 印刷感
// 灵感："设计刊物" 纸面 + 深青墨水
const PAPER = '#f7f6f3'; // 暖偏白底
const PAPER_RAISED = '#ffffff';
const INK = '#0f1f1d'; // 接近墨色的深青
const INK_SECONDARY = '#5a6663';
const INK_TERTIARY = '#8b9490';
const ACCENT = '#0f3d3a'; // 深青墨
const ACCENT_HOVER = '#0a2d2b';
const RULE = 'rgba(15, 31, 29, 0.10)';
const RULE_SOFT = 'rgba(15, 31, 29, 0.06)';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: ACCENT,
      dark: ACCENT_HOVER,
      light: '#3a6b67',
      contrastText: '#ffffff',
    },
    background: {
      default: PAPER,
      paper: PAPER_RAISED,
    },
    text: {
      primary: INK,
      secondary: INK_SECONDARY,
      disabled: INK_TERTIARY,
    },
    divider: RULE,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: [
      'var(--font-geist-sans)',
      '-apple-system',
      'BlinkMacSystemFont',
      'system-ui',
      'sans-serif',
    ].join(','),
    // Editorial 风格: 标题用 display 字号，紧字距
    h1: {
      fontWeight: 500,
      letterSpacing: '-0.035em',
      lineHeight: 1.02,
    },
    h2: {
      fontWeight: 500,
      letterSpacing: '-0.025em',
      lineHeight: 1.08,
    },
    h3: {
      fontWeight: 500,
      letterSpacing: '-0.02em',
      lineHeight: 1.15,
    },
    h4: {
      fontWeight: 500,
      letterSpacing: '-0.015em',
      lineHeight: 1.2,
    },
    h5: {
      fontWeight: 500,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.005em',
    },
    body1: { lineHeight: 1.65, fontSize: 16 },
    body2: { lineHeight: 1.6 },
    subtitle1: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 },
    overline: {
      letterSpacing: 1.5,
      fontSize: 11,
      fontWeight: 500,
      textTransform: 'uppercase',
    },
  },
  transitions: {
    duration: {
      shortest: 120,
      shorter: 160,
      short: 200,
      standard: 240,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: PAPER,
          // 极淡的纸纹噪点
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>")`,
          backgroundSize: '180px 180px',
        },
        'input, code, kbd, samp, pre': {
          fontVariantNumeric: 'tabular-nums',
        },
        h1: { textWrap: 'balance' },
        h2: { textWrap: 'balance' },
        h3: { textWrap: 'balance' },
        h4: { textWrap: 'balance' },
        '::selection': {
          backgroundColor: ACCENT,
          color: '#fff',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: true },
      styleOverrides: {
        root: {
          borderRadius: 6,
          paddingInline: 16,
          paddingBlock: 8,
          transition: 'background-color 160ms ease, color 160ms ease, transform 100ms ease',
          '&:active': { transform: 'translateY(0.5px)' },
        },
        contained: {
          backgroundColor: INK,
          color: '#fff',
          boxShadow: 'none',
          '&:hover': { backgroundColor: ACCENT, boxShadow: 'none' },
        },
        outlined: {
          borderColor: RULE,
          color: INK,
          '&:hover': {
            borderColor: INK,
            backgroundColor: 'transparent',
            color: INK,
          },
        },
        text: {
          color: INK,
          '&:hover': { backgroundColor: RULE_SOFT },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${RULE_SOFT}`,
          boxShadow: 'none',
        },
      },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: {
        root: { color: INK },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          border: `1px solid ${RULE}`,
          backgroundColor: 'transparent',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none', boxShadow: 'none' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: RULE },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: INK,
          color: '#fff',
          fontSize: 12,
          borderRadius: 4,
        },
      },
    },
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache: EmotionCache = createCache({ key: 'mui', prepend: true });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}