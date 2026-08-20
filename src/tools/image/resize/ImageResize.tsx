'use client';

// 图片调整大小：上传 PNG / JPG / WebP → 选择目标尺寸（百分比 / 按宽 / 按高 / 指定宽高）→ 自动调整。
// 缩放使用 canvas 高质采样（imageSmoothingQuality = 'high'），保持原格式（PNG→PNG、JPG→JPG、WebP→WebP）。
// 尺寸不变时（如 100%）直接复用原文件字节，避免无谓重编码损失质量。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
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
import { useFlowInput, flowImagesToFiles, makeFlowImage, type FlowImage } from '@/lib/flow';

type ImgKind = 'png' | 'jpeg' | 'webp';

// 调整方式：百分比 / 按宽度 / 按高度 / 指定宽高
type Mode = 'percent' | 'width' | 'height' | 'fixed';

type Settings = {
  mode: Mode;
  percent: number; // 百分比 10-200
  width: number; // 按宽：目标宽度 px
  height: number; // 按高：目标高度 px
  fw: number; // 指定宽高：宽度 px
  fh: number; // 指定宽高：高度 px
};

const DEFAULT_SETTINGS: Settings = {
  mode: 'percent',
  percent: 50,
  width: 1200,
  height: 1200,
  fw: 800,
  fh: 600,
};

const MODE_LABEL: Record<Mode, string> = {
  percent: '百分比',
  width: '按宽',
  height: '按高',
  fixed: '宽高',
};

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
  // true = 本轮处理已完成（产出调整结果）
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

// 由目标设置计算输出尺寸：百分比 / 按宽 / 按高保持宽高比，宽高模式拉伸
const targetSize = (sw: number, sh: number, s: Settings): { w: number; h: number } => {
  if (s.mode === 'percent') {
    const k = s.percent / 100;
    return { w: Math.max(1, Math.round(sw * k)), h: Math.max(1, Math.round(sh * k)) };
  }
  if (s.mode === 'width') {
    const k = s.width / sw;
    return { w: s.width, h: Math.max(1, Math.round(sh * k)) };
  }
  if (s.mode === 'height') {
    const k = s.height / sh;
    return { w: Math.max(1, Math.round(sw * k)), h: s.height };
  }
  return { w: s.fw, h: s.fh };
};

// 缩放单张：canvas 高质采样，保持原格式；尺寸不变时直接复用原文件字节
const resizeOne = async (it: Item, s: Settings): Promise<Blob> => {
  const img = await loadImage(it.dataUrl);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const { w, h } = targetSize(sw, sh, s);
  if (w === sw && h === sh) return it.file; // 无实际缩放，避免无谓重编码

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const type = it.kind === 'png' ? 'image/png' : it.kind === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const quality = it.kind === 'png' ? undefined : 0.85;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('编码失败'))), type, quality);
  });
};

const extOf = (name: string, k: ImgKind): string => {
  const lower = name.toLowerCase();
  if (k === 'jpeg') return lower.endsWith('.jpeg') ? 'jpeg' : 'jpg';
  if (k === 'png') return 'png';
  return 'webp';
};

