'use client';

// 图片压缩：保留原格式（PNG→PNG、JPG→JPG、WebP→WebP），一次性最佳实践，无需手动调参。
// 统一管道：所有格式同一入口「解码 → 编码」（compressOne），编码器按图自动选择：
// - PNG 照片（RGB/RGBA）：libimagequant 调色板量化（speed 3 / 256 色，一次成型）
// - PNG 索引图 / 灰度图（读 IHDR 判定）：oxipng 无损重压缩
// - JPG：MozJPEG 编码（质量 75，感知质量≈浏览器 q0.8，体积更小）
// - WebP：浏览器原生 libwebp（质量 0.75）
// 无论输出体积如何都产出压缩结果，绝不保留原文件

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
import JSZip from 'jszip';
import LibImageQuant from 'libimagequant-wasm';
import { getMozJpeg } from '../_lib/encoders';

type ImgKind = 'png' | 'jpeg' | 'webp';

type Item = {
  id: string;
  file: File;
  name: string;
  kind: ImgKind;
  origSize: number;
  origWidth: number;
  origHeight: number;
  dataUrl: string; // 用于预览 + 重绘
  // 输出
  outUrl?: string;
  outBlob?: Blob;
  outSize?: number;
  outWidth?: number;
  outHeight?: number;
  // true = 本轮处理已完成（产出压缩结果）
  done?: boolean;
  // true = 本轮处理失败
  failed?: boolean;
};

// 整体进度：{ 完成数, 总数, 当前正在处理的项 }
type Progress = {
  total: number;
  done: number;
  currentId: string | null;
};

