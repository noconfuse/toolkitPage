'use client';

import * as React from 'react';
import Box from '@mui/material/Box';

/**
 * 全局细噪点 overlay，pointer-events: none
 * 纯 CSS/SVG 实现，零网络请求
 * 强度 0.025 — 极轻，几乎不可见但能消除数字"平面感"
 */
export default function NoiseOverlay() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        opacity: 0.035,
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        backgroundSize: '160px 160px',
      }}
    />
  );
}