export default function ImageResize({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [settings, setSettingsState] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [working, setWorking] = React.useState(false);
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [, setError] = React.useState<string | null>(null);

  // re-resize 内部读最新 items / settings 的 ref（避免闭包过期与 useEffect 依赖死循环）
  const itemsRef = React.useRef<Item[]>(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const settingsRef = React.useRef<Settings>(settings);
  const applySettings = (patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      return next;
    });
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

  // 文件摄入：SUPPORTED_TYPES 过滤 → 解码 → 构造 Item 推入列表，并触发一次调整
  const appendFiles = async (files: File[]) => {
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
    // 不限数量：处理循环本身逐个顺序执行（天然分批），CPU 不会被打满
    setItems((prev) => {
      const merged = [...prev, ...next];
      // 把最新数组写到 ref，方便 resizeAll 读到
      itemsRef.current = merged;
      // 上传后立即按当前设置触发一次调整
      queueMicrotask(() => resizeAll());
      return merged;
    });
  };

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await appendFiles(Array.from(e.target.files ?? []));
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

  // 防止并发 resize 互相覆盖状态
  const tokenRef = React.useRef(0);

  const resizeAll = async (s?: Settings): Promise<void> => {
    const settingsNow = s ?? settingsRef.current;
    // 通过 ref 读最新 items（不被闭包过期影响）
    const list = itemsRef.current;
    if (list.length === 0) return;
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
          const blob = await resizeOne(src, settingsNow);
          const url = URL.createObjectURL(blob);
          const img = await loadImage(url);
          out[i] = {
            ...out[i],
            outUrl: url,
            outBlob: blob,
            outSize: blob.size,
            outWidth: img.naturalWidth,
            outHeight: img.naturalHeight,
            done: true,
          };
        } catch (e) {
          console.error('[ImageResize] failed', src.name, e);
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
        setProgress(null);
      }
    }
  };

  // 卸载时释放 url
  React.useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl));
    };
  }, []);

  // 切换调整方式后立即按新方式重跑
  const changeMode = (mode: Mode) => {
    applySettings({ mode });
    resizeAll({ ...settingsRef.current, mode });
  };

  // 数值输入：合法则更新并重跑
  const setNum = (key: 'width' | 'height' | 'fw' | 'fh', raw: string) => {
    if (!raw) return;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 1) return;
    applySettings({ [key]: n });
    resizeAll({ ...settingsRef.current, [key]: n });
  };

  const downloadOne = (it: Item) => {
    if (!it.done || !it.outUrl) return;
    const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
    const a = document.createElement('a');
    a.href = it.outUrl;
    a.download = `${base}-${it.outWidth}x${it.outHeight}.${extOf(it.name, it.kind)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 全部打包为一个 ZIP 下载；同名文件自动加序号，避免覆盖
  const downloadAll = async () => {
    const done = items.filter((it): it is Item & { outBlob: Blob } => !!it.outBlob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      const base = it.name.replace(/\.(png|jpe?g|webp)$/i, '');
      let name = `${base}-${it.outWidth}x${it.outHeight}.${extOf(it.name, it.kind)}`;
      let i = 1;
      while (used.has(name)) {
        name = `${base}-${it.outWidth}x${it.outHeight}-${i}.${extOf(it.name, it.kind)}`;
        i++;
      }
      used.add(name);
      zip.file(name, it.outBlob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resized-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 汇总
  const totalOrig = items.reduce((s, it) => s + it.origSize, 0);
  const totalOut = items.reduce((s, it) => s + (it.outSize ?? 0), 0);
  const hasOut = items.some((it) => it.outBlob);

  // 结果态串流出口：把已完成项还原为 FlowImage[]（尺寸为调整后的实际尺寸）
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

  // 拖入上传：接收 ToolWorkbench 外壳转发的文件列表
  const handleDrop = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => SUPPORTED_TYPES[f.type]);
    if (list.length === 0) {
      setError('请拖入 PNG / JPG / WebP 图片');
      return;
    }
    setError(null);
    const next: Item[] = [];
    for (const file of list) {
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
      queueMicrotask(() => resizeAll());
      return merged;
    });
  };

  // 侧栏：调整方式与参数
  const settingsPanel = (
    <Box>
      <SidebarTitle>调整尺寸</SidebarTitle>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={settings.mode}
        onChange={(_, v) => v && changeMode(v as Mode)}
      >
        {Object.keys(MODE_LABEL).map((m) => (
          <ToggleButton key={m} value={m} sx={{ px: 1.25, fontSize: 12 }}>
            {MODE_LABEL[m as Mode]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {settings.mode === 'percent' && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              缩放百分比
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.primary', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}
            >
              {settings.percent}%
            </Typography>
          </Box>
          <Slider
            size="small"
            min={10}
            max={200}
            step={5}
            value={settings.percent}
            onChange={(_, v) => applySettings({ percent: v as number })}
            onChangeCommitted={() => resizeAll()}
            sx={{ mt: 1 }}
          />
        </Box>
      )}

      {settings.mode === 'width' && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            目标宽度（px，高度等比）
          </Typography>
          <TextField
            size="small"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 1, style: { fontFamily: 'var(--font-geist-mono)', fontSize: 13 } } }}
            value={settings.width}
            onChange={(e) => setNum('width', e.target.value)}
          />
        </Box>
      )}

      {settings.mode === 'height' && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            目标高度（px，宽度等比）
          </Typography>
          <TextField
            size="small"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 1, style: { fontFamily: 'var(--font-geist-mono)', fontSize: 13 } } }}
            value={settings.height}
            onChange={(e) => setNum('height', e.target.value)}
          />
        </Box>
      )}

      {settings.mode === 'fixed' && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            目标宽高（px，会拉伸画面）
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 1, style: { fontFamily: 'var(--font-geist-mono)', fontSize: 13 } } }}
              value={settings.fw}
              onChange={(e) => setNum('fw', e.target.value)}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ×
            </Typography>
            <TextField
              size="small"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 1, style: { fontFamily: 'var(--font-geist-mono)', fontSize: 13 } } }}
              value={settings.fh}
              onChange={(e) => setNum('fh', e.target.value)}
            />
          </Stack>
        </Box>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, display: 'block', mt: 1.5 }}>
        百分比 / 按宽 / 按高保持宽高比；「宽高」按指定尺寸拉伸。保持原格式。
      </Typography>
    </Box>
  );

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
          <Typography variant="body2">上传 PNG / JPG / WebP 开始调整大小</Typography>
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 1 }}
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
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, mt: 0.5 }}>
            保持原格式，自动按所选尺寸调整
          </Typography>
        </Box>
      }
      usage={
        <TipCard
          icon={<UploadFileIcon />}
          text="上传 PNG / JPG / WebP 图片，选择目标尺寸后自动调整，保持原格式。"
        />
      }
      config={settingsPanel}
      resource={
        items.length > 0 ? (
          <Box>
            <SidebarTitle>资源信息</SidebarTitle>
            <SidebarResourceInfo
              data={{
                name: `${items.length} 张图片`,
                before: { size: totalOrig },
                after: hasOut ? { size: totalOut } : undefined,
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
                  {progress.currentId ? '正在调整…' : '收尾中…'}
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
                    color: 'text.secondary',
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 11,
                  }}
                >
                  {items.filter((x) => x.outBlob).length} 张已调整 ·{' '}
                  {formatBytes(Math.max(0, totalOrig - totalOut))}
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
                  {it.outWidth && (
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
                </Stack>
              </Box>

              {/* 操作 */}
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignItems: 'center' }}>
                <Tooltip title="下载调整结果">
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
