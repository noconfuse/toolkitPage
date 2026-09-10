'use client';

// 手机横屏签名页（内嵌于 /sign）：
// 桌面端「发起手机签名」出示的二维码指向本页；手机扫开后是横屏优先的极简签名界面，
// 写好签名点「生成交接码」，桌面端摄像头扫码即回传。全程本地，不上传。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DrawIcon from '@mui/icons-material/Draw';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import { QrImage } from '@/components/tools/QrImage';
import {
  useContainSize,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import { SignaturePad } from '@/tools/image/signature/SignaturePad';
import {
  SIG_W,
  SIG_H,
  PEN_WIDTHS,
  FONT_STYLES,
  renderCropPng,
  encodeStrokes,
  lineWidthOf,
  type SignatureStroke,
} from '@/tools/image/signature/_lib/signature';

export default function SignMobile() {
  const [strokes, setStrokes] = React.useState<SignatureStroke[]>([]);
  const [penKey, setPenKey] = React.useState(PEN_WIDTHS[1].key);
  const [portrait, setPortrait] = React.useState(true);
  const [showQr, setShowQr] = React.useState(false);
  const [payload, setPayload] = React.useState<string | null>(null);
  const [payloadBlobUrl, setPayloadBlobUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const drawingRef = React.useRef(false);
  const hasStrokes = strokes.some((s) => s.points.length >= 2);

  const [fitRef, fitSize] = useContainSize(SIG_W, SIG_H, true);

  // 横竖屏监听：竖屏时盖一层「请旋转」提示，签名区暂不响应
  React.useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const onStrokeStart = React.useCallback(
    (p: { x: number; y: number }) => {
      drawingRef.current = true;
      setStrokes((prev) => [...prev, { points: [p], lineWidth: lineWidthOf(penKey) }]);
    },
    [penKey],
  );
  const onStrokeMove = React.useCallback((p: { x: number; y: number }) => {
    if (!drawingRef.current) return;
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const stroke = next[next.length - 1];
      const last = stroke.points[stroke.points.length - 1];
      if (Math.abs(p.x - last.x) < 0.4 && Math.abs(p.y - last.y) < 0.4) return prev;
      next[next.length - 1] = { ...stroke, points: [...stroke.points, p] };
      return next;
    });
  }, []);
  const onStrokeEnd = React.useCallback(() => {
    drawingRef.current = false;
  }, []);

  const clear = () => setStrokes([]);

  // 生成交接码：同时产出一份 PNG 供「直接下载」兜底
  const generate = () => {
    const p = encodeStrokes(strokes);
    if (!p) {
      setError('笔迹过于复杂，无法装进二维码，请简化后重试');
      return;
    }
    setError(null);
    setPayload(p);
    setPayloadBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    const { canvas } = renderCropPng({ strokes, mode: 'draw', fontKey: FONT_STYLES[0].key, typedText: '' });
    canvas.toBlob((blob) => {
      if (blob) setPayloadBlobUrl(URL.createObjectURL(blob));
    }, 'image/png');
    setShowQr(true);
  };

  const downloadPng = () => {
    if (!payloadBlobUrl) return;
    const a = document.createElement('a');
    a.href = payloadBlobUrl;
    a.download = '签名.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fafaf7',
        overflow: 'hidden',
      }}
    >
      {/* 极简顶栏 */}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: 1,
          px: 2.5,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <DrawIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 14 }}>
          手写签名
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          仅在本机，不上传
        </Typography>
      </Stack>

      {/* 签名区：横屏优先 contain-fit 撑满 */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2.5,
        }}
      >
        <Box
          ref={fitRef}
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: fitSize ? fitSize.w : '100%',
              height: fitSize ? fitSize.h : 'auto',
              maxWidth: '100%',
              borderRadius: 1.5,
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              bgcolor: '#fff',
              backgroundImage: dropzoneBg,
              backgroundSize: dropzoneBgSize,
              backgroundPosition: dropzoneBgPos,
            }}
          >
            <SignaturePad
              strokes={strokes}
              mode="draw"
              fontKey={FONT_STYLES[0].key}
              typedText=""
              penEnabled={!portrait}
              onStrokeStart={onStrokeStart}
              onStrokeMove={onStrokeMove}
              onStrokeEnd={onStrokeEnd}
            />
            {!hasStrokes && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.disabled',
                  fontSize: 13,
                  pointerEvents: 'none',
                }}
              >
                用手指在横屏区域书写签名
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* 底部操作栏 */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          px: 2.5,
          py: 1.75,
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          flexWrap: 'nowrap',
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {PEN_WIDTHS.map((p) => (
            <Box
              key={p.key}
              onClick={() => setPenKey(p.key)}
              sx={{
                width: 44,
                height: 34,
                borderRadius: 1,
                border: 1,
                borderColor: penKey === p.key ? 'primary.main' : 'divider',
                bgcolor: penKey === p.key ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                color: penKey === p.key ? 'primary.main' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <Box
                sx={{
                  height: 3,
                  borderRadius: 2,
                  bgcolor: 'currentColor',
                  width: p.key === 'thin' ? 10 : p.key === 'medium' ? 16 : 24,
                }}
              />
            </Box>
          ))}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="清空重新书写">
          <span>
            <IconButton size="small" onClick={clear} disabled={!hasStrokes} sx={{ color: 'text.secondary' }}>
              <RestartAltIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Button
          variant="contained"
          size="large"
          onClick={generate}
          disabled={!hasStrokes}
          startIcon={<QrCode2Icon />}
          sx={{ px: 2.5, py: 1, borderRadius: 1.5, fontSize: 14, whiteSpace: 'nowrap' }}
        >
          生成交接码
        </Button>
      </Stack>

      {error && (
        <Typography
          variant="caption"
          sx={{ color: 'error.main', px: 2.5, py: 1, textAlign: 'center', fontSize: 12 }}
        >
          {error}
        </Typography>
      )}

      {/* 竖屏遮罩：只在签名阶段拦截，不动交接码展示 */}
      {portrait && !showQr && (
        <Stack
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'rgba(247, 246, 243, 0.97)',
            p: 4,
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: 2,
              borderColor: 'primary.main',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'tk-float 2.2s ease-in-out infinite alternate',
              '@keyframes tk-float': { from: { transform: 'rotate(-90deg) translateY(2px)' }, to: { transform: 'rotate(-90deg) translateY(-4px)' } },
            }}
          >
            <ScreenRotationIcon sx={{ fontSize: 34 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 22 }}>
            请将手机横过来
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 320 }}>
            横屏后签名区会自动铺满整个屏幕，书写更顺滑。
          </Typography>
          <Button size="small" variant="text" color="inherit" onClick={() => setPortrait(false)} sx={{ mt: 1, color: 'text.secondary' }}>
            仍要竖屏使用
          </Button>
        </Stack>
      )}

      {/* 交接码全屏视图 */}
      {showQr && payload && (
        <Stack
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: '#fff',
            p: 3,
          }}
        >
          <QrImage data={payload} size={300} />
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: 15, textAlign: 'center' }}>
            请让电脑摄像头对准此屏幕
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button size="medium" variant="outlined" onClick={() => setShowQr(false)} startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />}>
              返回修改
            </Button>
            <Button size="medium" variant="contained" onClick={downloadPng} disabled={!payloadBlobUrl} startIcon={<DownloadIcon sx={{ fontSize: 17 }} />}>
              下载 PNG
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}