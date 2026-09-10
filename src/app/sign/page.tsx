import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';

// 手机横屏签名页：极简、无站内导航，仅手指/触控笔手写 + 生成交接码。
// 由「电子签名」工具桌面端发起，手机扫码直达。
const SignMobile = dynamic(() => import('@/tools/sign/SignMobile'), { ssr: false });

export const metadata: Metadata = {
  title: '手写签名',
  description: '在手机或平板上横屏手写签名，生成交接二维码后由电脑端扫描同步，全程本地完成。',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function Page() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafaf7' }}>
      <SignMobile />
    </Box>
  );
}