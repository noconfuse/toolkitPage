'use client';

import * as React from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';

export default function Footer() {
  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        py: 4,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontFamily: 'var(--font-geist-mono)',
          }}
        >
          © {new Date().getFullYear()} toolkit · made local
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 3,
            fontSize: 13,
            color: 'text.secondary',
          }}
        >
          <MuiLink component={NextLink} href="/about" color="inherit">
            关于
          </MuiLink>
          <MuiLink component={NextLink} href="/tools" color="inherit">
            工具
          </MuiLink>
          <MuiLink
            href="/llms.txt"
            target="_blank"
            rel="noopener"
            color="inherit"
          >
            llms.txt
          </MuiLink>
        </Box>
      </Box>
    </Box>
  );
}