'use client';

import * as React from 'react';
import { pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DrawIcon from '@mui/icons-material/Draw';
import { SelectedOverlay } from '@/components/tools/SelectedOverlay';
import { SignaturePad } from './SignaturePad';
import {
  clampInside,
  computeMove,
  computeResize,
  computeRotate,
  hitInside,
  pickCorner,
  type Point,
} from '@/tools/image/combine/_lib/transform';

// 使用本地 worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// 页面像素 = PDF pt × 2（≈144dpi，屏幕显示清晰），也是贴图层的坐标域
const PAGE_RENDER_SCALE = 2;
const HIT_SIZE = 12; // px（屏幕坐标，命中半径）

/** 贴图层（与 ImageCombine 的 Layer 完全一致的数据模型：中心 + 宽高 + 旋转，canvas 像素域） */
type StampLayer = {
  id: string;
  img: HTMLImageElement;
  url: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number; // radians
  opacity: number; // 0-1
  name: string;
};

type DragState =
  | { kind: 'none' }
  | { kind: 'move'; layerId: string; offsetX: number; offsetY: number }
  | {
      kind: 'resize';
      layerId: string;
      startCx: number;
      startCy: number;
      startW: number;
      startH: number;
      startRotation: number;
    }
  | {
      kind: 'rotate';
      layerId: string;
      startAngle: number;
      startRotation: number;
      center: Point;
    };

export default function PdfStamp() {
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<{ width: number; height: number } | null>(null); // PDF pt
  const [vpSize, setVpSize] = React.useState<{ w: number; h: number } | null>(null); // 页面像素（贴图层坐标域）

  const [layers, setLayers] = React.useState<StampLayer[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragState, setDragState] = React.useState<DragState>({ kind: 'none' });
  const [scale, setScale] = React.useState(1); // 屏幕 px / 页面 px
  const [exporting, setExporting] = React.useState(false);
  const [signatureMode, setSignatureMode] = React.useState(false);
  const [, setError] = React.useState<string | null>(null);

  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const layerCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = React.useRef<{ cancel: () => void } | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;

  // ───────── 渲染 PDF 页面到 base canvas（每页一次，切页时取消上一次渲染） ─────────
  React.useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const run = async () => {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PAGE_RENDER_SCALE });
      const canvas = baseCanvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTaskRef.current?.cancel();
      // pdfjs-dist 5.x：render 需要直接传 canvas（内部取 2d context）
      const task = page.render({ canvas, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        return; // 被取消（快速切页）
      }
      if (cancelled) return;
      setPageSize({ width: page.view[2], height: page.view[3] });
      setVpSize({ w: viewport.width, h: viewport.height });
    };
    run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [doc, pageNumber]);

  // ───────── 叠加层 canvas：每帧按 layers state 重绘（状态即所见，与 ImageCombine 一致） ─────────
  React.useEffect(() => {
    const canvas = layerCanvasRef.current;
    if (!canvas || !vpSize) return;
    canvas.width = vpSize.w;
    canvas.height = vpSize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, vpSize.w, vpSize.h);
    for (const l of layers) {
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.translate(l.cx, l.cy);
      ctx.rotate(l.rotation);
      ctx.drawImage(l.img, -l.w / 2, -l.h / 2, l.w, l.h);
      ctx.restore();
    }
  }, [layers, vpSize]);

  // ───────── 暴露 scale（只用于命中半径换算） ─────────
  React.useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(vpSize ? rect.width / vpSize.w : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vpSize]);

  // ───────── 销毁 pdf 文档 ─────────
  React.useEffect(() => {
    return () => {
      doc?.destroy();
    };
  }, [doc]);

  // 屏幕 → 页面像素坐标（与 ImageCombine 的 screenToCanvas 一致）
  const screenToCanvas = React.useCallback(
    (sx: number, sy: number): Point | null => {
      const el = surfaceRef.current;
      if (!el || !vpSize) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: ((sx - rect.left) / rect.width) * vpSize.w,
        y: ((sy - rect.top) / rect.height) * vpSize.h,
      };
    },
    [vpSize],
  );

  const handlePdfChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('请选择 PDF 文件');
      return;
    }
    setError(null);
    const data = await file.arrayBuffer();
    const newDoc = await pdfjs.getDocument({ data }).promise;
    setDoc(newDoc);
    setPageCount(newDoc.numPages);
    setPageNumber(1);
    setLayers([]);
    setSelectedId(null);
    setVpSize(null);
    setPageSize(null);
    setPdfFile(file);
  };

  const readImage = (file: File) =>
    new Promise<{ img: HTMLImageElement; url: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        const i = new Image();
        i.onload = () => resolve({ img: i, url });
        i.onerror = reject;
        i.src = url;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // 把一张已加载的图直接入栈（落点：右下角，签名场景默认位置）
  const addLayerFromImage = (
    img: HTMLImageElement,
    url: string,
    name: string,
    place: 'center' | 'br' = 'center',
  ) => {
    if (!vpSize) return;
    const ratio = Math.min((vpSize.w * 0.6) / img.width, (vpSize.h * 0.6) / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const cx = place === 'br' ? vpSize.w - w / 2 - 24 : vpSize.w / 2;
    const cy = place === 'br' ? vpSize.h - h / 2 - 24 : vpSize.h / 2;
    const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const layer: StampLayer = {
      id,
      img,
      url,
      cx,
      cy,
      w,
      h,
      rotation: 0,
      opacity: 1,
      name,
    };
    setLayers((prev) => [...prev, layer]);
    setSelectedId(id);
  };

  const handleOverlayFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (!vpSize) return;
    setError(null);
    const { img, url } = await readImage(file);
    addLayerFromImage(img, url, file.name, 'center');
    event.target.value = '';
  };

  // 手写签名板落点：把 dataURL 当图片加载，落入画布右下角（签名常见位置）
  const handleSignatureDone = async (pngDataUrl: string) => {
    if (!vpSize) return;
    const img = new Image();
    img.src = pngDataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('签名图加载失败'));
    });
    addLayerFromImage(img, pngDataUrl, `手写签名-${Date.now()}`, 'br');
    setSignatureMode(false);
  };

  // ───────── 鼠标按下（与 ImageCombine 完全一致） ─────────
  const onSurfaceMouseDown = (e: React.MouseEvent) => {
    // 如果点在覆盖层控件上（删除按钮 / 角点 / 旋转柄），让它们自己处理
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-overlay-control]')) {
      return;
    }
    const p = screenToCanvas(e.clientX, e.clientY);
    if (!p) return;

    // 1) 如果有选中层，先检查是否点在角点 / 旋转柄 / 内部
    if (selectedLayer) {
      const corner = pickCorner(
        p,
        selectedLayer.cx,
        selectedLayer.cy,
        selectedLayer.w,
        selectedLayer.h,
        selectedLayer.rotation,
        HIT_SIZE / scale,
      );
      if (corner) {
        setDragState({
          kind: 'resize',
          layerId: selectedLayer.id,
          startCx: selectedLayer.cx,
          startCy: selectedLayer.cy,
          startW: selectedLayer.w,
          startH: selectedLayer.h,
          startRotation: selectedLayer.rotation,
        });
        return;
      }

      // 旋转手柄（旋转后的顶部中点，沿法线外移 24px）
      const rotSin = Math.sin(selectedLayer.rotation);
      const rotCos = Math.cos(selectedLayer.rotation);
      const handleX = selectedLayer.cx + (selectedLayer.h / 2) * rotSin - rotSin * 24;
      const handleY = selectedLayer.cy - (selectedLayer.h / 2) * rotCos + rotCos * 24;
      if (Math.abs(p.x - handleX) < 8 / scale && Math.abs(p.y - handleY) < 8 / scale) {
        const startAngle = Math.atan2(p.y - selectedLayer.cy, p.x - selectedLayer.cx);
        setDragState({
          kind: 'rotate',
          layerId: selectedLayer.id,
          startAngle,
          startRotation: selectedLayer.rotation,
          center: { x: selectedLayer.cx, y: selectedLayer.cy },
        });
        return;
      }

      // 内部 → 移动
      if (hitInside(p, selectedLayer.cx, selectedLayer.cy, selectedLayer.w, selectedLayer.h, selectedLayer.rotation)) {
        setDragState({
          kind: 'move',
          layerId: selectedLayer.id,
          offsetX: p.x - selectedLayer.cx,
          offsetY: p.y - selectedLayer.cy,
        });
        return;
      }
    }

    // 2) 点中其他 layer（按 z-order 从顶到底）→ 选中
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (hitInside(p, l.cx, l.cy, l.w, l.h, l.rotation)) {
        setSelectedId(l.id);
        setDragState({
          kind: 'move',
          layerId: l.id,
          offsetX: p.x - l.cx,
          offsetY: p.y - l.cy,
        });
        return;
      }
    }

    // 3) 空白 → 取消选中
    setSelectedId(null);
  };

  // ───────── 鼠标移动（与 ImageCombine 完全一致：每帧 setLayers，状态即所见） ─────────
  React.useEffect(() => {
    if (dragState.kind === 'none' || !vpSize) return;

    const onMove = (e: MouseEvent) => {
      const p = screenToCanvas(e.clientX, e.clientY);
      if (!p) return;
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== dragState.layerId) return l;
          if (dragState.kind === 'move') {
            const c = computeMove(dragState, p, l.w, l.h, l.rotation, vpSize);
            return { ...l, cx: c.cx, cy: c.cy };
          }
          if (dragState.kind === 'resize') {
            const s = computeResize(dragState, p, vpSize);
            return { ...l, w: s.w, h: s.h }; // 中心不变
          }
          if (dragState.kind === 'rotate') {
            const r = computeRotate(dragState, p, l.w, l.h, vpSize);
            return { ...l, rotation: r.rotation, cx: r.cx, cy: r.cy };
          }
          return l;
        }),
      );
    };

    const onUp = () => setDragState({ kind: 'none' });

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, screenToCanvas, vpSize]);

  // ───────── 键盘快捷键 ─────────
  React.useEffect(() => {
    if (!selectedId || !vpSize) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteLayer(selectedId);
        return;
      }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== selectedId) return l;
          let cx = l.cx;
          let cy = l.cy;
          if (e.key === 'ArrowUp') cy -= step;
          if (e.key === 'ArrowDown') cy += step;
          if (e.key === 'ArrowLeft') cx -= step;
          if (e.key === 'ArrowRight') cx += step;
          const fixed = clampInside(cx, cy, l.w, l.h, l.rotation, vpSize);
          return { ...l, cx: fixed.cx, cy: fixed.cy };
        }),
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, vpSize]);

  // ───────── 列表操作 ─────────
  const updateLayer = (id: string, patch: Partial<StampLayer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const moveLayer = (id: string, dir: 'up' | 'down') => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const target = dir === 'up' ? idx + 1 : idx - 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const deleteLayer = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const handleClear = () => {
    layers.forEach((l) => URL.revokeObjectURL(l.url));
    setLayers([]);
    setSelectedId(null);
  };

  const handleExport = async () => {
    if (!pdfFile || layers.length === 0 || !pageSize) {
      setError('请先上传 PDF 并添加至少一张图片');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const page = pdfDoc.getPage(pageNumber - 1);

      for (const l of layers) {
        const bytes = await fetch(l.url).then((r) => r.arrayBuffer());
        const isPng = l.name.toLowerCase().endsWith('.png');
        const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        // 页面像素 → PDF pt（÷ PAGE_RENDER_SCALE），PDF 坐标系为左下原点
        const x = (l.cx - l.w / 2) / PAGE_RENDER_SCALE;
        const y = pageSize.height - (l.cy + l.h / 2) / PAGE_RENDER_SCALE;
        page.drawImage(embedded, {
          x,
          y,
          width: l.w / PAGE_RENDER_SCALE,
          height: l.h / PAGE_RENDER_SCALE,
          opacity: l.opacity,
          rotate: degrees((l.rotation * 180) / Math.PI),
        });
      }

      const out = await pdfDoc.save();
      const buffer = new ArrayBuffer(out.byteLength);
      new Uint8Array(buffer).set(out);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `已贴图-${pdfFile.name.replace(/\.pdf$/i, '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      {/* 画布 + 按钮行 */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        {!pdfFile ? (
          <EmptyPdf onSelect={handlePdfChange} />
        ) : (
          <Box
            ref={surfaceRef}
            onMouseDown={onSurfaceMouseDown}
            sx={{
              position: 'relative',
              width: 'fit-content',
              maxWidth: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              bgcolor: '#fafaf7',
              backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
              userSelect: 'none',
              cursor:
                !selectedLayer
                  ? 'default'
                  : dragState.kind !== 'none'
                    ? 'grabbing'
                    : 'grab',
            }}
          >
            <canvas
              ref={baseCanvasRef}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
            <canvas
              ref={layerCanvasRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
            {!vpSize && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  fontSize: 13,
                }}
              >
                页面加载中…
              </Box>
            )}

            {/* 选中层覆盖层（与 ImageCombine 共用组件） */}
            {selectedLayer && vpSize && (
              <SelectedOverlay
                layer={selectedLayer}
                bounds={vpSize}
                onDelete={() => deleteLayer(selectedLayer.id)}
              />
            )}
          </Box>
        )}

        {/* 按钮行 */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          <Button variant="contained" size="small" component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
            {pdfFile ? '换 PDF' : '上传 PDF'}
            <input type="file" accept="application/pdf" hidden onChange={handlePdfChange} />
          </Button>

          <Tooltip title={pdfFile ? '添加一张新贴图层' : '请先上传 PDF'} placement="top">
            <span>
              <Button
                variant="outlined"
                size="small"
                component="label"
                disabled={!pdfFile}
                startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              >
                叠加图片
                <input type="file" accept="image/*" hidden onChange={handleOverlayFile} />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title={pdfFile ? '手写一个签名，自动落为贴图层' : '请先上传 PDF'} placement="top">
            <span>
              <Button
                variant={signatureMode ? 'contained' : 'outlined'}
                size="small"
                color={signatureMode ? 'primary' : 'inherit'}
                disabled={!pdfFile}
                onClick={() => setSignatureMode((v) => !v)}
                startIcon={<DrawIcon sx={{ fontSize: 16 }} />}
              >
                {signatureMode ? '收起签名' : '手写签名'}
              </Button>
            </span>
          </Tooltip>

          {pdfFile && pageCount > 1 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <Box
                  key={n}
                  onClick={() => {
                    setPageNumber(n);
                    setLayers([]);
                    setSelectedId(null);
                    setVpSize(null);
                  }}
                  sx={{
                    px: 1.25, py: 0.4, fontSize: 12, fontWeight: 500,
                    borderRadius: 0.75, border: 1,
                    borderColor: n === pageNumber ? 'primary.main' : 'divider',
                    bgcolor: n === pageNumber ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                    color: n === pageNumber ? 'primary.main' : 'text.primary',
                    cursor: 'pointer',
                    transition: 'all 160ms ease',
                    '&:hover': { borderColor: n === pageNumber ? 'primary.main' : 'text.secondary' },
                  }}
                >
                  {n}
                </Box>
              ))}
            </Stack>
          )}

          <Tooltip title="清空所有图层" placement="top">
            <span>
              <IconButton
                size="small"
                color="inherit"
                onClick={handleClear}
                disabled={layers.length === 0}
                sx={{ p: 0.5, color: 'text.secondary' }}
              >
                <RestartAltIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {pdfFile && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'var(--font-geist-mono)',
                color: 'text.secondary',
                maxWidth: 280,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pdfFile.name} · {pageCount} 页 · {layers.length} 个图层
            </Typography>
          )}
        </Stack>
      </Box>

      {/* 签名弹窗 */}
      <Dialog
        open={signatureMode && !!pdfFile}
        onClose={() => setSignatureMode(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 1.5 } } }}
      >
        <DialogTitle sx={{ fontSize: 14, fontFamily: 'var(--font-geist-mono)', color: 'text.secondary', py: 1.5 }}>
          手写签名
        </DialogTitle>
        <DialogContent sx={{ pb: 2.5 }}>
          <SignaturePad onDone={handleSignatureDone} />
        </DialogContent>
      </Dialog>

      {/* 右栏 */}
      <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', display: 'block', mb: 1.5 }}>
          图层 · {layers.length}
        </Typography>

        {layers.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 2, fontSize: 13 }}>
            还没有叠加层
          </Typography>
        ) : (
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {layers.map((layer, i) => {
              const selected = layer.id === selectedId;
              return (
                <Box
                  key={layer.id}
                  onClick={() => setSelectedId(layer.id)}
                  sx={{
                    py: 1.25, px: 1, borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'background-color 160ms ease',
                    bgcolor: selected ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                    border: 1,
                    borderColor: selected ? 'primary.main' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}
                >
                  <Box sx={{ width: 20, flexShrink: 0, fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'text.secondary', textAlign: 'right' }}>
                    {String(i + 1).padStart(2, '0')}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {layer.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10 }}>
                      {Math.round(layer.opacity * 100)}% · {Math.round((layer.rotation * 180) / Math.PI)}°
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); }} disabled={i === layers.length - 1} sx={{ p: 0.25 }}>
                      <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); }} disabled={i === 0} sx={{ p: 0.25 }}>
                      <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} sx={{ p: 0.25, color: 'text.secondary' }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* 选中层属性 */}
        {selectedLayer && vpSize && (
          <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', display: 'block', mb: 2 }}>
              选中层
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                不透明度 · {Math.round(selectedLayer.opacity * 100)}%
              </Typography>
              <Slider
                size="small"
                value={selectedLayer.opacity}
                min={0.1}
                max={1}
                step={0.05}
                onChange={(_, v) => updateLayer(selectedLayer.id, { opacity: v as number })}
                sx={{ mt: 0.5 }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                旋转 · {Math.round((selectedLayer.rotation * 180) / Math.PI)}°
              </Typography>
              <Slider
                size="small"
                value={Math.round((selectedLayer.rotation * 180) / Math.PI)}
                min={-180}
                max={180}
                step={1}
                onChange={(_, v) => {
                  const rad = ((v as number) * Math.PI) / 180;
                  const fixed = clampInside(
                    selectedLayer.cx,
                    selectedLayer.cy,
                    selectedLayer.w,
                    selectedLayer.h,
                    rad,
                    vpSize,
                  );
                  setLayers((prev) =>
                    prev.map((l) =>
                      l.id === selectedLayer.id ? { ...l, rotation: rad, cx: fixed.cx, cy: fixed.cy } : l,
                    ),
                  );
                }}
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>
        )}

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={handleExport}
            disabled={!pdfFile || layers.length === 0 || exporting}
            startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          >
            {exporting ? '导出中…' : '导出 PDF'}
          </Button>
        </Stack>

        {exporting && <LinearProgress sx={{ mt: 1.5 }} />}

        {/* 快捷键 */}
        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', display: 'block', mb: 1.5 }}>
            快捷键
          </Typography>
          <Stack spacing={0.75}>
            {[
              { k: '↑↓←→', d: '微调位置' },
              { k: 'Shift + 方向键', d: '大步移动' },
              { k: 'Delete', d: '删除选中层' },
              { k: 'Esc', d: '取消选中' },
            ].map((h) => (
              <Box key={h.k} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <Box sx={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'text.secondary', bgcolor: 'rgba(15, 31, 29, 0.05)', px: 0.75, py: 0.25, borderRadius: 0.5, border: 1, borderColor: 'divider' }}>
                  {h.k}
                </Box>
                <Typography variant="caption" color="text.secondary">{h.d}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function EmptyPdf({ onSelect }: { onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: 360,
        maxHeight: 360,
        borderRadius: 1,
        overflow: 'hidden',
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
      <Box sx={{ fontSize: 36, opacity: 0.5 }}>📄</Box>
      <Typography variant="body2">上传一个 PDF 文件开始</Typography>
      <Button
        variant="contained"
        size="small"
        component="label"
        sx={{ mt: 1 }}
        startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
      >
        选择 PDF
        <input type="file" accept="application/pdf" hidden onChange={onSelect} />
      </Button>
    </Box>
  );
}
