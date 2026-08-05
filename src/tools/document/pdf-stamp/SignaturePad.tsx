'use client';

// 签名工具：手写模式（HTMLCanvas + Pointer Events 画笔）｜打字模式（输入文字 + fillText 用选定字体渲染）
// 两种模式都导出 PNG（透明背景），落到 PDF 后只保留深色笔迹/字形。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DrawIcon from '@mui/icons-material/Draw';
import TextFieldsIcon from '@mui/icons-material/TextFields';

const PAD_W = 600;
const PAD_H = 200;

// 字体风格 + 系统字体回退链。浏览器找不到时自动回退。
const FONT_STYLES: ReadonlyArray<{ key: string; label: string; family: string }> = [
  { key: 'pen',      label: '原笔',   family: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' },
  { key: 'cursive',  label: '草书',   family: 'cursive' },
  { key: 'kaiti',    label: '行楷',   family: '"Kaiti SC", "STKaiti", KaiTi, "楷体", serif' },
  { key: 'lishu',    label: '隶书',   family: '"STLiti", "FangSong", "仿宋", Lisu, serif' },
  { key: 'fangsong', label: '仿宋',   family: '"STFangsong", "FangSong", "仿宋", serif' },
];

export type SignaturePadHandle = {
  exportPng: () => string | null;
  reset: () => void;
};

type Mode = 'draw' | 'type';

export function SignaturePad({
  onDone,
}: {
  onDone: (pngDataUrl: string) => void;
}) {
  const [mode, setMode] = React.useState<Mode>('draw');
  const [fontKey, setFontKey] = React.useState<string>(FONT_STYLES[0].key);

  // ─────────── 画板（两种模式共用同一个 canvas） ───────────
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const lastRef = React.useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = React.useState(false);
  const [typedText, setTypedText] = React.useState('签名示例');

  // 取当前字体族
  const currentFamily = React.useMemo(
    () => (FONT_STYLES.find((f) => f.key === fontKey) ?? FONT_STYLES[0]).family,
    [fontKey],
  );

  // 渲染：
  //   draw 模式 → 空白画板（用户直接手写）
  //   type 模式 → 用 fillText 渲染 typedText
  const renderCanvas = React.useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    if (mode === 'type') {
      const text = typedText.trim() || ' ';
      const size = Math.min(c.height * 0.7, 140);
      ctx.fillStyle = '#0f1f1d';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = `500 ${size}px ${currentFamily}`;
      ctx.fillText(text, c.width / 2, c.height / 2);
    }
  }, [mode, currentFamily, typedText]);

  // 初始化 + 字体/模式/文本变化时重画
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = PAD_W;
    c.height = PAD_H;
    renderCanvas();
    setHasStroke(false);
  }, [fontKey, mode, renderCanvas]);

  // pointer 事件（draw 模式才生效）
  const getPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const onDown = (e: React.PointerEvent) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = getPoint(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (mode !== 'draw' || !drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = getPoint(e);
    const last = lastRef.current!;
    ctx.strokeStyle = '#0f1f1d';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    setHasStroke(true);
  };
  const onUp = (e: React.PointerEvent) => {
    drawingRef.current = false;
    lastRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleReset = () => {
    renderCanvas();
    setHasStroke(false);
  };

  // 导出：draw 模式直接取笔迹，type 模式取渲染文本
  const handleDone = () => {
    const c = canvasRef.current;
    if (!c) return;
    if (mode === 'draw' && !hasStroke) return;
    if (mode === 'type' && !typedText.trim()) return;
    onDone(c.toDataURL('image/png'));
    renderCanvas();
    setHasStroke(false);
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {mode === 'draw' ? (
          <DrawIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        ) : (
          <TextFieldsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        )}
        <Typography variant="overline" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)' }}>
          {mode === 'draw' ? '手写签名' : '文字签名'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="重置">
          <IconButton size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
            <RestartAltIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* 模式 + 字体选择（字体仅在文字模式下显示） */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, v) => v && setMode(v as Mode)}
        >
          <ToggleButton value="draw" sx={{ px: 1.25, py: 0.4, fontSize: 12 }}>
            手写
          </ToggleButton>
          <ToggleButton value="type" sx={{ px: 1.25, py: 0.4, fontSize: 12 }}>
            文字
          </ToggleButton>
        </ToggleButtonGroup>

        {mode === 'type' && (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {FONT_STYLES.map((f) => (
              <Box
                key={f.key}
                onClick={() => setFontKey(f.key)}
                sx={{
                  px: 1.25, py: 0.4, fontSize: 12, fontWeight: 500,
                  borderRadius: 0.75, border: 1,
                  borderColor: fontKey === f.key ? 'primary.main' : 'divider',
                  bgcolor: fontKey === f.key ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                  color: fontKey === f.key ? 'primary.main' : 'text.primary',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                  '&:hover': { borderColor: fontKey === f.key ? 'primary.main' : 'text.secondary' },
                  fontFamily: f.family,
                }}
              >
                {f.label}
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      {/* 文字输入框（只在 type 模式显示） */}
      {mode === 'type' && (
        <TextField
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="输入签名文字"
          size="small"
          fullWidth
          slotProps={{
            htmlInput: { maxLength: 20, style: { fontFamily: currentFamily } },
          }}
        />
      )}

      {/* 画板 */}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          width: '100%',
          backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.06) 75%)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
        }}
      >
        <Box
          component="canvas"
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          sx={{
            display: 'block',
            width: '100%',
            height: 'auto',
            aspectRatio: `${PAD_W} / ${PAD_H}`,
            cursor: mode === 'draw' ? 'crosshair' : 'default',
            pointerEvents: mode === 'draw' ? 'auto' : 'none',
            touchAction: 'none',
          }}
        />
      </Box>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          onClick={handleDone}
          disabled={mode === 'draw' ? !hasStroke : !typedText.trim()}
        >
          落到 PDF
        </Button>
      </Stack>
    </Box>
  );
}