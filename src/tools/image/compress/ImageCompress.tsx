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
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import JSZip from 'jszip';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
  formatBytes,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import FlowPill from '@/components/tools/FlowPill';
import LibImageQuant from 'libimagequant-wasm';
import { getMozJpeg } from '../_lib/encoders';
import { useFlowInput, flowImagesToFiles, makeFlowImage, type FlowImage } from '@/lib/flow';

type ImgKind = 'png' | 'jpeg' | 'webp';

type Item = {
  id: string;
  file: File;
  name: string;
  relPath: string; // 目录内相对路径（拖入文件夹时保留结构；多选文件时为文件名）
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
  // 失败原因（failed 时展示）
  failReason?: string;
  // true = 原文件损坏/被截断，已回退 canvas 容错编码（输出为不完整图）
  corrupt?: boolean;
  // true = 回退结果比原文件大，已保留原文件
  keptOriginal?: boolean;
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

// ───────── 文件夹拖拽遍历（webkitGetAsEntry 保留目录结构）─────────
type DirEntry = { path: string; file: File };

function readEntry(entry: FileSystemEntry, path: string): Promise<DirEntry[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => resolve([{ path, file }]),
        () => resolve([]),
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries(
          (entries) => {
            if (entries.length === 0) {
              Promise.all(all.map((e) => readEntry(e, path ? `${path}/${e.name}` : e.name))).then(
                (arrs) => resolve(arrs.flat()),
              );
            } else {
              all.push(...entries);
              readBatch();
            }
          },
          () => resolve([]),
        );
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

function traverseDataTransfer(dt: DataTransfer): Promise<DirEntry[]> {
  const items = Array.from(dt.items);
  const entries = items
    .map((it) => (it as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return Promise.resolve([]);
  return Promise.all(entries.map((e) => readEntry(e, e.name))).then((arrs) => arrs.flat());
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('图片解码失败'));
    i.src = src;
  });

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
// 编码器按格式选是算法必然，但对外只有一个 compressOne(it) → { blob, corrupt }。
// corrupt=true 表示原文件损坏/被截断，严格编解码器无法处理，已回退到容错编码。
// keptOriginal=true 表示回退结果比原文件还大，已保留原文件（压缩工具不产出更大的结果）。
type CompressResult = { blob: Blob; corrupt: boolean; keptOriginal?: boolean };

const compressOne = async (it: Item): Promise<CompressResult> => {
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

  // canvas 兜底编码（对截断/损坏图宽容，能解出部分内容）
  const canvasPng = () =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 编码失败'))), 'image/png');
    });
  const canvasJpeg = () =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPEG 编码失败'))),
        'image/jpeg',
        JPEG_QUALITY / 100,
      );
    });

  // 截断/损坏 PNG 的容错回退：优先量化成调色板 PNG（体积小，接近原索引图），
  // 量化失败再退回 canvas PNG 并过 oxipng 无损优化。
  // 安全网：回退结果仍比原文件大 → 保留原文件（压缩工具不产出比输入更大的结果）。
  const fallbackPng = async (): Promise<{ blob: Blob; keptOriginal: boolean }> => {
    let blob: Blob;
    try {
      const quantizer = await getQuantizer();
      const result = await quantizer.quantizeImageData(ctx.getImageData(0, 0, w, h), PNG_QUANTIZE_OPTS);
      blob = new Blob([new Uint8Array(result.pngBytes)], { type: 'image/png' });
    } catch (e) {
      console.warn('[ImageCompress] 回退量化失败，canvas PNG + oxipng:', it.name, e);
      const raw = await canvasPng();
      try {
        const { optimise } = await getOxipng();
        const out = await optimise(await raw.arrayBuffer(), { level: 2 });
        blob = new Blob([out], { type: 'image/png' });
      } catch {
        blob = raw;
      }
    }
    if (blob.size > it.file.size) {
      console.warn('[ImageCompress] 回退结果比原文件大，保留原文件:', it.name);
      return { blob: it.file, keptOriginal: true };
    }
    return { blob, keptOriginal: false };
  };

  // ② 编码（按格式选最佳实践编码器，一次成型）
  if (it.kind === 'png') {
    // 读 IHDR 区分「索引/灰度图」与「真彩照片」
    const head = new Uint8Array(await it.file.slice(0, 33).arrayBuffer());
    const info = readPngInfo(head);
    const lossless =
      info !== null && (info.bitDepth !== 8 || info.colorType === 0 || info.colorType === 3 || info.colorType === 4);
    if (lossless) {
      // 索引色 / 灰度图：已是调色板格式，再量化只会变大 → oxipng 无损重压缩（level 2 实测 −8%)
      try {
        const { optimise } = await getOxipng();
        const out = await optimise(await it.file.arrayBuffer(), { level: 2 });
        return { blob: new Blob([out], { type: 'image/png' }), corrupt: false };
      } catch (e) {
        // 截断/损坏的 PNG 会让 oxipng 的 wasm 解码 panic（unwrap_throw failed）→ 回退量化 PNG
        console.warn('[ImageCompress] oxipng 失败，回退量化 PNG:', it.name, e);
        const { blob, keptOriginal } = await fallbackPng();
        return { blob, corrupt: true, keptOriginal };
      }
    }
    // 真彩 PNG：调色板量化，一次成型（libimagequant 运行在自己的 worker 里，不阻塞主线程）。
    // 优先量化原文件字节（worker 内解码，快）；若 wasm 解码器不支持该 PNG
    // （interlaced / 16bit 等）会抛错，回退到 canvas 解码的 RGBA 走 quantizeImageData。
    const quantizer = await getQuantizer();
    try {
      const result = await quantizer.quantizePng(it.file, PNG_QUANTIZE_OPTS);
      return { blob: new Blob([new Uint8Array(result.pngBytes)], { type: 'image/png' }), corrupt: false };
    } catch {
      console.warn('[ImageCompress] wasm 无法解码该 PNG，回退 RGBA 量化:', it.name);
      try {
        const result = await quantizer.quantizeImageData(ctx.getImageData(0, 0, w, h), PNG_QUANTIZE_OPTS);
        return { blob: new Blob([new Uint8Array(result.pngBytes)], { type: 'image/png' }), corrupt: false };
      } catch (e) {
        // 量化也失败（如截断图）→ 回退量化 PNG（含安全网）
        console.warn('[ImageCompress] 量化失败，回退量化 PNG:', it.name, e);
        const { blob, keptOriginal } = await fallbackPng();
        return { blob, corrupt: true, keptOriginal };
      }
    }
  }

  if (it.kind === 'jpeg') {
    // MozJPEG：与 tinyjpg 同源的编码器，同视觉档位下比浏览器 canvas 小得多
    try {
      const { encode } = await getMozJpeg();
      const out = await encode(ctx.getImageData(0, 0, w, h), { quality: JPEG_QUALITY });
      return { blob: new Blob([out], { type: 'image/jpeg' }), corrupt: false };
    } catch (e) {
      // 截断/损坏的 JPG 会让 MozJPEG 的 wasm 解码 panic → 回退 canvas JPEG
      console.warn('[ImageCompress] MozJPEG 失败，回退 canvas JPEG:', it.name, e);
      const blob = await canvasJpeg();
      // 安全网：回退结果比原文件大 → 保留原文件
      if (blob.size > it.file.size) {
        console.warn('[ImageCompress] 回退结果比原文件大，保留原文件:', it.name);
        return { blob: it.file, corrupt: true, keptOriginal: true };
      }
      return { blob, corrupt: true };
    }
  }

  // WebP：浏览器原生 libwebp 编码（canvas + toBlob，宽容）
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 失败'))), 'image/webp', WEBP_QUALITY);
  });
  return { blob, corrupt: false };
};

