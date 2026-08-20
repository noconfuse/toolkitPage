'use client';

// 图片加水印：批量保护/标注。
// - 每张图片拥有独立的水印配置（类型 / 文字 / 颜色 / 字号 / 透明度 / 位置 / logo）。
// - 预览采用「原图 + 水印覆盖层 canvas」：拖动水印毫秒级跟手，不重新编码。
// - 切换缩略图秒开：水印预览 blob 缓存 + 原图解码缓存。
// - 全尺寸批量导出：仅重跑配置变化的图片（防抖 400ms），打包 ZIP 下载。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CheckIcon from '@mui/icons-material/Check';
import JSZip from 'jszip';
import FlowPill from '@/components/tools/FlowPill';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
  formatBytes,
  useContainSize,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import { useFlowInput, flowImagesToFiles, makeFlowImage, type FlowImage } from '@/lib/flow';

type WmType = 'text' | 'image';

type WmConfig = {
  type: WmType;
  text: string;
  color: string;
  fontSize: number; // 相对原图宽度的字号（px，导出时按原图尺寸）
  opacity: number; // 0.05-1
  pos: { x: number; y: number }; // 水印中心相对图片宽高的 0-1 比例
  logoDataUrl?: string;
  logoScale: number; // 相对原图宽度
};

const DEFAULT_CONFIG: WmConfig = {
  type: 'text',
  text: 'Watermark',
  color: '#FFFFFF',
  fontSize: 56,
  opacity: 0.75,
  pos: { x: 0.5, y: 0.5 },
  logoScale: 0.2,
};

const COLOR_PRESETS = ['#FFFFFF', '#0F1F1D', '#E53935', '#1E88E5', '#43A047', '#F6C445', '#8E24AA'];
const PREVIEW_MAX = 1200; // 预览 blob 最长边

type Item = {
  id: string;
  file: File;
  name: string;
  origSize: number;
  origWidth: number;
  origHeight: number;
  dataUrl: string;
  cfg: WmConfig;
  previewUrl?: string;
  previewCfg?: WmConfig;
  outUrl?: string;
  outBlob?: Blob;
  outSize?: number;
  outCfg?: WmConfig;
  done?: boolean;
  failed?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

// 原图 / logo 解码缓存：切换与重跑复用，避免重复解码
const imgCache = new Map<string, Promise<HTMLImageElement>>();
const loadImg = (src: string) => {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('图片解码失败'));
      i.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
};

const cfgEqual = (a?: WmConfig, b?: WmConfig): boolean =>
  !!a &&
  !!b &&
  a.type === b.type &&
  a.text === b.text &&
  a.color === b.color &&
  a.fontSize === b.fontSize &&
  a.opacity === b.opacity &&
  a.pos.x === b.pos.x &&
  a.pos.y === b.pos.y &&
  a.logoDataUrl === b.logoDataUrl &&
  a.logoScale === b.logoScale;

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const withAlpha = (hex: string, a: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
};
// 浅色文字配深描边，深色文字配白描边，保证深浅底图都可见
const strokeFor = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#0F1F1D' : '#FFFFFF';
};

let measureCtx: CanvasRenderingContext2D | null = null;
const measureTextSize = (text: string, fontSize: number): { w: number; h: number } => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return { w: fontSize * 0.6, h: fontSize * 1.2 };
  measureCtx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const m = measureCtx.measureText(text);
  const h = Math.max(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, fontSize * 0.9) * 1.15;
  const w = Math.max(m.width, fontSize * 0.6) * 1.1;
  return { w, h };
};

type DrawSpec = {
  ctx: CanvasRenderingContext2D;
  drawW: number; // 绘制区像素（预览 canvas 或原图尺寸）
  drawH: number;
  naturalW: number;
  naturalH: number;
  cfg: WmConfig;
  logo?: HTMLImageElement | null;
  showHandle?: boolean; // 预览时显示虚线框 + 中心点（不进导出图）
};

