'use client';

// 图片 ↔ PDF 互转：图片转 PDF（多图合并）+ PDF 转图片（批量导出 PNG/JPG）

import * as React from 'react';
import { pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import JSZip from 'jszip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import LinearProgress from '@mui/material/LinearProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
} from '@/components/tools/ToolWorkbench';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ───────── 通用：读取文件为 ArrayBuffer / dataURL ─────────
const readBuffer = (file: File) => file.arrayBuffer();
const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

// 把任意可解码图重绘到 canvas 并导出为目标格式的 ArrayBuffer
// （webp 等 pdf-lib 不支持的格式先转成 PNG/JPEG）
const reencodeToBytes = async (srcUrl: string, format: 'png' | 'jpeg'): Promise<ArrayBuffer> => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('图片解码失败'));
    i.src = srcUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob 失败'))),
      format === 'png' ? 'image/png' : 'image/jpeg',
      0.92,
    );
  });
  return blob.arrayBuffer();
};

// 页面尺寸（A4 / Letter，单位 mm → pt）
const PAGE_SIZE_MM = {
  a4: { w: 210, h: 297 },
  letter: { w: 216, h: 279 },
  fit: null, // 跟随图片
} as const;
const MM_TO_PT = 2.83465;

// 解析页范围："1-3,5,7" → [1,2,3,5,7]
const parsePageRange = (input: string, max: number): number[] => {
  if (!input.trim()) return Array.from({ length: max }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const seg of input.split(',')) {
    const s = seg.trim();
    if (!s) continue;
    if (s.includes('-')) {
      const [a, b] = s.split('-').map((x) => parseInt(x.trim(), 10));
      if (!isNaN(a) && !isNaN(b)) {
        const lo = Math.max(1, Math.min(a, b));
        const hi = Math.min(max, Math.max(a, b));
        for (let i = lo; i <= hi; i++) out.add(i);
      }
    } else {
      const n = parseInt(s, 10);
      if (!isNaN(n) && n >= 1 && n <= max) out.add(n);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
};

// ───────── 类型 ─────────
type ImgItem = {
  id: string;
  file: File;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
};

type OutputItem = {
  pageIndex: number;
  pageNumber: number;
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

type PageThumb = {
  pageNumber: number;
  url: string;
  width: number;
  height: number;
};

type Dir = 'i2p' | 'p2i';

export default function PdfImageConvert({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  // ── 方向 ──
  const [dir, setDir] = React.useState<Dir>('i2p');

  // ── 图片 → PDF ──
  const [items, setItems] = React.useState<ImgItem[]>([]);
  const [pageSize, setPageSize] = React.useState<'a4' | 'letter' | 'fit'>('fit');
  const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>('portrait');
  const [marginMm, setMarginMm] = React.useState(8);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── PDF → 图片 ──
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [format, setFormat] = React.useState<'png' | 'jpeg'>('png');
  const [scale, setScale] = React.useState(2); // 1=72dpi, 2=144dpi
  const [pageRange, setPageRange] = React.useState(''); // 空 = 全部
  const [outputs, setOutputs] = React.useState<OutputItem[]>([]);
  const [thumbs, setThumbs] = React.useState<PageThumb[]>([]);
  const [progress, setProgress] = React.useState(0);
  const [working, setWorking] = React.useState(false);

  // 卸载时释放 pdf worker 与对象 URL
  React.useEffect(() => {
    return () => {
      doc?.destroy();
      outputs.forEach((o) => URL.revokeObjectURL(o.url));
      thumbs.forEach((t) => URL.revokeObjectURL(t.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 图片 → PDF：增删排序 ──
  const addImages = async (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const next: ImgItem[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readDataUrl(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        dataUrl,
        width: img.width,
        height: img.height,
      });
    }
    setItems((prev) => [...prev, ...next]);
    setError(null);
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addImages(e.target.files);
    e.target.value = '';
  };

  const removeAt = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));
  const move = (id: string, direction: 'up' | 'down') => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx < 0) return prev;
      // up：向上移动（向列表头部，idx 减小）；down：向下（向尾部，idx 增大）
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const clearAll = () => {
    items.forEach((it) => URL.revokeObjectURL(it.dataUrl));
    setItems([]);
  };

  // 当前预览的页面尺寸（mm）与宽高比
  const previewMmW = (): number => {
    if (pageSize === 'fit') {
      // 取第一张图的宽度（多张图时比例各不相同；为简化取第一张）
      return items[0]?.width ?? 210;
    }
    const base = PAGE_SIZE_MM[pageSize];
    return orientation === 'landscape' ? base.h : base.w;
  };
  const previewMmH = (): number => {
    if (pageSize === 'fit') {
      return items[0]?.height ?? 297;
    }
    const base = PAGE_SIZE_MM[pageSize];
    return orientation === 'landscape' ? base.w : base.h;
  };
  // 预览宽高比（w/h），用于 aspectRatio
  const previewRatio = (): number => previewMmW() / previewMmH();

  // ── 图片 → PDF：导出 ──
  const handleExportI2P = async () => {
    if (items.length === 0) {
      setError('请先添加图片');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const out = await PDFDocument.create();
      const margin = marginMm * MM_TO_PT;

      for (const it of items) {
        let bytes: ArrayBuffer = await readBuffer(it.file);
        // sniff 真实格式：PNG 头 89 50 4E 47；JPEG 头 FF D8 FF；RIFF....WEBP 是 webp。
        const head = new Uint8Array(bytes).slice(0, 4);
        const isPng =
          head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
        const isJpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
        const isWebp =
          head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
        if (!isPng && !isJpg && !isWebp) {
          throw new Error(`${it.name} 不是 PNG / JPG / WEBP 格式`);
        }
        // webp / 其它格式：浏览器解码 → 重绘到 canvas → 重新导出为 png/jpeg
        // 这样 pdf-lib 永远收到原生 PNG 或 JPEG 字节
        let kind: 'png' | 'jpeg';
        if (isWebp) {
          kind = 'png';
          bytes = await reencodeToBytes(it.dataUrl, kind);
        } else {
          kind = isPng ? 'png' : 'jpeg';
        }
        const embedded =
          kind === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);

        let pageW: number, pageH: number;
        if (pageSize === 'fit') {
          // 页面尺寸 = 图尺寸 + 边距（按 72dpi 把 px 视作 pt）
          pageW = it.width + margin * 2;
          pageH = it.height + margin * 2;
        } else {
          const base = PAGE_SIZE_MM[pageSize];
          if (orientation === 'landscape') {
            pageW = base.h * MM_TO_PT;
            pageH = base.w * MM_TO_PT;
          } else {
            pageW = base.w * MM_TO_PT;
            pageH = base.h * MM_TO_PT;
          }
        }

        const page = out.addPage([pageW, pageH]);
        // contain：图片按页面减去边距后的可用区域缩放
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        const ratio = Math.min(availW / it.width, availH / it.height);
        const drawW = it.width * ratio;
        const drawH = it.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        page.drawImage(embedded, { x, y, width: drawW, height: drawH });
      }

      const blobBytes = await out.save();
      const buffer = new ArrayBuffer(blobBytes.byteLength);
      new Uint8Array(buffer).set(blobBytes);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `images-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('[ImageToPdf] export failed', e);
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  // ── PDF → 图片：加载 ──
  const loadPdf = async (file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('请选择 PDF 文件');
      return;
    }
    setError(null);
    // 清掉旧导出和旧缩略图
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    thumbs.forEach((t) => URL.revokeObjectURL(t.url));
    setOutputs([]);
    setThumbs([]);
    setPdfFile(file);
    try {
      const data = await file.arrayBuffer();
      const newDoc = await pdfjs.getDocument({ data }).promise;
      doc?.destroy();
      setDoc(newDoc);
      setPageCount(newDoc.numPages);
      // 生成所有页的低分辨率缩略图（用于预览列展示）
      const newThumbs: PageThumb[] = [];
      for (let n = 1; n <= newDoc.numPages; n++) {
        const page = await newDoc.getPage(n);
        // 缩略图固定 ~120px 宽，比例与原页面一致
        const baseVp = page.getViewport({ scale: 1 });
        const thumbScale = 120 / baseVp.width;
        const vp = page.getViewport({ scale: thumbScale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 失败'))), 'image/png');
        });
        newThumbs.push({ pageNumber: n, url: URL.createObjectURL(blob), width: vp.width, height: vp.height });
      }
      setThumbs(newThumbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 加载失败');
    }
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await loadPdf(e.target.files?.[0] ?? null);
    e.target.value = '';
  };

  // ── PDF → 图片：导出 ──
  const handleExportP2I = async () => {
    if (!doc || !pdfFile) return;
    setWorking(true);
    setError(null);
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    setOutputs([]);
    setProgress(0);
    try {
      const pages = parsePageRange(pageRange, pageCount);
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const results: OutputItem[] = [];
      for (let i = 0; i < pages.length; i++) {
        const n = pages[i];
        const page: PDFPageProxy = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;
        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 失败'))), mime, 0.92);
        });
        const url = URL.createObjectURL(blob);
        results.push({ pageIndex: i, pageNumber: n, blob, url, width: viewport.width, height: viewport.height });
        setProgress((i + 1) / pages.length);
      }
      setOutputs(results);
      // 单页直接下载；多页打包 ZIP 自动下载，无需再手动点「全部下载」
      const ext = format === 'png' ? 'png' : 'jpg';
      const baseName = pdfFile.name.replace(/\.pdf$/i, '') || 'pdf';
      if (results.length === 1) {
        const a = document.createElement('a');
        a.href = results[0].url;
        a.download = `${baseName}-page${results[0].pageNumber}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const zip = new JSZip();
        for (const r of results) {
          zip.file(`${baseName}-page${r.pageNumber}.${ext}`, r.blob);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setWorking(false);
    }
  };

  const downloadOne = (it: OutputItem) => {
    const a = document.createElement('a');
    a.href = it.url;
    const ext = format === 'png' ? 'png' : 'jpg';
    a.download = `${pdfFile?.name.replace(/\.pdf$/i, '') ?? 'pdf'}-page${it.pageNumber}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleClear = () => {
    doc?.destroy();
    setDoc(null);
    setPdfFile(null);
    setPageCount(0);
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    setOutputs([]);
    thumbs.forEach((t) => URL.revokeObjectURL(t.url));
    setThumbs([]);
    setPageRange('');
  };

  // 拖拽上传：按方向分发
  const handleDrop = (files: FileList | null) => {
    if (dir === 'i2p') void addImages(files);
    else void loadPdf(files?.[0] ?? null);
  };

  const hasContent = dir === 'i2p' ? items.length > 0 : !!pdfFile;
  const totalSize = items.reduce((s, it) => s + it.file.size, 0);
  const pageLabel =
    pageSize === 'fit'
      ? '跟随图片'
      : `${PAGE_SIZE_MM[pageSize].w} × ${PAGE_SIZE_MM[pageSize].h} mm · ${orientation === 'landscape' ? '横向' : '纵向'}`;

  const resource =
    dir === 'i2p' ? (
      <SidebarResourceInfo
        data={{
          name: items.length ? `${items.length} 张图片` : undefined,
          before: items.length ? { size: totalSize } : undefined,
          extra: items.length
            ? [
                { label: '页面', value: pageLabel },
                { label: '边距', value: `${marginMm} mm` },
              ]
            : undefined,
        }}
      />
    ) : (
      <SidebarResourceInfo
        data={{
          name: pdfFile?.name,
          before: pdfFile ? { size: pdfFile.size } : undefined,
          extra: [
            ...(pageCount ? [{ label: '页数', value: `${pageCount}` }] : []),
            ...(outputs.length ? [{ label: '已导出', value: `${outputs.length} 张` }] : []),
          ],
        }}
      />
    );

  return (
    <ToolWorkbench
      title={title}
      description={description}
      hasContent={hasContent}
      onDrop={handleDrop}
      usage={
        <TipCard
          icon={<SwapHorizIcon />}
          text="图片转 PDF 支持多图合并（顺序即页序）；PDF 转图片可批量导出 PNG / JPG。"
        />
      }
      config={
        <>
          <SidebarTitle>转换方向</SidebarTitle>
          <ToggleButtonGroup
            value={dir}
            exclusive
            size="small"
            fullWidth
            onChange={(_, v) => {
              if (v) {
                setDir(v as Dir);
                setError(null);
              }
            }}
          >
            <ToggleButton value="i2p">图片 → PDF</ToggleButton>
            <ToggleButton value="p2i">PDF → 图片</ToggleButton>
          </ToggleButtonGroup>

          {dir === 'i2p' ? (
            <Box sx={{ mt: 3 }}>
              <SidebarTitle>页面</SidebarTitle>
              <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                <TextField
                  select
                  size="small"
                  label="页面尺寸"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as 'a4' | 'letter' | 'fit')}
                >
                  <MenuItem value="fit">跟随图片</MenuItem>
                  <MenuItem value="a4">A4</MenuItem>
                  <MenuItem value="letter">Letter</MenuItem>
                </TextField>

                {pageSize !== 'fit' && (
                  <TextField
                    select
                    size="small"
                    label="方向"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                  >
                    <MenuItem value="portrait">纵向</MenuItem>
                    <MenuItem value="landscape">横向</MenuItem>
                  </TextField>
                )}

                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    页边距 · {marginMm} mm
                  </Typography>
                  <Slider
                    size="small"
                    value={marginMm}
                    min={0}
                    max={40}
                    step={1}
                    onChange={(_, v) => setMarginMm(v as number)}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </Stack>

              <Button
                variant="contained"
                size="small"
                fullWidth
                onClick={handleExportI2P}
                disabled={items.length === 0 || exporting}
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              >
                {exporting ? '导出中…' : '导出 PDF'}
              </Button>
              {exporting && <LinearProgress sx={{ mt: 1.5 }} />}
              {error && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'error.main' }}>
                  {error}
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ mt: 3 }}>
              <SidebarTitle>导出设置</SidebarTitle>
              <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    格式
                  </Typography>
                  <ToggleButtonGroup
                    value={format}
                    exclusive
                    size="small"
                    fullWidth
                    onChange={(_, v) => v && setFormat(v as 'png' | 'jpeg')}
                  >
                    <ToggleButton value="png">PNG</ToggleButton>
                    <ToggleButton value="jpeg">JPG</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    分辨率 · {scale * 72} dpi
                  </Typography>
                  <Slider
                    size="small"
                    value={scale}
                    min={1}
                    max={4}
                    step={0.5}
                    marks={[{ value: 1, label: '72' }, { value: 2, label: '144' }, { value: 3, label: '216' }, { value: 4, label: '288' }]}
                    onChange={(_, v) => setScale(v as number)}
                    sx={{ mt: 0.5 }}
                  />
                </Box>

                <TextField
                  size="small"
                  label="页范围"
                  placeholder="留空 = 全部，如 1-3,5,7"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                />
              </Stack>

              <Button
                variant="contained"
                size="small"
                fullWidth
                onClick={handleExportP2I}
                disabled={!doc || working}
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              >
                {working ? '导出中…' : '导出图片（自动下载）'}
              </Button>
            </Box>
          )}
        </>
      }
      resource={resource}
      emptyState={
        dir === 'i2p' ? (
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
            <Box sx={{ fontSize: 36, opacity: 0.5 }}>🖼️</Box>
            <Typography variant="body2">上传一张或多张图片开始</Typography>
            <Button
              variant="contained"
              size="small"
              component="label"
              startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              sx={{ mt: 1 }}
            >
              选择图片
              <input type="file" accept="image/*" multiple hidden onChange={handleAddFiles} />
            </Button>
          </Box>
        ) : (
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
              <input type="file" accept="application/pdf" hidden onChange={handlePdf} />
            </Button>
          </Box>
        )
      }
    >
      {dir === 'i2p' ? (
        <Box>
          {/* 预览列：与 PDF → 图片 一致的网格缩略图布局，避免整页大图撑满 */}
          <Box
            sx={{
              maxHeight: '70vh',
              overflowY: 'auto',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: '#fafaf7',
              backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
              p: 2,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 1.5,
              }}
            >
              {items.map((it, i) => (
                <Box
                  key={it.id}
                  sx={{
                    position: 'relative',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: '#ffffff',
                    aspectRatio: `${previewRatio()} / 1`,
                  }}
                >
                  {/* 图片：contain 在 (页面 - 边距) 区域 */}
                  <Box
                    sx={{
                      width: `calc(100% - ${(marginMm / Math.max(previewMmW(), previewMmH())) * 100}%)`,
                      height: `calc(100% - ${(marginMm / Math.max(previewMmW(), previewMmH())) * 100}%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={it.dataUrl}
                      alt={it.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain' }}
                    />
                  </Box>

                  {/* 页码 */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      px: 0.75,
                      py: 0.25,
                      fontSize: 10,
                      fontFamily: 'var(--font-geist-mono)',
                      bgcolor: 'rgba(255,255,255,0.85)',
                      borderRadius: 0.5,
                    }}
                  >
                    第 {i + 1} 页
                  </Box>

                  {/* 操作按钮（右下角） */}
                  <Stack
                    direction="row"
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      bgcolor: 'rgba(255,255,255,0.95)',
                      borderRadius: 0.75,
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Tooltip title="上移（页面顺序向前）" placement="bottom">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => move(it.id, 'up')}
                          disabled={i === 0}
                          sx={{ p: 0.25 }}
                        >
                          <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="下移（页面顺序向后）" placement="bottom">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => move(it.id, 'down')}
                          disabled={i === items.length - 1}
                          sx={{ p: 0.25 }}
                        >
                          <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="移除此页" placement="bottom">
                      <IconButton
                        size="small"
                        onClick={() => removeAt(it.id)}
                        sx={{ p: 0.25, color: 'text.secondary' }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" size="small" component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
              继续添加
              <input type="file" accept="image/*" multiple hidden onChange={handleAddFiles} />
            </Button>
            <Tooltip title="清空全部">
              <IconButton size="small" color="inherit" onClick={clearAll} disabled={items.length === 0} sx={{ color: 'text.secondary' }}>
                <DeleteSweepIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)' }}>
              {items.length} 张 · 顺序即页序
            </Typography>
          </Stack>
        </Box>
      ) : (
        <Box>
          {/* 预览列：最大高度 70vh，内部按需滚动 */}
          <Box
            sx={{
              maxHeight: '70vh',
              overflowY: 'auto',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: '#fafaf7',
              backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
              p: 2,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
            }}
          >
            {outputs.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1.5,
                }}
              >
                {outputs.map((o) => (
                  <Box
                    key={o.pageIndex}
                    sx={{
                      position: 'relative',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: '#ffffff',
                      aspectRatio: `${o.width} / ${o.height}`,
                      cursor: 'pointer',
                      transition: 'border-color 160ms ease',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                    onClick={() => downloadOne(o)}
                  >
                    <img
                      src={o.url}
                      alt={`page ${o.pageNumber}`}
                      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        px: 0.75, py: 0.25,
                        fontSize: 10,
                        fontFamily: 'var(--font-geist-mono)',
                        bgcolor: 'rgba(255,255,255,0.85)',
                        borderRadius: 0.5,
                      }}
                    >
                      p{o.pageNumber}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : thumbs.length > 0 ? (
              // 上传后还没导出：显示所有页的 PDF 缩略图预览（用户原本看不到 PDF 的修复点）
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1.5,
                }}
              >
                {thumbs.map((t) => (
                  <Box
                    key={t.pageNumber}
                    sx={{
                      position: 'relative',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: '#ffffff',
                      aspectRatio: `${t.width} / ${t.height}`,
                    }}
                  >
                    <img
                      src={t.url}
                      alt={`page ${t.pageNumber}`}
                      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        px: 0.75, py: 0.25,
                        fontSize: 10,
                        fontFamily: 'var(--font-geist-mono)',
                        bgcolor: 'rgba(255,255,255,0.85)',
                        borderRadius: 0.5,
                      }}
                    >
                      p{t.pageNumber}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box
                sx={{
                  minHeight: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  fontSize: 13,
                }}
              >
                PDF 加载中…
              </Box>
            )}
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" size="small" component="label" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}>
              换 PDF
              <input type="file" accept="application/pdf" hidden onChange={handlePdf} />
            </Button>
            <Tooltip title="清空">
              <IconButton size="small" color="inherit" onClick={handleClear} sx={{ color: 'text.secondary' }}>
                <RestartAltIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)' }}>
              {pdfFile?.name} · {pageCount} 页
              {outputs.length > 0 && ` · 已导出 ${outputs.length} 张`}
            </Typography>
          </Stack>

          {working && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={progress * 100} />
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                {Math.round(progress * 100)}%
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </ToolWorkbench>
  );
}
