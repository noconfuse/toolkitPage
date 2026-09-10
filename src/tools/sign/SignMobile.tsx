'use client';

// 手机横屏签名页（内嵌于 /sign）：
// 桌面端「发起手机签名」出示的二维码指向本页。整屏即书写区——无固定顶栏/底栏，
// 仅必要的提示与操作以浮层形式悬浮四角，把手写空间让到最大。
// 写好点右下角「生成交接码」，桌面端摄像头扫码即回传。全程本地，不上传。

import * as React from 'react';
import NextLink from 'next/link';
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

// 角落浮层通用外观：半透明白 + 毛玻璃 + 细描边
const pill = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 1.25,
  py: 0.65,
  borderRadius: '999px',
  bgcolor: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(6px)',
  border: 1,
  borderColor: 'rgba(15,31,29,0.12)',
  boxShadow: '0 2px 8px rgba(15,31,29,0.08)',
} as const;

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

  // 画板逻辑空间随屏幕比例自适应：宽固定 SIG_W，高按屏幕宽高比换算，
  // 画布因此能铺满整屏且不拉伸。协议携带宽高，对端按此空间渲染。
  const screenRef = React.useRef<HTMLDivElement | null>(null);
  const [space, setSpace] = React.useState<{ w: number; h: number }>({ w: SIG_W, h: SIG_H });

  React.useLayoutEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setSpace({ w: SIG_W, h: Math.max(120, Math.round((SIG_W * r.height) / r.width)) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const p = encodeStrokes(strokes, { width: space.w, height: space.h });
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
    const { canvas } = renderCropPng(
      { strokes, mode: 'draw', fontKey: FONT_STYLES[0].key, typedText: '' },
      space.w,
      space.h,
    );
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
      ref={screenRef}
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: '#f6f5f1',
        backgroundImage: dropzoneBg,
        backgroundSize: dropzoneBgSize,
        backgroundPosition: dropzoneBgPos,
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* 书写画布：铺满整屏，逻辑空间随屏幕比例自适应，无留白、不拉伸 */}
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <SignaturePad
          strokes={strokes}
          mode="draw"
          fontKey={FONT_STYLES[0].key}
          typedText=""
          penEnabled={!portrait}
          width={space.w}
          height={space.h}
          onStrokeStart={onStrokeStart}
          onStrokeMove={onStrokeMove}
          onStrokeEnd={onStrokeEnd}
        />

        {/* 书写引导基线 */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '68%',
            borderTop: '1px dashed rgba(15,31,29,0.16)',
            pointerEvents: 'none',
          }}
        />

        {/* 空态提示 */}
        {!hasStrokes && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
              <Typography
                sx={{
                  bgcolor: 'rgba(255,255,255,0.78)',
                  backdropFilter: 'blur(4px)',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  color: 'text.secondary',
                  fontSize: 14,
                }}
              >
                用手指书写签名
              </Typography>
            </Box>
          )}
      </Box>

      {/* ───────── 四角浮层：左上标题 · 右上隐私 · 左下笔触/清空 · 右下交接码 ───────── */}
      {/* 左上：站点入口 */}
      <Box
        sx={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          zIndex: 40,
        }}
      >
        <Box
          component={NextLink}
          href="/"
          sx={{
            ...pill,
            display: 'inline-flex',
            textDecoration: 'none',
            color: 'text.primary',
          }}
        >
          <DrawIcon sx={{ fontSize: 15, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>手写签名</Typography>
        </Box>
      </Box>

      {/* 右上：隐私提示 */}
      <Box
        sx={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
          zIndex: 40,
        }}
      >
        <Box sx={pill}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>仅本机 · 不上传</Typography>
        </Box>
      </Box>

      {/* 左下：笔触 + 清空 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <Box sx={{ ...pill, gap: 0.75, py: 0.6 }}>
          {PEN_WIDTHS.map((p) => (
            <Box
              key={p.key}
              onClick={() => setPenKey(p.key)}
              sx={{
                width: 40,
                height: 28,
                borderRadius: 1,
                border: 1,
                borderColor: penKey === p.key ? 'primary.main' : 'rgba(15,31,29,0.15)',
                bgcolor: penKey === p.key ? 'rgba(15,61,58,0.08)' : 'transparent',
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
                  width: p.key === 'thin' ? 9 : p.key === 'medium' ? 15 : 22,
                }}
              />
            </Box>
          ))}
        </Box>
        <Tooltip title="清空重写">
          <span>
            <IconButton size="small" onClick={clear} disabled={!hasStrokes} sx={{ color: 'text.secondary' }}>
              <RestartAltIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* 右下：主操作「生成交接码」 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
          zIndex: 40,
        }}
      >
        <Button
          variant="contained"
          size="large"
          onClick={generate}
          disabled={!hasStrokes}
          startIcon={<QrCode2Icon />}
          sx={{
            px: 3,
            py: 1.15,
            borderRadius: '999px',
            fontSize: 14,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px rgba(15,61,58,0.28)',
            textTransform: 'none',
          }}
        >
          生成交接码
        </Button>
      </Box>

      {/* 顶部错误提示 */}
      {error && (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 45,
            bgcolor: 'rgba(255,255,255,0.9)',
            color: 'error.main',
            px: 2,
            py: 0.75,
            borderRadius: 2,
            boxShadow: 1,
            whiteSpace: 'nowrap',
          }}
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
            横屏后书写区会铺满整个屏幕。
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
            gap: 2.5,
            bgcolor: '#fff',
            p: 3,
          }}
        >
          <QrImage data={payload} size={300} />
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: 15, textAlign: 'center' }}>
            请让电脑摄像头对准此屏幕
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 320 }}>
            电脑端在本工具的「从手机接收」页面扫码即可同步；也支持直接下载。
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