const SUPPORTED_TYPES: Record<string, ImgKind> = {
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

// ---- 一次性最佳实践参数（经 /tests/imgs 真实图片实测选定）----
// 注意：libimagequant-wasm 存在「quality 与 maxColors 同时设置即崩溃」的 bug
// （实测 Unknown error，大图必现），因此参数只用 maxColors（256 = pngquant 默认），
// 绝不同时传 quality。
const PNG_QUANTIZE_OPTS = { speed: 3, maxColors: 256 };
// MozJPEG 质量 75：感知质量≈浏览器 canvas q0.8，但体积明显更小（实测 −28% vs −12%）
const JPEG_QUALITY = 75;
// WebP：浏览器原生 libwebp 编码（实测 −13%）
const WEBP_QUALITY = 0.75;

// libimagequant 单例（懒加载）
// 注意：库默认把 Worker 内嵌为 data URL，worker 内 `new URL("./wasm/...")` 无法解析会报
// Invalid URL → 必须提供 workerUrl 指向同源静态文件（public/libimagequant/worker.mjs，
// 与其同目录的 wasm/ 保持相对引用）
let quantizerPromise: Promise<LibImageQuant> | null = null;
const getQuantizer = () => {
  if (!quantizerPromise) {
    quantizerPromise = Promise.resolve(new LibImageQuant({ workerUrl: '/libimagequant/worker.mjs' }));
  }
  return quantizerPromise;
};

// oxipng 单例（懒加载，仅在命中索引/灰度 PNG 时才下载 codec chunk）
let oxipngPromise: Promise<typeof import('@jsquash/oxipng')> | null = null;
const getOxipng = () => (oxipngPromise ??= import('@jsquash/oxipng'));

// PNG IHDR 头信息：字节 24 = 位深，字节 25 = 颜色类型。
// 用于区分「索引/灰度图」（调色板格式，量化无收益 → 走 oxipng 无损重压缩）
// 与「真彩照片」（→ 调色板量化，收益最大）。
const readPngInfo = (bytes: Uint8Array): { bitDepth: number; colorType: number } | null => {
  if (bytes.length < 33 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  return { bitDepth: bytes[24], colorType: bytes[25] };
};

// 统一压缩管道：所有格式走同一入口「解码 → 编码」，一次成型，无档位、无对比。
// 编码器按格式选是算法必然，但对外只有一个 compressOne(it) → Blob。
const compressOne = async (it: Item): Promise<Blob> => {
  // ① 解码（所有格式一致）
  const img = await loadImage(it.dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.drawImage(img, 0, 0, w, h);

  // ② 编码（按格式选最佳实践编码器，一次成型）
  if (it.kind === 'png') {
    // 读 IHDR 区分「索引/灰度图」与「真彩照片」
    const head = new Uint8Array(await it.file.slice(0, 33).arrayBuffer());
    const info = readPngInfo(head);
    const lossless =
      info !== null && (info.bitDepth !== 8 || info.colorType === 0 || info.colorType === 3 || info.colorType === 4);
    if (lossless) {
      // 索引色 / 灰度图：已是调色板格式，再量化只会变大 → oxipng 无损重压缩（level 2 实测 −8%）
      const { optimise } = await getOxipng();
      const out = await optimise(await it.file.arrayBuffer(), { level: 2 });
      return new Blob([out], { type: 'image/png' });
    }
    // 真彩 PNG：调色板量化，一次成型（libimagequant 运行在自己的 worker 里，不阻塞主线程）。
    // 优先量化原文件字节（worker 内解码，快）；若 wasm 解码器不支持该 PNG
    // （interlaced / 16bit 等）会抛错，回退到 canvas 解码的 RGBA 走 quantizeImageData。
    const quantizer = await getQuantizer();
    try {
      const result = await quantizer.quantizePng(it.file, PNG_QUANTIZE_OPTS);
      return new Blob([new Uint8Array(result.pngBytes)], { type: 'image/png' });
    } catch {
      console.warn('[ImageCompress] wasm 无法解码该 PNG，回退 RGBA 量化:', it.name);
      const result = await quantizer.quantizeImageData(ctx.getImageData(0, 0, w, h), PNG_QUANTIZE_OPTS);
      return new Blob([new Uint8Array(result.pngBytes)], { type: 'image/png' });
    }
  }

  if (it.kind === 'jpeg') {
    // MozJPEG：与 tinyjpg 同源的编码器，同视觉档位下比浏览器 canvas 小得多
    const { encode } = await getMozJpeg();
    const out = await encode(ctx.getImageData(0, 0, w, h), { quality: JPEG_QUALITY });
    return new Blob([out], { type: 'image/jpeg' });
  }

  // WebP：浏览器原生 libwebp 编码（canvas + toBlob）
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 失败'))), 'image/webp', WEBP_QUALITY);
  });
};

export default function ImageCompress() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [working, setWorking] = React.useState(false);
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [, setError] = React.useState<string | null>(null);

  // 文件名后缀：.jpg/.jpeg/.png/.webp
  const extOf = (name: string, k: ImgKind): string => {
    const lower = name.toLowerCase();
    if (k === 'jpeg') return lower.endsWith('.jpeg') ? 'jpeg' : 'jpg';
    if (k === 'png') return 'png';
    return 'webp';
  };

  // recompress 内部读最新 items 的 ref（避免 useEffect 把 items 加入依赖造成死循环）
  const itemsRef = React.useRef<Item[]>(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 已声明在上方
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    const next: Item[] = [];
    for (const file of files) {
      const kind = SUPPORTED_TYPES[file.type];
      if (!kind) continue;
      const dataUrl = await readDataUrl(file);
      const img = await loadImage(dataUrl);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        kind,
        origSize: file.size,
        origWidth: img.naturalWidth,
        origHeight: img.naturalHeight,
        dataUrl,
      });
    }
    setItems((prev) => {
      const merged = [...prev, ...next];
      // 把最新数组写到 ref，方便 recompress 读到
      itemsRef.current = merged;
      // 上传后立即触发一次重压
      queueMicrotask(() => recompress());
      return merged;
    });
    e.target.value = '';
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

  // 重绘到 canvas，保持原尺寸，仅重编码（保留原格式）
  // 用 token 防止并发 recompress 互相覆盖状态
  const tokenRef = React.useRef(0);

  const recompress = async (): Promise<void> => {
    // 通过 ref 读最新 items（不被闭包过期影响）
    const list = itemsRef.current;
    if (list.length === 0) {
      setError('请先添加图片');
      return;
    }
    const myToken = ++tokenRef.current;
    setWorking(true);
    setError(null);
    // 释放旧 url，重置输出字段与完成标记
    list.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    const reset: Item[] = list.map((it) => ({
      ...it,
      outUrl: undefined,
      outBlob: undefined,
      outSize: undefined,
      outWidth: undefined,
      outHeight: undefined,
      done: false,
      failed: false,
    }));
    setItems(reset);
    setProgress({ total: list.length, done: 0, currentId: null });

    const out: Item[] = [...reset];
    try {
      for (let i = 0; i < list.length; i++) {
        if (tokenRef.current !== myToken) return; // 被新的请求顶掉
        const src = list[i];
        setProgress({ total: list.length, done: i, currentId: src.id });
        try {
          const blob = await compressOne(src);
          const url = URL.createObjectURL(blob);
          // 尺寸保持原样，仅重编码
          out[i] = {
            ...out[i],
            outUrl: url,
            outBlob: blob,
            outSize: blob.size,
            outWidth: src.origWidth,
            outHeight: src.origHeight,
            done: true,
          };
        } catch (e) {
          console.error('[ImageCompress] failed', src.name, e);
          out[i] = { ...out[i], done: true, failed: true };
        }
        if (tokenRef.current !== myToken) return;
        setProgress({ total: list.length, done: i + 1, currentId: null });
        setItems([...out]); // 逐张刷新，让每项状态（等待/处理中/完成）实时可见
      }
      if (tokenRef.current !== myToken) return;
      setItems(out);
    } finally {
      if (tokenRef.current === myToken) {
        setWorking(false);
      }
    }
  };

  // 质量已固定为最佳实践，无需自动重压

  // 卸载时释放 url
  React.useEffect(() => {
    return () => {
      items.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadOne = (it: Item) => {
    if (!it.done || !it.outBlob) return;
    const url = it.outUrl ?? URL.createObjectURL(it.outBlob);
    const ext = extOf(it.name, it.kind);
    const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!it.outUrl) URL.revokeObjectURL(url);
  };

  // 全部打包为一个 ZIP 下载；同名文件自动加序号，避免覆盖
  const downloadAll = async () => {
    const done = items.filter((it): it is Item & { outBlob: Blob } => !!it.outBlob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      const ext = extOf(it.name, it.kind);
      const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
      let name = `${base}.${ext}`;
      let i = 1;
      while (used.has(name)) {
        name = `${base}-${i}.${ext}`;
        i++;
      }
      used.add(name);
      zip.file(name, it.outBlob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 汇总
  const totalOrig = items.reduce((s, it) => s + it.origSize, 0);
  const totalOut = items.reduce((s, it) => s + (it.outSize ?? 0), 0);
  const hasOut = items.some((it) => it.outBlob);
  const savedPct = totalOut > 0 ? Math.max(0, Math.round((1 - totalOut / Math.max(totalOrig, 1)) * 100)) : 0;

  const [dragOver, setDragOver] = React.useState(false);

  // 拖入上传：接收拖到整列区域的图片文件
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) => SUPPORTED_TYPES[f.type]);
    if (files.length === 0) {
      setError('请拖入 PNG / JPG / WebP 图片');
      return;
    }
    setError(null);
    const next: Item[] = [];
    for (const file of files) {
      const kind = SUPPORTED_TYPES[file.type];
      const dataUrl = await readDataUrl(file);
      const img = await loadImage(dataUrl);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        kind,
        origSize: file.size,
        origWidth: img.naturalWidth,
        origHeight: img.naturalHeight,
        dataUrl,
      });
    }
    setItems((prev) => {
      const merged = [...prev, ...next];
      itemsRef.current = merged;
      queueMicrotask(() => recompress());
      return merged;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: 'flex-start' }}>
      {/* 左侧：图片列表（整列支持拖入） */}
      <Box
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!dragOver) setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          // 只在离开容器本身时清除（避免进入子元素反复闪）
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={handleDrop}
        sx={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          position: 'relative',
          borderRadius: 1,
          transition: 'background-color 160ms ease',
          outline: dragOver ? '2px dashed' : '2px dashed transparent',
          outlineColor: dragOver ? 'primary.main' : 'transparent',
          outlineOffset: dragOver ? -2 : 0,
        }}
      >
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
            <Box sx={{ fontSize: 36, opacity: 0.5 }}>🗜️</Box>
            <Typography variant="body2">上传 PNG / JPG / WebP 开始压缩</Typography>
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
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, mt: 0.5 }}>
              所有处理在浏览器内完成 · 保留原格式
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {items.map((it) => {
              const saved =
                it.outSize !== undefined
                  ? Math.round((1 - it.outSize / Math.max(it.origSize, 1)) * 100)
                  : null;
              return (
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
                  {/* 缩略图 */}
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

                  {/* 信息 */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        mt: 0.25,
                        color: 'text.secondary',
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: 11,
                      }}
                    >
                      <span>{it.kind.toUpperCase()}</span>
                      <span>·</span>
                      <span>
                        {it.origWidth}×{it.origHeight}
                      </span>
                      {it.outWidth && it.outWidth !== it.origWidth && (
                        <>
                          <span>→</span>
                          <span>
                            {it.outWidth}×{it.outHeight}
                          </span>
                        </>
                      )}
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        mt: 0.5,
                        alignItems: 'baseline',
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: 12,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: 11,
                        }}
                      >
                        原 {formatBytes(it.origSize)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: it.outSize !== undefined ? 'primary.main' : 'text.disabled',
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {it.done ? (
                          it.failed ? (
                            <span style={{ color: '#d32f2f' }}>处理失败</span>
                          ) : (
                            `→ ${formatBytes(it.outSize!)}`
                          )
                        ) : progress?.currentId === it.id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CircularProgress size={12} thickness={5} />
                            处理中…
                          </span>
                        ) : (
                          '等待中'
                        )}
                      </Typography>
                      {saved !== null && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: saved > 0 ? 'success.main' : 'text.disabled',
                            fontFamily: 'var(--font-geist-mono)',
                            fontSize: 11,
                          }}
                        >
                          {saved > 0 ? `−${saved}%` : saved < 0 ? `+${-saved}%` : '±0%'}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  {/* 操作 */}
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignItems: 'center' }}>
                    <Tooltip title="下载压缩结果">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => downloadOne(it)}
                          disabled={!it.done}
                          sx={{ color: 'text.secondary' }}
                        >
                          <DownloadIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="移除">
                      <IconButton
                        size="small"
                        onClick={() => removeAt(it.id)}
                        sx={{ color: 'text.secondary' }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* 操作行 */}
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
            {hasOut && (
              <Typography
                variant="caption"
                sx={{
                  color: savedPct > 0 ? 'success.main' : 'text.secondary',
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: 11,
                }}
              >
                共节省 {formatBytes(Math.max(0, totalOrig - totalOut))} ·{' '}
                {savedPct > 0 ? `−${savedPct}%` : '±0%'}
              </Typography>
            )}
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

        {working && progress && (
          <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                {progress.currentId ? '正在压缩…' : '收尾中…'}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}
              >
                {progress.done}/{progress.total}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(progress.done / progress.total) * 100}
            />
          </Box>
        )}
      </Box>

      {/* 右栏：参数 */}
      <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', display: 'block', mb: 1.5 }}>
          策略
        </Typography>

        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              保留格式
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.primary', fontFamily: 'var(--font-geist-mono)' }}>
              原 → 原
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, mt: 1 }}>
            自动选择最优压缩方式，保留原格式与尺寸，无需手动调参。图片全部在浏览器本地处理，不会上传。
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}