// 在给定绘制区上按 cfg 绘制水印（位置 clamp 保证完全在画内）
const drawWm = (spec: DrawSpec) => {
  const { ctx, drawW, drawH, naturalW, cfg, logo, showHandle } = spec;
  ctx.save();
  const scale = drawW / naturalW;
  const fontSize = cfg.fontSize * scale;

  let wmW: number;
  let wmH: number;
  if (cfg.type === 'image') {
    wmW = cfg.logoScale * drawW;
    wmH = logo ? (logo.naturalHeight / logo.naturalWidth) * wmW : wmW;
  } else {
    const text = cfg.text || '水印';
    const s = measureTextSize(text, fontSize);
    wmW = s.w;
    wmH = s.h;
  }
  if (wmW <= 0 || wmH <= 0) {
    ctx.restore();
    return;
  }

  const margin = fontSize * 0.12;
  const minX = wmW / 2 + margin;
  const maxX = Math.max(minX, drawW - wmW / 2 - margin);
  const minY = wmH / 2 + margin;
  const maxY = Math.max(minY, drawH - wmH / 2 - margin);
  const px = clamp(cfg.pos.x * drawW, minX, maxX);
  const py = clamp(cfg.pos.y * drawH, minY, maxY);

  if (cfg.type === 'image') {
    if (logo) {
      ctx.globalAlpha = cfg.opacity;
      ctx.drawImage(logo, px - wmW / 2, py - wmH / 2, wmW, wmH);
      ctx.globalAlpha = 1;
    }
  } else {
    const text = cfg.text || '水印';
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = withAlpha(strokeFor(cfg.color), Math.min(1, cfg.opacity + 0.35));
    ctx.lineWidth = Math.max(2, fontSize / 8);
    ctx.strokeText(text, px, py);
    ctx.fillStyle = withAlpha(cfg.color, cfg.opacity);
    ctx.fillText(text, px, py);
  }

  if (showHandle && wmW > 0) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#0F1F1D';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - wmW / 2 - 8, py - wmH / 2 - 8, wmW + 16, wmH + 16);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#E53935';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

// 降采样预览 blob（最长边 1200）
const renderPreview = async (it: Item, cfg: WmConfig): Promise<string> => {
  const img = await loadImg(it.dataUrl);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const scale = Math.min(1, PREVIEW_MAX / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.drawImage(img, 0, 0, w, h);
  const logo = cfg.type === 'image' && cfg.logoDataUrl ? await loadImg(cfg.logoDataUrl) : null;
  drawWm({ ctx, drawW: w, drawH: h, naturalW: nw, naturalH: nh, cfg, logo, showHandle: false });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('预览生成失败'))), 'image/png'),
  );
  return URL.createObjectURL(blob);
};

// 全尺寸导出（保持原格式，JPG/WebP 用 0.92 质量）
const exportOne = async (it: Item, cfg: WmConfig): Promise<Blob> => {
  const img = await loadImg(it.dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.drawImage(img, 0, 0, w, h);
  const logo = cfg.type === 'image' && cfg.logoDataUrl ? await loadImg(cfg.logoDataUrl) : null;
  drawWm({ ctx, drawW: w, drawH: h, naturalW: w, naturalH: h, cfg, logo, showHandle: false });
  const mime = it.file.type === 'image/jpeg' ? 'image/jpeg' : it.file.type === 'image/webp' ? 'image/webp' : 'image/png';
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), mime, mime === 'image/png' ? undefined : 0.92),
  );
};

const extOf = (t: string): string => (t === 'image/jpeg' ? 'jpg' : t === 'image/webp' ? 'webp' : 'png');

