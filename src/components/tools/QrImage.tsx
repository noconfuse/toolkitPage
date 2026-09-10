'use client';

// 二维码图片组件：调用 qr-code-styling 的 getRawData('png') 生成 blobe → objectURL，
// 用 <img> 展示。比 append(容器) 更健壮，不依赖宿主 DOM 尺寸/时机（InDialog/弹层中也稳定）。
// 所有内容在本机生成，不上传。

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import QRCodeStyling from 'qr-code-styling';

export function QrImage({ data, size = 260 }: { data: string | null; size?: number }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!data) return;
    let alive = true;
    (async () => {
      try {
        const inst = new QRCodeStyling({
          type: 'canvas',
          width: size,
          height: size,
          data,
          margin: 0,
          qrOptions: { errorCorrectionLevel: 'M' },
          dotsOptions: { type: 'rounded', color: '#0f1f1d' },
          cornersSquareOptions: { type: 'extra-rounded', color: '#0f1f1d' },
          cornersDotOptions: { type: 'dot', color: '#0f1f1d' },
          backgroundOptions: { color: '#ffffff' },
        });
        const blob = await inst.getRawData('png');
        if (!alive || !(blob instanceof Blob)) return;
        setUrl(URL.createObjectURL(blob));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [data, size]);

  if (failed) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          color: 'error.main',
        }}
      >
        <Typography variant="caption">二维码生成失败</Typography>
      </Box>
    );
  }
  return url ? (
    <img
      src={url}
      alt="二维码"
      style={{ width: size, height: size, display: 'block' }}
    />
  ) : (
    <Box
      sx={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        color: 'text.disabled',
      }}
    >
      <Typography variant="caption">生成中…</Typography>
    </Box>
  );
}