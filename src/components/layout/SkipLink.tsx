'use client';

import * as React from 'react';
import Box from '@mui/material/Box';

export default function SkipLink() {
  return (
    <Box
      component="a"
      href="#main-content"
      sx={{
        position: 'absolute',
        left: 8,
        top: 8,
        zIndex: 9999,
        bgcolor: 'background.paper',
        color: 'text.primary',
        px: 2,
        py: 1,
        borderRadius: 1,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 600,
        transform: 'translateY(-200%)',
        transition: 'transform 160ms ease',
        '&:focus': { transform: 'translateY(0)' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      跳到主要内容
    </Box>
  );
}