export default function WatermarkTool({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [progress, setProgress] = React.useState<{ total: number; done: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [sizeTick, setSizeTick] = React.useState(0);

  const itemsRef = React.useRef(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const dragRectRef = React.useRef<DOMRect | null>(null);
  const tokenRef = React.useRef(0);
  const processingRef = React.useRef(false);
  const [, setBatchTick] = React.useReducer((x: number) => x + 1, 0);

  const selectedItem = items.find((x) => x.id === selectedId) ?? null;

  // 预览撑满：按当前选中图宽高比 contain-fit 自适应容器
  const [fitRef, fitSize] = useContainSize(
    selectedItem?.origWidth ?? 0,
    selectedItem?.origHeight ?? 0,
    !!selectedItem,
  );

  // ───────── 文件添加 ─────────
  const appendFiles = async (files: File[]) => {
    const accepted = files.filter((f) => f.type.startsWith('image/'));
    if (!accepted.length) return;
    const next: Item[] = [];
    for (const file of accepted) {
      const dataUrl = await readDataUrl(file);
      const img = await loadImg(dataUrl);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        origSize: file.size,
        origWidth: img.naturalWidth,
        origHeight: img.naturalHeight,
        dataUrl,
        cfg: { ...DEFAULT_CONFIG },
      });
    }
    // 不限数量：预览与导出循环都是逐个顺序执行（天然分批），CPU 不会被打满
    setItems((prev) => [...prev, ...next]);
    setSelectedId((cur) => cur ?? next[0]?.id ?? null);
    // 预生成预览，保证首次切换秒开
    for (const it of next) {
      try {
        const url = await renderPreview(it, it.cfg);
        setItems((prev) =>
          prev.map((x) => (x.id === it.id ? { ...x, previewUrl: url, previewCfg: it.cfg } : x)),
        );
      } catch {
        /* 忽略预览失败 */
      }
    }
  };

  // 摄入工作流（?flow=）产物：一次性消费，避免重复摄入
  const flowInput = useFlowInput();
  const flowConsumed = React.useRef(false);
  React.useEffect(() => {
    if (flowConsumed.current || !flowInput?.images.length) return;
    flowConsumed.current = true;
    appendFiles(flowImagesToFiles(flowInput.images));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowInput]);

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await appendFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  // ToolWorkbench 统一处理拖拽（按文件列表分发）
  const onToolDrop = (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (list.length) void appendFiles(list);
  };

  // ───────── 增删改 ─────────
  const updateCfg = (patch: Partial<WmConfig>) => {
    const it = selectedItem;
    if (!it) return;
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, cfg: { ...p.cfg, ...patch } } : p)));
  };

  const removeAt = (id: string) => {
    const list = itemsRef.current;
    const it = list.find((x) => x.id === id);
    if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
    if (it?.outUrl) URL.revokeObjectURL(it.outUrl);
    const next = list.filter((x) => x.id !== id);
    setItems(next);
    setSelectedId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
  };

  const clearAll = () => {
    itemsRef.current.forEach((it) => {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    });
    setItems([]);
    setSelectedId(null);
  };

  React.useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      });
      imgCache.clear();
    };
  }, []);

  // ───────── 选中图预览：水印覆盖层（跟手）+ 防抖 blob 缓存 ─────────
  React.useEffect(() => {
    const it = selectedItem;
    const overlay = overlayRef.current;
    if (!it || !overlay) {
      overlay?.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
      return;
    }
    let cancelled = false;
    const cfg = it.cfg;
    void (async () => {
      const logo = cfg.type === 'image' && cfg.logoDataUrl ? await loadImg(cfg.logoDataUrl) : null;
      if (cancelled) return;
      const rect = imgRef.current?.getBoundingClientRect();
      const cw = Math.max(1, Math.round(rect?.width ?? overlay.width));
      const ch = Math.max(1, Math.round(rect?.height ?? overlay.height));
      overlay.width = cw;
      overlay.height = ch;
      const ctx = overlay.getContext('2d');
      if (ctx) {
        drawWm({ ctx, drawW: cw, drawH: ch, naturalW: it.origWidth, naturalH: it.origHeight, cfg, logo, showHandle: true });
      }
    })();
    const t = setTimeout(async () => {
      if (cancelled) return;
      if (cfgEqual(it.previewCfg, cfg)) return; // 已有同配置预览
      try {
        const url = await renderPreview(it, cfg);
        if (cancelled) return;
        setItems((prev) =>
          prev.map((x) => {
            if (x.id !== it.id) return x;
            if (x.previewUrl && x.previewUrl !== url) URL.revokeObjectURL(x.previewUrl);
            return { ...x, previewUrl: url, previewCfg: cfg };
          }),
        );
      } catch {
        /* 忽略 */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedItem?.cfg, sizeTick]);

  // 容器尺寸变化（窗口缩放 / 首次布局）时重绘覆盖层
  React.useLayoutEffect(() => {
    const el = imgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSizeTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedId]);

  // ───────── 拖拽定位（window 级监听，指针移出容器不中断） ─────────
  const updatePosFromClient = React.useCallback(
    (clientX: number, clientY: number) => {
      const it = selectedItem;
      const rect = dragRectRef.current;
      if (!it || !rect || rect.width <= 0 || rect.height <= 0) return;
      const x = clamp01((clientX - rect.left) / rect.width);
      const y = clamp01((clientY - rect.top) / rect.height);
      setItems((prev) =>
        prev.map((p) => (p.id === it.id ? { ...p, cfg: { ...p.cfg, pos: { x, y } } } : p)),
      );
    },
    [selectedItem],
  );

  const onPreviewPointerDown = (e: React.PointerEvent) => {
    const imgEl = imgRef.current;
    if (!imgEl || !selectedItem) return;
    dragRectRef.current = imgEl.getBoundingClientRect();
    setDragging(true);
    updatePosFromClient(e.clientX, e.clientY);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updatePosFromClient(e.clientX, e.clientY);
    const onUp = () => {
      setDragging(false);
      dragRectRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, updatePosFromClient]);

  // ───────── 全尺寸批量导出（仅处理配置变化的图片） ─────────
  const processStale = React.useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    const myToken = ++tokenRef.current;
    try {
      const list = itemsRef.current;
      const stale = list.filter((it) => !cfgEqual(it.outCfg, it.cfg));
      if (!stale.length) return;
      const staleIds = new Set(stale.map((s) => s.id));
      setItems((prev) =>
        prev.map((p) => (staleIds.has(p.id) ? { ...p, done: false, failed: false } : p)),
      );
      if (stale.length > 1) {
        setWorking(true);
        setProgress({ total: stale.length, done: 0 });
      }
      let doneCount = 0;
      for (const it of stale) {
        if (tokenRef.current !== myToken) return;
        try {
          const blob = await exportOne(it, it.cfg);
          if (tokenRef.current !== myToken) return;
          doneCount++;
          setItems((prev) =>
            prev.map((p) => {
              if (p.id !== it.id) return p;
              if (p.outUrl) URL.revokeObjectURL(p.outUrl);
              return {
                ...p,
                outUrl: URL.createObjectURL(blob),
                outBlob: blob,
                outSize: blob.size,
                outCfg: it.cfg,
                done: true,
                failed: false,
              };
            }),
          );
        } catch (e) {
          console.error('[Watermark] 导出失败', it.name, e);
          doneCount++;
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, done: true, failed: true } : p)));
        }
        if (stale.length > 1) setProgress({ total: stale.length, done: doneCount });
      }
    } finally {
      processingRef.current = false;
      setWorking(false);
      setProgress(null);
      setBatchTick();
    }
  }, []);

  React.useEffect(() => {
    const stale = items.some((it) => !cfgEqual(it.outCfg, it.cfg));
    if (!stale) return;
    const t = setTimeout(() => {
      void processStale();
    }, 400);
    return () => clearTimeout(t);
  }, [items, processStale]);

  // ───────── 下载 ─────────
  const downloadOne = async (it: Item) => {
    let blob = it.outBlob;
    if (!blob) {
      try {
        blob = await exportOne(it, it.cfg);
      } catch {
        return;
      }
    }
    const base = it.name.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = it.outUrl ?? URL.createObjectURL(blob);
    a.download = `${base}-wm.${extOf(it.file.type)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = async () => {
    const done = items.filter((it): it is Item & { outBlob: Blob } => !!it.outBlob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      const base = it.name.replace(/\.[^.]+$/, '');
      let name = `${base}-wm.${extOf(it.file.type)}`;
      let i = 1;
      while (used.has(name)) {
        name = `${base}-wm-${i}.${extOf(it.file.type)}`;
        i++;
      }
      used.add(name);
      zip.file(name, it.outBlob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watermarked-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedItem) return;
    void (async () => {
      const dataUrl = await readDataUrl(file);
      updateCfg({ logoDataUrl: dataUrl });
      void loadImg(dataUrl).catch(() => {});
    })();
    e.target.value = '';
  };

  const applyToAll = () => {
    if (!selectedItem) return;
    setItems((prev) => prev.map((p) => ({ ...p, cfg: { ...selectedItem.cfg } })));
  };

  const hasOut = items.some((it) => it.outBlob);
  const totalSize = items.reduce((s, it) => s + it.origSize, 0);
  const cfg = selectedItem?.cfg;

  // 工作流出口：已完成产物构造 FlowImage[]（加水印保留原文件名与尺寸，直接复用 origWidth/origHeight）
  const flowImages = React.useMemo<FlowImage[]>(
    () =>
      items
        .filter((it): it is Item & { outBlob: Blob } => !!it.outBlob)
        .map((it) => makeFlowImage(it.outBlob, it.name, it.origWidth, it.origHeight)),
    [items],
  );

  return (
    <ToolWorkbench
      title={title}
      description={description}
      hasContent={items.length > 0}
      onDrop={onToolDrop}
      usage={
        <TipCard
          icon={<OpenWithIcon />}
          text="上传图片后在预览图上按住拖动即可调整水印位置；每张图可独立设置水印类型、文字、颜色与透明度。"
        />
      }
      config={
        selectedItem && cfg ? (
          <>
            <SidebarTitle>水印设置</SidebarTitle>
            <Stack spacing={2.25}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  水印类型
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  fullWidth
                  value={cfg.type}
                  onChange={(_, v) => v && updateCfg({ type: v as WmType })}
                >
                  <ToggleButton value="text">文字</ToggleButton>
                  <ToggleButton value="image">图片</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {cfg.type === 'text' && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    水印文字
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={cfg.text}
                    onChange={(e) => updateCfg({ text: e.target.value })}
                    placeholder="输入水印文字"
                  />
                </Box>
              )}

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  颜色
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {COLOR_PRESETS.map((c) => {
                    const active = cfg.color.toLowerCase() === c.toLowerCase();
                    return (
                      <Box
                        key={c}
                        onClick={() => updateCfg({ color: c })}
                        sx={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          bgcolor: c,
                          border: 1,
                          borderColor: 'rgba(0,0,0,0.16)',
                          boxShadow: active ? '0 0 0 2px rgba(15,61,58,0.3)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'box-shadow 160ms ease',
                        }}
                      >
                        {active && (
                          <CheckIcon
                            sx={{
                              fontSize: 14,
                              color: (0.299 * hexToRgb(c)[0] + 0.587 * hexToRgb(c)[1] + 0.114 * hexToRgb(c)[2]) / 255 > 0.5
                                ? '#0F1F1D'
                                : '#FFFFFF',
                            }}
                          />
                        )}
                      </Box>
                    );
                  })}
                  <label
                    style={{
                      position: 'relative',
                      width: 26,
                      height: 26,
                      cursor: 'pointer',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '1px dashed rgba(0,0,0,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="自定义颜色"
                  >
                    <ColorLensIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <input
                      type="color"
                      value={cfg.color}
                      onChange={(e) => updateCfg({ color: e.target.value })}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                  </label>
                </Stack>
              </Box>
              {/* CONFIG_BODY_2 */}
              {cfg.type === 'text' && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    字号 · {Math.round(cfg.fontSize)}px
                  </Typography>
                  <Slider
                    size="small"
                    value={cfg.fontSize}
                    min={12}
                    max={160}
                    onChange={(_, v) => updateCfg({ fontSize: v as number })}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              )}

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  不透明度 · {Math.round(cfg.opacity * 100)}%
                </Typography>
                <Slider
                  size="small"
                  value={cfg.opacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(_, v) => updateCfg({ opacity: v as number })}
                  sx={{ mt: 0.5 }}
                />
              </Box>

              {cfg.type === 'image' && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                    水印图片
                  </Typography>
                  {cfg.logoDataUrl && (
                    <Box
                      sx={{
                        mb: 1,
                        width: 48,
                        height: 48,
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        bgcolor: '#fff',
                      }}
                    >
                      <img src={cfg.logoDataUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                    </Box>
                  )}
                  <Button variant="outlined" size="small" fullWidth component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
                    上传水印图片
                    <input type="file" accept="image/*" hidden onChange={handleLogo} />
                  </Button>
                </Box>
              )}

              {cfg.type === 'image' && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    水印大小 · {Math.round(cfg.logoScale * 100)}%
                  </Typography>
                  <Slider
                    size="small"
                    value={cfg.logoScale}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    onChange={(_, v) => updateCfg({ logoScale: v as number })}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              )}

            </Stack>
          </>
        ) : undefined
      }
      resource={
        <SidebarResourceInfo
          data={{
            name: items.length ? `${items.length} 张图片` : undefined,
            before: items.length ? { size: totalSize } : undefined,
            extra: hasOut
              ? [{ label: '已导出', value: `${items.filter((x) => x.outBlob).length} 张` }]
              : undefined,
          }}
        />
      }
      flow={flowImages.length > 0 ? <FlowPill images={flowImages} /> : undefined}
      actions={
        <Stack spacing={1}>
          {working && progress && (
            <Box>
              <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                  正在导出…
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
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" size="small" component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
              继续添加
              <input type="file" accept="image/*" multiple hidden onChange={handleAdd} />
            </Button>
            <Button
              variant="text"
              size="small"
              color="inherit"
              startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
              onClick={clearAll}
              disabled={items.length === 0}
              sx={{ color: 'text.secondary' }}
            >
              清空
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
              onClick={applyToAll}
              disabled={!selectedItem || items.length < 2}
              sx={{ textTransform: 'none' }}
            >
              将此配置应用到全部图片
            </Button>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
              {items.length} 张 · {formatBytes(totalSize)}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              size="small"
              onClick={() => void downloadAll()}
              disabled={!hasOut || working}
              startIcon={<FolderZipIcon sx={{ fontSize: 16 }} />}
            >
              打包 ZIP
            </Button>
          </Stack>
        </Stack>
      }
      emptyState={
        <Box
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
          }}
        >
          <Box sx={{ fontSize: 36, opacity: 0.5 }}>💧</Box>
          <Typography variant="body2">上传图片，在预览图上拖动即可放置水印</Typography>
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 1 }}
          >
            选择图片
            <input type="file" accept="image/*" multiple hidden onChange={handleAdd} />
          </Button>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, mt: 0.5 }}>
            每张图可独立设置水印
          </Typography>
        </Box>
      }
    >
      {/* ───────── 主区：预览 + 缩略图 + 工具栏 ───────── */}
            <Box
              ref={fitRef}
              onPointerDown={onPreviewPointerDown}
              sx={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: dragging ? 'grabbing' : selectedItem ? 'grab' : 'default',
                touchAction: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: fitSize ? fitSize.w : '100%',
                  height: fitSize ? fitSize.h : '100%',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <img
                  ref={imgRef}
                  src={selectedItem ? (selectedItem.previewUrl ?? selectedItem.dataUrl) : undefined}
                  alt=""
                  draggable={false}
                  decoding="async"
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <canvas
                  ref={overlayRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                />
              </Box>
            </Box>

            {/* 选中图快捷操作 */}
            {selectedItem && (
              <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedItem.name} · {selectedItem.origWidth}×{selectedItem.origHeight} · {formatBytes(selectedItem.origSize)}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="下载当前图片">
                  <span>
                    <IconButton size="small" onClick={() => void downloadOne(selectedItem)} sx={{ color: 'text.secondary' }}>
                      <DownloadIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="移除当前图片">
                  <IconButton size="small" onClick={() => removeAt(selectedItem.id)} sx={{ color: 'text.secondary' }}>
                    <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}

            {/* 缩略图横条 */}
            {items.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: 'auto', pb: 1 }}>
                {items.map((it) => {
                  const active = it.id === selectedId;
                  return (
                    <Box
                      key={it.id}
                      onClick={() => setSelectedId(it.id)}
                      sx={{
                        position: 'relative',
                        width: 64,
                        height: 64,
                        flexShrink: 0,
                        borderRadius: 1,
                        cursor: 'pointer',
                        border: 2,
                        borderColor: active ? 'primary.main' : 'divider',
                        bgcolor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={it.previewUrl ?? it.dataUrl}
                        alt={it.name}
                        decoding="async"
                        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          bgcolor: 'rgba(0,0,0,0.45)',
                          color: '#fff',
                          fontSize: 9,
                          lineHeight: '14px',
                          px: 0.5,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {it.name}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
    </ToolWorkbench>
  );
}
