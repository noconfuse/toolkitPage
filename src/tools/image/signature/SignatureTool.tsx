'use client';

// 电子签名：手写 / 文字两种方式生成透明背景的签名 PNG，导出前自动按内容包围盒裁边。
// 支持光电交接：手写笔迹可编码进二维码（手机/另一台设备展示），本机摄像头扫码后自动落到画板；
// 也可通过系统分享把 PNG 传送到其它设备。全程零服务器，内容不出设备。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import DrawIcon from '@mui/icons-material/Draw';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ShareIcon from '@mui/icons-material/Share';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
  useContainSize,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import FlowPill from '@/components/tools/FlowPill';
import { makeFlowImage, type FlowImage } from '@/lib/flow';
import { SignaturePad } from './SignaturePad';
import { QrScannerDialog } from './QrScannerDialog';
import { InvitePhoneDialog } from './InvitePhoneDialog';
import {
  SIG_W,
  SIG_H,
  FONT_STYLES,
  PEN_WIDTHS,
  renderCropPng,
  decodeStrokes,
  fontFamilyOf,
  lineWidthOf,
  type Point,
  type SignatureStroke,
} from './_lib/signature';

type Output = { blob: Blob; url: string; width: number; height: number };

const FONT_CHIP = {
  px: 1.25,
  py: 0.4,
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 0.75,
  border: 1,
  cursor: 'pointer',
  transition: 'all 160ms ease',
} as const;

