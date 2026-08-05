'use client';

// 图片格式转换：上传图片 → 识别原格式 → 展示可转换的目标格式选项 → 选择确认转换。
// 保持原尺寸。PNG 走 canvas 原生（无损）、JPG 走 MozJPEG（q0.85）、WebP 走浏览器原生 libwebp。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import JSZip from 'jszip';
import { getMozJpeg } from '../_lib/encoders';

type Target = 'png' | 'jpeg' | 'webp';

type Item = {
  id: string;
  file: File;
  name: string;
  kind: Target;
  origSize: number;
  origWidth: number;
  origHeight: number;
  dataUrl: string;
  outTarget?: Target;
  outUrl?: string;
  outBlob?: Blob;
  outSize?: number;
  done?: boolean;
  failed?: boolean;
};

const ALL_TARGETS: Target[] = ['png', 'jpeg', 'webp'];
const LABEL: Record<Target, string> = { png: 'PNG', jpeg: 'JPG', webp: 'WebP' };

const SUPPORTED_TYPES: Record<string, Target> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('图片解码失败'));
    i.src = src;
  });

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

// 解码 → 编码，保持原尺寸；JPG 无透明通道，先填白底
const encode = async (it: Item, target: Target): Promise<Blob> => {
  const img = await loadImage(it.dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  if (target === 'jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  if (target === 'png') {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 编码失败'))), 'image/png');
    });
  }
  if (target === 'jpeg') {
    const { encode } = await getMozJpeg();
    const out = await encode(ctx.getImageData(0, 0, w, h), { quality: 85 });
    return new Blob([out], { type: 'image/jpeg' });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('WebP 编码失败'))), 'image/webp', 0.85);
  });
};

const extOf = (t: Target): string => (t === 'jpeg' ? 'jpg' : t);

