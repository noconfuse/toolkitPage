import type { Metadata } from 'next';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export const metadata: Metadata = {
  title: '页面未找到',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 2,
      }}
    >
      <Typography variant="h2" sx={{ fontWeight: 800 }}>
        404
      </Typography>
      <Typography variant="h6" color="text.secondary">
        页面不存在或已被移除
      </Typography>
      <Button variant="contained" component={Link} href="/">
        回到首页
      </Button>
    </Box>
  );
}