export default function ImageCompress({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
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

  // 摄入工作流（?flow=）产物：一次性消费，避免重复摄入
  const flowInput = useFlowInput();
  const flowConsumed = React.useRef(false);
  React.useEffect(() => {
    if (flowConsumed.current || !flowInput?.images.length) return;
    flowConsumed.current = true;
    appendFiles(flowImagesToFiles(flowInput.images).map((f) => ({ file: f, relPath: f.name })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowInput]);

  // 文件摄入：SUPPORTED_TYPES 过滤 → 解码 → 构造 Item 推入列表，并触发一次重压
  const appendFiles = async (list: { file: File; relPath: string }[]) => {
    if (!list.length) return;
    setError(null);
    const next: Item[] = [];
    for (const { file, relPath } of list) {
      const kind = SUPPORTED_TYPES[file.type];
      if (!kind) continue;
      const dataUrl = await readDataUrl(file);
      const img = await loadImage(dataUrl);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        relPath,
        kind,
        origSize: file.size,
        origWidth: img.naturalWidth,
        origHeight: img.naturalHeight,
        dataUrl,
      });
    }
    // 不限数量：处理循环本身逐个顺序执行（天然分批），CPU 不会被打满
    setItems((prev) => {
      const merged = [...prev, ...next];
      // 把最新数组写到 ref，方便 recompress 读到
      itemsRef.current = merged;
      // 上传后立即触发一次重压
      queueMicrotask(() => recompress());
      return merged;
    });
  };

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) await appendFiles(files.map((f) => ({ file: f, relPath: f.name })));
  };

  const handleAddFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) {
      await appendFiles(
        files.map((f) => {
          // webkitdirectory 输入的文件带 webkitRelativePath（含子目录结构）
          const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
          return { file: f, relPath: rel && rel !== f.name ? rel : f.name };
        }),
      );
    }
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
      failReason: undefined,
      corrupt: false,
      keptOriginal: false,
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
          const { blob, corrupt, keptOriginal } = await compressOne(src);
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
            corrupt,
            keptOriginal,
          };
        } catch (e) {
          console.error('[ImageCompress] failed', src.name, e);
          out[i] = {
            ...out[i],
            done: true,
            failed: true,
            failReason: e instanceof Error ? e.message : '未知错误',
          };
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

  // 卸载时释放 url
  React.useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    };
  }, []);

  const downloadOne = (it: Item) => {
    if (!it.done || !it.outUrl) return;
    const ext = extOf(it.name, it.kind);
    const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
    const a = document.createElement('a');
    a.href = it.outUrl;
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 全部打包为一个 ZIP 下载；保留目录结构（拖入文件夹时），同名文件自动加序号避免覆盖
  const downloadAll = async () => {
    const done = items.filter((it): it is Item & { outBlob: Blob } => !!it.outBlob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      const ext = extOf(it.name, it.kind);
      const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
      // 优先用相对路径（保留目录结构）；多选文件时 relPath 即文件名
      const dir = it.relPath.includes('/') ? it.relPath.slice(0, it.relPath.lastIndexOf('/') + 1) : '';
      let name = `${dir}${base}.${ext}`;
      let i = 1;
      while (used.has(name)) {
        name = `${dir}${base}-${i}.${ext}`;
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
  // 处理失败项（用于底部结果总结）
  const failedItems = items.filter((it) => it.done && it.failed);
  const failedCount = failedItems.length;

  // 结果态串流出口：把已完成项还原为 FlowImage[] 交给 FlowPill（尺寸与原图一致，直接用已有字段）
  const flowImages: FlowImage[] = React.useMemo(
    () =>
      items
        .filter(
          (it): it is Item & { outBlob: Blob; outWidth: number; outHeight: number } =>
            !!(it.done && it.outBlob),
        )
        .map((it) => makeFlowImage(it.outBlob, it.name, it.outWidth, it.outHeight)),
    [items],
  );

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);

  // 拖入上传：接收 ToolWorkbench 外壳转发的文件列表；优先用 DataTransfer 遍历文件夹结构
  const handleDrop = async (files: FileList | null, dt?: DataTransfer) => {
    if (!files) return;
    if (dt) {
      try {
        const dirEntries = await traverseDataTransfer(dt);
        if (dirEntries.length) {
          await appendFiles(dirEntries.map((d) => ({ file: d.file, relPath: d.path })));
          return;
        }
      } catch {
        // 回退到扁平文件列表
      }
    }
    const list = Array.from(files).filter((f) => SUPPORTED_TYPES[f.type]);
    if (list.length === 0) {
      setError('请拖入 PNG / JPG / WebP 图片或文件夹');
      return;
    }
    setError(null);
    await appendFiles(list.map((f) => ({ file: f, relPath: f.name })));
  };

  return (
    <ToolWorkbench
      title={title}
      description={description}
      hasContent={items.length > 0}
      onPickFile={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      emptyState={
        <Box
          onClick={() => fileInputRef.current?.click()}
          sx={{
            width: '100%',
            minHeight: 320,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: '#fafaf7',
            backgroundImage: dropzoneBg,
            backgroundSize: dropzoneBgSize,
            backgroundPosition: dropzoneBgPos,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            color: 'text.secondary',
            cursor: 'pointer',
          }}
        >
          <Typography variant="body2">上传图片或拖入文件夹开始压缩</Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              component="label"
              startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => e.stopPropagation()}
            >
              选择文件夹
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory 非标准属性
                webkitdirectory=""
                multiple
                hidden
                onChange={handleAddFolder}
              />
            </Button>
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => e.stopPropagation()}
            >
              选择图片
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={handleAdd}
              />
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, mt: 0.5 }}>
            保留原格式 · 拖入文件夹时保留目录结构
          </Typography>
        </Box>
      }
      usage={
        <TipCard
          icon={<UploadFileIcon />}
          text="上传 PNG / JPG / WebP 图片，自动选择最优压缩方式，保留原格式与尺寸，无需手动调参。"
        />
      }
      config={
        <Box>
          <SidebarTitle>压缩策略</SidebarTitle>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                保留格式
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.primary', fontFamily: 'var(--font-geist-mono)' }}>
                原 → 原
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10 }}>
              自动选择最优压缩方式，保留原格式与尺寸，无需手动调参。
            </Typography>
          </Stack>
        </Box>
      }
      resource={
        items.length > 0 ? (
          <Box>
            <SidebarTitle>资源信息</SidebarTitle>
            <SidebarResourceInfo
              data={{
                name: `${items.length} 张图片`,
                before: { size: totalOrig },
                after: hasOut ? { size: totalOut } : undefined,
                extra: hasOut ? [{ label: '节省', value: `${savedPct}%` }] : undefined,
              }}
            />
          </Box>
        ) : undefined
      }
      flow={flowImages.length > 0 ? <FlowPill images={flowImages} /> : undefined}
      actions={
        <Stack spacing={1}>
          {working && progress && (
            <Box>
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
              <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
            </Box>
          )}
          {failedCount > 0 && !working && (
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: 1,
                borderColor: 'error.main',
                bgcolor: 'rgba(211,47,47,0.06)',
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: 12, color: 'error.main', fontWeight: 600 }}>
                    {failedCount} 张图片压缩失败
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: 11,
                      display: 'block',
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {failedItems.map((it) => it.name).join('、')}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}
          {items.length > 0 && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Button variant="outlined" size="small" component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
                继续添加
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={handleAdd}
                />
              </Button>
              <Button
                variant="outlined"
                size="small"
                component="label"
                startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
              >
                添加文件夹
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error webkitdirectory 非标准属性
                  webkitdirectory=""
                  multiple
                  hidden
                  onChange={handleAddFolder}
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
        </Stack>
      }
    >
      {/* 左主区：图片列表（拖拽上传由 ToolWorkbench 外壳统一处理） */}
      <Stack
        spacing={1.5}
        sx={{
          // 列表在容器内自适应：flex:1 撑满资源操作区，内容超高时内部滚动，不把下方操作栏顶开
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
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
                      {it.relPath}
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
                    {it.failed && it.failReason && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#d32f2f',
                          fontSize: 11,
                          display: 'block',
                          mt: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {it.failReason}
                      </Typography>
                    )}
                    {it.corrupt && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'warning.main',
                          fontSize: 11,
                          display: 'block',
                          mt: 0.5,
                        }}
                      >
                        {it.keptOriginal
                          ? '原文件已损坏，压缩后体积更大，已保留原文件'
                          : '原文件已损坏，输出为不完整内容'}
                      </Typography>
                    )}
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
    </ToolWorkbench>
  );
}