export default function ImageConvert() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [working, setWorking] = React.useState(false);
  const [progress, setProgress] = React.useState<{ total: number; done: number; currentId: string | null } | null>(null);
  const [, setError] = React.useState<string | null>(null);

  const itemsRef = React.useRef<Item[]>(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const appendFiles = async (files: File[]) => {
    const accepted = files.filter((f) => SUPPORTED_TYPES[f.type]);
    if (!accepted.length) return;
    setError(null);
    const next: Item[] = [];
    for (const file of accepted) {
      const dataUrl = await readDataUrl(file);
      const img = await loadImage(dataUrl);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        kind: SUPPORTED_TYPES[file.type],
        origSize: file.size,
        origWidth: img.naturalWidth,
        origHeight: img.naturalHeight,
        dataUrl,
      });
    }
    setItems((prev) => [...prev, ...next]);
  };

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await appendFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) => SUPPORTED_TYPES[f.type]);
    if (files.length === 0) {
      setError('请拖入 PNG / JPG / WebP 图片');
      return;
    }
    await appendFiles(files);
  };

  const removeAt = (id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.outUrl) URL.revokeObjectURL(it.outUrl);
      return prev.filter((x) => x.id !== id);
    });
  };
  const clearAll = () => {
    items.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    setItems([]);
  };

  const tokenRef = React.useRef(0);

  // 转换单项，返回更新后的 Item
  const processOne = async (it: Item, target: Target): Promise<Item> => {
    try {
      const blob = await encode(it, target);
      return {
        ...it,
        outTarget: target,
        outUrl: URL.createObjectURL(blob),
        outBlob: blob,
        outSize: blob.size,
        done: true,
        failed: false,
      };
    } catch (e) {
      console.error('[ImageConvert] failed', it.name, e);
      return { ...it, outTarget: target, done: true, failed: true };
    }
  };

  // 单项：选择目标格式后立即转换
  const convertOne = async (id: string, target: Target) => {
    const myToken = ++tokenRef.current;
    const list = itemsRef.current;
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return;
    setWorking(true);
    list[idx].outUrl && URL.revokeObjectURL(list[idx].outUrl);
    const reset: Item[] = list.map((it, i) =>
      i === idx
        ? { ...it, outUrl: undefined, outBlob: undefined, outSize: undefined, outTarget: target, done: false, failed: false }
        : it,
    );
    setItems(reset);
    setProgress({ total: 1, done: 0, currentId: id });
    const out = await processOne(reset[idx], target);
    if (tokenRef.current !== myToken) return;
    reset[idx] = out;
    setItems(reset);
    setWorking(false);
    setProgress(null);
  };

  // 全部转换到同一目标格式
  const convertAll = async (target: Target) => {
    const myToken = ++tokenRef.current;
    const list = itemsRef.current;
    if (list.length === 0) return;
    setWorking(true);
    setError(null);
    list.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    const reset: Item[] = list.map((it) => ({
      ...it,
      outUrl: undefined,
      outBlob: undefined,
      outSize: undefined,
      outTarget: target,
      done: false,
      failed: false,
    }));
    setItems(reset);
    setProgress({ total: list.length, done: 0, currentId: null });

    const out: Item[] = [...reset];
    for (let i = 0; i < list.length; i++) {
      if (tokenRef.current !== myToken) return;
      setProgress({ total: list.length, done: i, currentId: reset[i].id });
      out[i] = await processOne(reset[i], target);
      if (tokenRef.current !== myToken) return;
      setProgress({ total: list.length, done: i + 1, currentId: null });
      setItems([...out]);
    }
    if (tokenRef.current === myToken) {
      setItems(out);
      setWorking(false);
      setProgress(null);
    }
  };

  React.useEffect(() => {
    return () => {
      items.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadOne = (it: Item) => {
    if (!it.done || !it.outBlob) return;
    const url = it.outUrl ?? URL.createObjectURL(it.outBlob);
    const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.${extOf(it.outTarget ?? it.kind)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!it.outUrl) URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const done = items.filter((it): it is Item & { outBlob: Blob } => !!it.outBlob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
      let name = `${base}.${extOf(it.outTarget ?? it.kind)}`;
      let i = 1;
      while (used.has(name)) {
        name = `${base}-${i}.${extOf(it.outTarget ?? it.kind)}`;
        i++;
      }
      used.add(name);
      zip.file(name, it.outBlob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasOut = items.some((it) => it.outBlob);
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <Box
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!dragOver) setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        borderRadius: 1,
        outline: dragOver ? '2px dashed' : '2px dashed transparent',
        outlineColor: dragOver ? 'primary.main' : 'transparent',
        outlineOffset: dragOver ? -2 : 0,
      }}
    >
      {/* 全部转换快捷操作 */}
      {items.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, flexShrink: 0 }}>
            全部转换为
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={null} onChange={(_, v) => v && convertAll(v as Target)}>
            {ALL_TARGETS.map((t) => (
              <ToggleButton key={t} value={t} sx={{ px: 2, fontSize: 13 }} disabled={working}>
                {LABEL[t]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      )}

      {items.length === 0 ? (
        <Box
          sx={{
            width: '100%',
            minHeight: 320,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: '#fafaf7',
            backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            color: 'text.secondary',
          }}
        >
          <Box sx={{ fontSize: 36, opacity: 0.5 }}>🔄</Box>
          <Typography variant="body2">上传 PNG / JPG / WebP，选择目标格式开始转换</Typography>
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 1 }}
          >
            选择图片
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={handleAdd}
            />
          </Button>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, mt: 0.5 }}>
            所有处理在浏览器内完成 · 保持原尺寸
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {items.map((it) => (
            <Box
              key={it.id}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: '#fafaf7',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  flexShrink: 0,
                  borderRadius: 1,
                  bgcolor: '#fff',
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={it.outUrl ?? it.dataUrl}
                  alt={it.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {it.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'var(--font-geist-mono)', fontSize: 10, flexShrink: 0 }}>
                    {LABEL[it.kind]} · {it.origWidth}×{it.origHeight}
                  </Typography>
                </Stack>

                {/* 状态与目标格式选项 */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1, alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={it.outTarget ?? null}
                    onChange={(_, v) => v && convertOne(it.id, v as Target)}
                    disabled={working || (it.failed && false)}
                  >
                    {ALL_TARGETS.filter((t) => t !== it.kind).map((t) => (
                      <ToggleButton key={t} value={t} sx={{ px: 1.5, fontSize: 12 }}>
                        {LABEL[t]}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  <Typography
                    variant="caption"
                    sx={{
                      color: it.outSize !== undefined ? 'primary.main' : 'text.disabled',
                      fontFamily: 'var(--font-geist-mono)',
                      fontSize: 11,
                    }}
                  >
                    {progress?.currentId === it.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'text.secondary' }}>
                        <CircularProgress size={12} thickness={5} />
                        转换中…
                      </span>
                    ) : it.done ? (
                      it.failed ? (
                        <span style={{ color: '#d32f2f' }}>转换失败</span>
                      ) : (
                        `${formatBytes(it.origSize)} → ${formatBytes(it.outSize!)}`
                      )
                    ) : (
                      `选择目标格式转换（原 ${formatBytes(it.origSize)}）`
                    )}
                  </Typography>
                </Stack>
              </Box>

              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignItems: 'center' }}>
                <Tooltip title="下载转换结果">
                  <span>
                    <IconButton size="small" onClick={() => downloadOne(it)} disabled={!it.done} sx={{ color: 'text.secondary' }}>
                      <DownloadIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="移除">
                  <IconButton size="small" onClick={() => removeAt(it.id)} sx={{ color: 'text.secondary' }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {items.length > 0 && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" size="small" component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
            继续添加
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={handleAdd}
            />
          </Button>
          <Tooltip title="清空全部">
            <IconButton size="small" color="inherit" onClick={clearAll} sx={{ color: 'text.secondary' }}>
              <DeleteSweepIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            size="small"
            onClick={downloadAll}
            disabled={!hasOut || working}
            startIcon={<FolderZipIcon sx={{ fontSize: 16 }} />}
          >
            打包 ZIP
          </Button>
        </Stack>
      )}

      {working && progress && progress.total > 1 && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
              {progress.currentId ? '正在转换…' : '收尾中…'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
              {progress.done}/{progress.total}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
        </Box>
      )}
    </Box>
  );
}