export default function SignatureTool({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [mode, setMode] = React.useState<'draw' | 'type'>('draw');
  const [fontKey, setFontKey] = React.useState(FONT_STYLES[0].key);
  const [typedText, setTypedText] = React.useState('');
  const [penKey, setPenKey] = React.useState(PEN_WIDTHS[1].key);
  const [strokes, setStrokes] = React.useState<SignatureStroke[]>([]);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const drawingRef = React.useRef(false);

  const hasDrawStroke = strokes.some((s) => s.points.length >= 2);
  const hasContent = mode === 'draw' ? hasDrawStroke : !!typedText.trim();

  // ───────── 指针输入：笔迹即状态（同时也是光电交接的载荷） ─────────
  const onStrokeStart = React.useCallback(
    (p: Point) => {
      drawingRef.current = true;
      setStrokes((prev) => [...prev, { points: [p], lineWidth: lineWidthOf(penKey) }]);
    },
    [penKey],
  );
  const onStrokeMove = React.useCallback((p: Point) => {
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

  // ───────── 导出：按内容包围盒自动裁边的透明 PNG ─────────
  const cropped = React.useMemo(
    () => renderCropPng({ strokes, mode, fontKey, typedText }),
    [strokes, mode, fontKey, typedText],
  );

  const [result, setResult] = React.useState<Output | null>(null);
  React.useEffect(() => {
    if (!hasContent) {
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      return;
    }
    let alive = true;
    cropped.canvas.toBlob((blob) => {
      if (!alive || !blob) return;
      const url = URL.createObjectURL(blob);
      setResult((prev) => {
        if (prev && prev.url !== url) URL.revokeObjectURL(prev.url);
        return { blob, url, width: cropped.width, height: cropped.height };
      });
    }, 'image/png');
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent, cropped]);

  // ───────── 画板容器：按 1000:300 横向比例 contain-fit 撑满 ─────────
  const [fitRef, fitSize] = useContainSize(SIG_W, SIG_H, true);

  const flowImages: FlowImage[] = React.useMemo(
    () => (result ? [makeFlowImage(result.blob, '签名.png', result.width, result.height)] : []),
    [result],
  );

  const handleClear = () => {
    setStrokes([]);
    setTypedText('');
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = '签名.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const canShare =
    typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share;

  const share = async () => {
    if (!result || !navigator.share) return;
    const file = new File([result.blob], '签名.png', { type: 'image/png' });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      setToast('当前浏览器不支持分享文件，请直接下载');
      return;
    }
    try {
      await navigator.share({ title: '电子签名', files: [file] });
    } catch {
      /* 用户取消分享 */
    }
  };

  const invitePhone = () => {
    setInviteUrl(new URL('/sign', window.location.origin).toString());
    setInviteOpen(true);
  };

  const handleScanDecoded = (data: string) => {
    const decoded = decodeStrokes(data);
    if (!decoded) {
      setToast('这个二维码不包含有效的签名笔迹');
      return;
    }
    setStrokes(decoded);
    setMode('draw');
    setScannerOpen(false);
    setToast('已接收手机签名，自动落到画板');
  };

  const configMode = (
    <Box>
      <SidebarTitle>签名方式</SidebarTitle>
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={mode}
        onChange={(_, v) => {
          if (!v) return;
          setMode(v);
        }}
      >
        <ToggleButton value="draw" sx={{ fontSize: 12, py: 0.5 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <DrawIcon sx={{ fontSize: 15 }} />
            <span>手写</span>
          </Stack>
        </ToggleButton>
        <ToggleButton value="type" sx={{ fontSize: 12, py: 0.5 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <TextFieldsIcon sx={{ fontSize: 15 }} />
            <span>文字</span>
          </Stack>
        </ToggleButton>
      </ToggleButtonGroup>

      {mode === 'draw' && (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            笔触粗细
          </Typography>
          <Stack direction="row" spacing={0.75}>
            {PEN_WIDTHS.map((p) => (
              <Box
                key={p.key}
                onClick={() => setPenKey(p.key)}
                sx={{
                  ...FONT_CHIP,
                  flex: 1,
                  textAlign: 'center',
                  borderColor: penKey === p.key ? 'primary.main' : 'divider',
                  bgcolor: penKey === p.key ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                  color: penKey === p.key ? 'primary.main' : 'text.primary',
                  '&:hover': { borderColor: 'text.secondary' },
                }}
              >
                <Box
                  sx={{
                    height: 3,
                    borderRadius: 2,
                    bgcolor: 'currentColor',
                    my: 0.4,
                    width: p.key === 'thin' ? 8 : p.key === 'medium' ? 14 : 20,
                    mx: 'auto',
                  }}
                />
                <Box sx={{ fontSize: 11 }}>{p.label}</Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );

  const configFont = mode === 'type' && (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        字体风格
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {FONT_STYLES.map((f) => (
          <Box
            key={f.key}
            onClick={() => setFontKey(f.key)}
            sx={{
              ...FONT_CHIP,
              borderColor: fontKey === f.key ? 'primary.main' : 'divider',
              bgcolor: fontKey === f.key ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
              color: fontKey === f.key ? 'primary.main' : 'text.primary',
              fontFamily: f.family,
              '&:hover': { borderColor: 'text.secondary' },
            }}
          >
            {f.label}
          </Box>
        ))}
      </Stack>
    </Box>
  );

  const configHandoff = (
    <Box>
      <SidebarTitle>手机签名</SidebarTitle>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontSize: 12, lineHeight: 1.6 }}>
        手机扫码进入横屏签名页，签完本机扫码回传，全程不走网络。
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'nowrap', minWidth: 0 }}>
        <Button
          variant="contained"
          size="small"
          onClick={invitePhone}
          startIcon={<QrCode2Icon sx={{ fontSize: 15 }} />}
          sx={{ whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
        >
          发起手机签名
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setScannerOpen(true)}
          startIcon={<CameraAltIcon sx={{ fontSize: 15 }} />}
          sx={{ whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
        >
          从手机接收
        </Button>
      </Stack>
    </Box>
  );

  const configPreview = (
    <Box>
      <SidebarTitle>导出预览</SidebarTitle>
      <Box
        sx={{
          width: '100%',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: '#fff',
          backgroundImage: dropzoneBg,
          backgroundSize: dropzoneBgSize,
          backgroundPosition: dropzoneBgPos,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 1,
          minHeight: 84,
        }}
      >
        {result ? (
          <img
            src={result.url}
            alt="签名预览"
            style={{
              maxWidth: '100%',
              maxHeight: 96,
              height: 'auto',
              display: 'block',
            }}
          />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 12 }}>
            {mode === 'draw' ? '在画板手写生成签名' : '输入文字生成签名'}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, display: 'block', mt: 0.75 }}>
        导出前自动裁掉四周留白，仅保留笔迹本身。
      </Typography>
    </Box>
  );

  return (
    <Box>
      <ToolWorkbench
        title={title}
        description={description}
        hasContent
        usage={
          <TipCard
            icon={<DrawIcon />}
            text="手写或输入文字生成透明背景签名 PNG：导出前自动裁掉四周留白。可「发起手机签名」让手机扫码进入横屏签名页书写，完成后电脑摄像头扫码回传。全部在本地完成，内容不出设备。"
          />
        }
        config={
          <Stack spacing={3}>
            {configMode}
            {configFont}
            {mode === 'type' && <TextField value={typedText} onChange={(e) => setTypedText(e.target.value)} placeholder="输入签名文字" size="small" fullWidth slotProps={{ htmlInput: { maxLength: 20, style: { fontFamily: fontFamilyOf(fontKey) } } }} />}
            {configHandoff}
            {configPreview}
          </Stack>
        }
        resource={<SidebarResourceInfo data={result ? { name: '签名.png', after: { size: result.blob.size, width: result.width, height: result.height } } : { name: '签名.png' }} />}
        flow={flowImages.length > 0 ? <FlowPill images={flowImages} /> : undefined}
        actions={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="contained" size="small" onClick={download} disabled={!result} startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}>
              下载 PNG
            </Button>
            {canShare && (
              <Button variant="outlined" size="small" onClick={() => void share()} disabled={!result} startIcon={<ShareIcon sx={{ fontSize: 16 }} />}>
                分享到其它设备
              </Button>
            )}
            {mode === 'draw' && (
              <Button variant="text" size="small" color="inherit" onClick={handleClear} disabled={!hasDrawStroke} startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />} sx={{ color: 'text.secondary' }}>
                清空
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {result && (
              <Typography variant="caption" sx={{ fontFamily: 'var(--font-geist-mono)', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {result.width} × {result.height}px
              </Typography>
            )}
          </Stack>
        }
      >
        {/* 画板区：flex:1 占满，横向签名板 contain-fit 居中 */}
        <Box
          ref={fitRef}
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fafaf7',
            backgroundImage: dropzoneBg,
            backgroundSize: dropzoneBgSize,
            backgroundPosition: dropzoneBgPos,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              width: fitSize ? fitSize.w : '100%',
              height: fitSize ? fitSize.h : 'auto',
              maxWidth: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              bgcolor: '#fff',
              position: 'relative',
            }}
          >
            <SignaturePad
              strokes={strokes}
              mode={mode}
              fontKey={fontKey}
              typedText={typedText}
              penEnabled={mode === 'draw'}
              onStrokeStart={onStrokeStart}
              onStrokeMove={onStrokeMove}
              onStrokeEnd={onStrokeEnd}
            />
            {mode === 'draw' && !hasDrawStroke && (
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
                在下方手写区签名，或切换为文字模式
              </Box>
            )}
          </Box>
        </Box>
      </ToolWorkbench>

      <InvitePhoneDialog
        open={inviteOpen}
        url={inviteUrl}
        onClose={() => setInviteOpen(false)}
      />
      <QrScannerDialog
        open={scannerOpen}
        onDecoded={handleScanDecoded}
        onClose={() => setScannerOpen(false)}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={2600}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)} sx={{ borderRadius: 1.5 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}