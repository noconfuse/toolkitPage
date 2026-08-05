'use client';

// 二维码生成：输入文本 / 链接，自定义颜色、点样式与中心 logo，实时预览，下载 PNG。
// 使用 qr-code-styling（canvas 绘制），全部在浏览器内完成，不上传。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import QRCodeStyling, { type DotType } from 'qr-code-styling';

const ERR_LEVELS: { value: 'L' | 'M' | 'Q' | 'H'; label: string; desc: string }[] = [
  { value: 'L', label: 'L', desc: '约 7% 容错' },
  { value: 'M', label: 'M', desc: '约 15% 容错' },
  { value: 'Q', label: 'Q', desc: '约 25% 容错' },
  { value: 'H', label: 'H', desc: '约 30% 容错' },
];

const DOT_TYPES: { value: DotType; label: string }[] = [
  { value: 'square', label: '方块' },
  { value: 'rounded', label: '圆角' },
  { value: 'dots', label: '圆点' },
  { value: 'extra-rounded', label: '胶囊' },
  { value: 'classy', label: '异形' },
];

const SIZES = [256, 512, 1024];

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, width: 56, flexShrink: 0 }}>
      {label}
    </Typography>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        border: '1px solid rgba(15,31,29,0.2)',
        borderRadius: 6,
        background: 'none',
        cursor: 'pointer',
      }}
    />
    <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
      {value}
    </Typography>
  </Stack>
);

export default function QrCode() {
  const [text, setText] = React.useState('');
  const [level, setLevel] = React.useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [dotType, setDotType] = React.useState<DotType>('rounded');
  const [fgColor, setFgColor] = React.useState('#0f1f1d');
  const [bgColor, setBgColor] = React.useState('#ffffff');
  const [logoDataUrl, setLogoDataUrl] = React.useState<string | null>(null);
  const [size, setSize] = React.useState(512);

  const canvasHostRef = React.useRef<HTMLDivElement | null>(null);
  const instanceRef = React.useRef<QRCodeStyling | null>(null);

  // 选项变化即重绘（qr-code-styling 无异步，无需防抖）
  React.useEffect(() => {
    const el = canvasHostRef.current;
    if (!el) return;
    const value = text.trim();
    if (!value) {
      el.innerHTML = '';
      instanceRef.current = null;
      return;
    }
    const options = {
      type: 'canvas' as const,
      width: size,
      height: size,
      data: value,
      margin: 0,
      image: logoDataUrl ?? undefined,
      qrOptions: { errorCorrectionLevel: level },
      dotsOptions: { type: dotType, color: fgColor },
      cornersSquareOptions: { type: 'extra-rounded' as const, color: fgColor },
      cornersDotOptions: { type: 'dot' as const, color: fgColor },
      backgroundOptions: { color: bgColor },
      imageOptions: { margin: 8, imageSize: 0.3, hideBackgroundDots: true },
    };
    if (instanceRef.current) {
      instanceRef.current.update(options);
    } else {
      el.innerHTML = '';
      instanceRef.current = new QRCodeStyling(options);
      instanceRef.current.append(el);
    }
  }, [text, size, level, dotType, fgColor, bgColor, logoDataUrl]);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => setLogoDataUrl(fr.result as string);
    fr.readAsDataURL(f);
  };

  const download = () => {
    if (!text.trim()) return;
    if (instanceRef.current) {
      instanceRef.current.download({ name: `qrcode-${Date.now()}`, extension: 'png' });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 3, md: 5 }, alignItems: 'flex-start' }}>
      {/* 左侧：输入与选项 */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        <TextField
          label="内容"
          placeholder="输入文本或链接，例如 https://example.com"
          value={text}
          onChange={(e) => setText(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          variant="outlined"
          sx={{ '& textarea': { fontFamily: 'var(--font-geist-mono)', fontSize: 14 } }}
        />

        <Stack spacing={2.5} sx={{ mt: 3 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              纠错级别（越高越耐污损，可容纳 logo 遮挡）
            </Typography>
            <ToggleButtonGroup exclusive size="small" value={level} onChange={(_, v) => v && setLevel(v)}>
              {ERR_LEVELS.map((l) => (
                <ToggleButton key={l.value} value={l.value} sx={{ px: 2, fontSize: 13 }}>
                  {l.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, display: 'block', mt: 0.5 }}>
              {ERR_LEVELS.find((l) => l.value === level)?.desc}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              点样式
            </Typography>
            <ToggleButtonGroup exclusive size="small" value={dotType} onChange={(_, v) => v && setDotType(v as DotType)}>
              {DOT_TYPES.map((d) => (
                <ToggleButton key={d.value} value={d.value} sx={{ px: 1.5, fontSize: 12 }}>
                  {d.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
            <ColorField label="前景色" value={fgColor} onChange={setFgColor} />
            <ColorField label="背景色" value={bgColor} onChange={setBgColor} />
          </Stack>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              中心图片（可选，建议配合 H 级纠错）
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" component="label">
                {logoDataUrl ? '更换图片' : '上传图片'}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleLogo} />
              </Button>
              {logoDataUrl && (
                <Button variant="text" size="small" color="inherit" onClick={() => setLogoDataUrl(null)} sx={{ color: 'text.secondary' }}>
                  移除
                </Button>
              )}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              尺寸
            </Typography>
            <ToggleButtonGroup exclusive size="small" value={size} onChange={(_, v) => v && setSize(v as number)}>
              {SIZES.map((s) => (
                <ToggleButton key={s} value={s} sx={{ px: 2, fontSize: 13 }}>
                  {s}px
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Stack>
      </Box>

      {/* 右侧：预览与下载 */}
      <Box sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          预览
        </Typography>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: '#fafaf7',
            overflow: 'hidden',
            p: 1.5,
            // canvas 内部尺寸是用户选择的 256/512/1024，这里按比例缩放到容器内完整显示
            '& canvas': {
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              display: 'block',
            },
          }}
        >
          {/* 容器只由 qr-code-styling 管理；占位提示放外面做兄弟节点，避免 React 与 innerHTML 清空冲突 */}
          <div
            ref={canvasHostRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          />
          {!text.trim() && (
            <Stack
              sx={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                color: 'text.disabled',
                pointerEvents: 'none',
              }}
            >
              <QrCode2Icon sx={{ fontSize: 48, opacity: 0.5 }} />
              <Typography variant="caption" sx={{ fontSize: 11, textAlign: 'center' }}>
                输入内容后自动生成
              </Typography>
            </Stack>
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          fullWidth
          onClick={download}
          disabled={!text.trim()}
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 1.5 }}
        >
          下载 PNG
        </Button>
      </Box>
    </Box>
  );
}
