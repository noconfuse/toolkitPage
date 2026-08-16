'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Slider from '@mui/material/Slider';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UndoIcon from '@mui/icons-material/Undo';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BrushIcon from '@mui/icons-material/Brush';
// 用 Blob Worker 绕过 Next.js webpack 对 `new Worker(new URL(...))` 的运行时注入
// （在 classic worker 上下文注入 `_N_E` 等不存在的全局导致 ReferenceError）。
import { loadModelBytes } from '@/lib/onnx-runtime/model-cache';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import FlowPill from '@/components/tools/FlowPill';
import {
  useFlowInput,
  makeFlowImage,
  blobToFlowImage,
  flowImagesToFiles,
  type FlowImage,
} from '@/lib/flow';

type WorkerOutMsg =
  | { type: 'ready' }
  | { type: 'inpaint:done'; id: number; out: ArrayBuffer }
  | { type: 'error'; error: string };

export default function RemoveWatermark({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const canvasWrapRef = React.useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const compareCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  // worker 内模型 session 是否已就绪：就绪后再次执行无需重新加载/下载模型
  const workerReadyRef = React.useRef(false);
  // init 阶段的 reject，用于把 Worker onerror（动态 import ORT 失败等）桥接到 init promise
  const initRejectRef = React.useRef<((e: Error) => void) | null>(null);
  const pendingInpaintRef = React.useRef<{
    resolve: (out: Uint8Array) => void;
    reject: (e: Error) => void;
  } | null>(null);
  const inpaintIdRef = React.useRef(0);

  const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(null);
  // 原图 objectURL：仅用于撑开预览容器（隐形 img 等比撑开，canvas 覆盖其上，保证三画布与图片同比例、不错位）
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [hasMask, setHasMask] = React.useState(false);
  const [isProcessed, setIsProcessed] = React.useState(false);
  const [brushSize, setBrushSize] = React.useState(40);
  // 前后对比分割线位置（0-100，仅处理后生效）
  const [splitRatio, setSplitRatio] = React.useState(50);

  // 工作流串流出参：下载时把 canvas 结果写入 blob（同时记录宽高），供「继续处理」胶囊使用
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [resultSize, setResultSize] = React.useState<{ w: number; h: number } | null>(null);
  // 资源信息：源文件名与大小（结果大小直接取 resultBlob）
  const [sourceName, setSourceName] = React.useState('image');
  const [sourceSize, setSourceSize] = React.useState(0);

  // AI 处理状态
  const [running, setRunning] = React.useState(false);
  const [phase, setPhase] = React.useState<'idle' | 'downloading' | 'loading' | 'repairing'>(
    'idle',
  );
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const busy = running || phase !== 'idle';

  // 最原始底图（加载后不变，用于前后对比）
  const originalDataRef = React.useRef<ImageData | null>(null);
  // 当前画布底图（原始或最近一次修复结果）
  const currentDataRef = React.useRef<ImageData | null>(null);
  // 修复历史栈：每次「AI 修复」前保存 { 底图, 涂抹 } 快照，用于撤销
  const historyRef = React.useRef<Array<{ image: ImageData; mask: ImageData }>>([]);

  const [pendingImg, setPendingImg] = React.useState<{
    img: HTMLImageElement;
    cw: number;
    ch: number;
  } | null>(null);

  // 画笔涂抹状态
  const isPaintingRef = React.useRef(false);
  const lastPaintRef = React.useRef<{ x: number; y: number } | null>(null);
  // 分割线拖动状态
  const splitDraggingRef = React.useRef(false);
  // 模型加载阶段平滑进度定时器
  const loadingTimerRef = React.useRef<number | null>(null);
  // 涂抹历史栈（整层快照），撤销一笔时 pop 一帧
  const maskHistoryRef = React.useRef<ImageData[]>([]);

  // ───────── 绘制底图到 baseCanvas（canvas 渲染后执行） ─────────
  React.useEffect(() => {
    if (!pendingImg) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(pendingImg.img, 0, 0, pendingImg.cw, pendingImg.ch);
    const data = ctx.getImageData(0, 0, pendingImg.cw, pendingImg.ch);
    originalDataRef.current = data;
    currentDataRef.current = data;
    historyRef.current = [];
    setIsProcessed(false);
    setSplitRatio(50);
    setError(null);
    clearMask();
    setPendingImg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImg]);

  // ───────── 读取文件 ─────────
  const loadFile = (file: File) => {
    setSourceName(file.name);
    setSourceSize(file.size);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const MAX = 4096;
      const scale = Math.min(1, MAX / w, MAX / h);
      setSourceUrl(url);
      setPendingImg({ img, cw: Math.round(w * scale), ch: Math.round(h * scale) });
      setImgSize({ w: Math.round(w * scale), h: Math.round(h * scale) });
    };
    img.src = url;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadFile(file);
    e.target.value = '';
  };

  // ───────── 工作流串流摄入（单图工具：只取第一张） ─────────
  const flowInput = useFlowInput();
  const flowConsumed = React.useRef(false);
  React.useEffect(() => {
    if (flowConsumed.current || !flowInput?.images.length) return;
    flowConsumed.current = true;
    // 用 flowImagesToFiles 还原为 File，复用既有文件摄入逻辑
    loadFile(flowImagesToFiles(flowInput.images)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowInput]);

  // ───────── 遮罩层操作 ─────────
  const clearMask = () => {
    const mc = maskCanvasRef.current;
    if (!mc) return;
    const ctx = mc.getContext('2d')!;
    ctx.clearRect(0, 0, mc.width, mc.height);
    maskHistoryRef.current = [];
    setHasMask(false);
  };

  const checkHasMask = (data: ImageData): boolean => {
    const a = data.data;
    for (let i = 3; i < a.length; i += 4) if (a[i] > 0) return true;
    return false;
  };

  // 撤销：优先撤销最近一次处理；无处理历史时撤销上一笔涂抹
  const handleUndo = () => {
    const bc = baseCanvasRef.current;
    const mc = maskCanvasRef.current;
    if (!bc || !mc) return;
    const bctx = bc.getContext('2d')!;
    const mctx = mc.getContext('2d')!;
    if (historyRef.current.length > 0) {
      // 撤销最近一次处理：恢复处理前的底图与涂抹
      const snap = historyRef.current.pop()!;
      bctx.putImageData(snap.image, 0, 0);
      currentDataRef.current = snap.image;
      mctx.clearRect(0, 0, mc.width, mc.height);
      mctx.putImageData(snap.mask, 0, 0);
      maskHistoryRef.current = [snap.mask];
      setHasMask(checkHasMask(snap.mask));
      setIsProcessed(historyRef.current.length > 0);
    } else {
      // 撤销一笔涂抹
      const hist = maskHistoryRef.current;
      if (hist.length === 0) return;
      const last = hist.pop()!;
      mctx.clearRect(0, 0, mc.width, mc.height);
      mctx.putImageData(last, 0, 0);
      setHasMask(checkHasMask(last));
    }
  };

  const getMaskPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const mc = maskCanvasRef.current;
    if (!mc) return null;
    const rect = mc.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * mc.width,
      y: ((clientY - rect.top) / rect.height) * mc.height,
    };
  };

  // 涂抹一笔：在两点之间画连续实心圆，半透明红色填充
  const paintStroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const mc = maskCanvasRef.current;
    if (!mc) return;
    const ctx = mc.getContext('2d')!;
    ctx.fillStyle = 'rgba(220,50,50,0.7)';
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(2, brushSize * 0.25);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 叠加一层不透明笔触中心，保证 mask 覆盖完整
    ctx.fillStyle = 'rgba(220,50,50,1)';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy) return;
    e.preventDefault();
    const p = getMaskPoint(e.clientX, e.clientY);
    if (!p) return;
    // 进入涂抹前压一帧历史（连续涂抹合并为一帧：只在第一次入栈）
    if (maskHistoryRef.current.length === 0 || !isPaintingRef.current) {
      const mc = maskCanvasRef.current;
      if (mc) maskHistoryRef.current.push(mc.getContext('2d')!.getImageData(0, 0, mc.width, mc.height));
    }
    isPaintingRef.current = true;
    lastPaintRef.current = p;
    paintStroke(p, p);
    setHasMask(true);
  };

  // 分割线拖动
  const onSplitPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    splitDraggingRef.current = true;
  };

  React.useEffect(() => {
    if (!imgSize) return;
    const onMove = (e: PointerEvent) => {
      // 拖动分割线 → 更新对比位置
      if (splitDraggingRef.current) {
        const wrap = canvasWrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const ratio = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitRatio(Math.min(100, Math.max(0, ratio)));
        return;
      }
      if (!isPaintingRef.current) return;
      const p = getMaskPoint(e.clientX, e.clientY);
      if (!p || !lastPaintRef.current) return;
      paintStroke(lastPaintRef.current, p);
      lastPaintRef.current = p;
    };
    const onUp = () => {
      isPaintingRef.current = false;
      lastPaintRef.current = null;
      splitDraggingRef.current = false;
      // 限制历史栈长度，避免无限增长
      if (maskHistoryRef.current.length > 30) maskHistoryRef.current.shift();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgSize, brushSize]);

  // 处理后：填充对比层（最原始底图），左侧露出即对比原图
  React.useEffect(() => {
    if (!isProcessed) return;
    const cc = compareCanvasRef.current;
    if (!cc) return;
    const ctx = cc.getContext('2d')!;
    if (originalDataRef.current) ctx.putImageData(originalDataRef.current, 0, 0);
  }, [isProcessed]);

  // ───────── Worker 通信 ─────────
  // worker 是 public/workers 下的独立静态文件（手写纯 JS，不经过 webpack 编译），
  // 以 module worker 方式加载，动态 import() ORT bundle 与 import.meta 均可用。
  const WORKER_URL = '/workers/inpaint.worker.js';
  const ensureWorker = (): Worker => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(WORKER_URL, { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        workerReadyRef.current = true;
        setPhase('repairing');
        setProgress(1);
      } else if (msg.type === 'inpaint:done') {
        const pending = pendingInpaintRef.current;
        pendingInpaintRef.current = null;
        if (pending) pending.resolve(new Uint8Array(msg.out));
      } else if (msg.type === 'error') {
        const pending = pendingInpaintRef.current;
        pendingInpaintRef.current = null;
        if (pending) pending.reject(new Error(msg.error));
      }
    };
    w.onerror = (e) => {
      e.preventDefault();
      const initReject = initRejectRef.current;
      const pending = pendingInpaintRef.current;
      if (!initReject && !pending) return;
      const wrapped = new Error(
        e.error instanceof Error
          ? `${e.error.message}\n${e.error.stack ?? ''}`
          : e.message || e.filename || 'Worker onerror (no detail)',
      );
      initRejectRef.current = null;
      pendingInpaintRef.current = null;
      initReject?.(wrapped);
      pending?.reject(wrapped);
      try {
        w.terminate();
      } catch {
        /* ignore */
      }
      if (workerRef.current === w) {
        workerRef.current = null;
        workerReadyRef.current = false;
      }
    };
    workerRef.current = w;
    return w;
  };

  const runInpaint = async (
    image: Uint8Array,
    mask: Uint8Array,
    w: number,
    h: number,
  ): Promise<Uint8Array> => {
    const w0 = ensureWorker();
    return new Promise<Uint8Array>((resolve, reject) => {
      const id = ++inpaintIdRef.current;
      pendingInpaintRef.current = { resolve, reject };
      w0.postMessage(
        { type: 'inpaint', id, w, h, image, mask },
        // image/mask 用 transferable 零拷贝
        [image.buffer, mask.buffer],
      );
    });
  };

  // 卸载组件时清理 Worker
  React.useEffect(() => {
    return () => {
      const w = workerRef.current;
      workerRef.current = null;
      workerReadyRef.current = false;
      if (w) {
        w.postMessage({ type: 'dispose' });
        w.terminate();
      }
    };
  }, []);

  // 卸载时回收原图 objectURL。依赖 sourceUrl（state）而非 ref：
  // StrictMode 双挂载时，首次 mount 的 cleanup 阶段若按 ref 回收，会把工作流摄入
  // 刚同步创建的 blob URL 提前 revoke，导致图片解码中断、onload 不触发（图片带不过来）。
  // state 在首次 cleanup 时仍为 null，是空操作；真正加载完成后才按当前 URL 注册回收。
  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  // ───────── AI 修复（基于当前底图继续处理） ─────────
  const handleProcess = async () => {
    const bc = baseCanvasRef.current;
    const mc = maskCanvasRef.current;
    if (!bc || !mc || !imgSize) return;
    const w = imgSize.w;
    const h = imgSize.h;

    setRunning(true);
    setError(null);
    try {
      // 0. Worker 准备 + 模型加载。首次执行才走「下载/加载模型」流程
      //（模型有 IndexedDB 缓存，缓存命中不产生网络请求；worker 内 session 常驻），
      // 之后直接复用已就绪的 worker，不再重复加载。
      ensureWorker();
      const w0 = workerRef.current!;
      if (!workerReadyRef.current) {
        await new Promise<void>((resolve, reject) => {
          const handler = (e: MessageEvent<WorkerOutMsg>) => {
            const msg = e.data;
            if (msg.type === 'ready') {
              w0.removeEventListener('message', handler);
              initRejectRef.current = null;
              if (loadingTimerRef.current) window.clearInterval(loadingTimerRef.current);
              loadingTimerRef.current = null;
              setProgress(1);
              resolve();
            } else if (msg.type === 'error') {
              w0.removeEventListener('message', handler);
              initRejectRef.current = null;
              if (loadingTimerRef.current) window.clearInterval(loadingTimerRef.current);
              loadingTimerRef.current = null;
              reject(new Error(msg.error));
            }
          };
          w0.addEventListener('message', handler);
          // 桥接 Worker onerror（动态 import ORT 失败等）到 init promise
          initRejectRef.current = reject;
          // 阶段一：下载模型（真实字节进度；IndexedDB 命中时立即回调 1）
          setPhase('downloading');
          setProgress(0);
          loadModelBytes((p) => setProgress(p))
            .then((buf) => {
              // 阶段二：加载模型（创建推理会话，无进度回调，用平滑估算进度）
              setPhase('loading');
              setProgress(0);
              loadingTimerRef.current = window.setInterval(() => {
                setProgress((p) => (p < 0.95 ? p + (0.95 - p) * 0.12 : p));
              }, 150);
              w0.postMessage({ type: 'init', modelBytes: buf }, [buf]);
            })
            .catch((err) => {
              // 模型加载失败：清理 init 监听 + 重置状态
              w0.removeEventListener('message', handler);
              initRejectRef.current = null;
              if (loadingTimerRef.current) window.clearInterval(loadingTimerRef.current);
              loadingTimerRef.current = null;
              reject(err instanceof Error ? err : new Error(String(err)));
            });
        });
      }

      setPhase('repairing');
      await new Promise((r) => setTimeout(r, 20)); // 让 UI 先渲染

      // 1. 读取当前底图与涂抹 mask（全图喂给模型）
      const bctx = bc.getContext('2d')!;
      const mctx = mc.getContext('2d')!;
      const imgData = bctx.getImageData(0, 0, w, h);
      const maskData = mctx.getImageData(0, 0, w, h);
      if (!checkHasMask(maskData)) {
        setError('请先用画笔在水印区域涂抹，再点「AI 修复」');
        setRunning(false);
        setPhase('idle');
        setProgress(0);
        return;
      }
      const imgArr = new Uint8Array(imgData.data);
      const maskArr = new Uint8Array(maskData.data);

      // 2. Worker 推理
      const outArr = await runInpaint(imgArr, maskArr, w, h);

      // 3. 推理成功后才入历史（撤销时恢复到这一步之前的状态）
      historyRef.current.push({ image: imgData, mask: maskData });

      // 4. 输出写回画布
      bctx.putImageData(new ImageData(new Uint8ClampedArray(outArr), w, h), 0, 0);
      currentDataRef.current = bctx.getImageData(0, 0, w, h);
      setIsProcessed(true);

      // 清空涂抹，等待继续修复
      mctx.clearRect(0, 0, w, h);
      maskHistoryRef.current = [];
      setHasMask(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试');
    } finally {
      if (loadingTimerRef.current) window.clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
      setRunning(false);
      setPhase('idle');
      setProgress(0);
    }
  };

  // ───────── 下载（当前画布内容 = 最新处理结果） ─────────
  const handleDownload = () => {
    const bc = baseCanvasRef.current;
    if (!bc) return;
    const link = document.createElement('a');
    link.href = bc.toDataURL('image/png', 1);
    link.download = `去水印-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // 同步写入工作流串流出参：结果 blob + canvas 宽高
    const w = bc.width;
    const h = bc.height;
    bc.toBlob((b) => {
      if (!b) return;
      setResultBlob(b);
      setResultSize({ w, h });
    }, 'image/png');
  };

  // ───────── 工作流串流出参（「继续处理」胶囊） ─────────
  // 正常下载已记录宽高，走 makeFlowImage 同步构造；宽高不易取得时退回 blobToFlowImage 异步解码
  const [fallbackFlowImages, setFallbackFlowImages] = React.useState<FlowImage[]>([]);
  React.useEffect(() => {
    if (!resultBlob || resultSize) return;
    let alive = true;
    blobToFlowImage(resultBlob, `去水印-${Date.now()}.png`)
      .then((im) => alive && setFallbackFlowImages([im]))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [resultBlob, resultSize]);

  const flowImages: FlowImage[] = React.useMemo(() => {
    if (resultBlob && resultSize) {
      return [makeFlowImage(resultBlob, `去水印-${Date.now()}.png`, resultSize.w, resultSize.h)];
    }
    return fallbackFlowImages;
  }, [resultBlob, resultSize, fallbackFlowImages]);

  const showProgress = phase !== 'idle';
  const statusText =
    phase === 'downloading'
      ? `正在下载 ${Math.round(progress * 100)}%`
      : phase === 'loading'
        ? `正在加载 ${Math.round(progress * 100)}%`
        : phase === 'repairing'
          ? '正在修复…'
          : null;

  return (
    <ToolWorkbench
      title={title}
      description={description}
      hasContent={!!imgSize}
      onPickFile={() => fileInputRef.current?.click()}
      onDrop={(files) => {
        const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'));
        if (file) loadFile(file);
      }}
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
          <Typography variant="body2">上传图片，涂抹水印区域，点击「AI 修复」重建</Typography>
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            选择图片
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
          </Button>
        </Box>
      }
      usage={
        <TipCard
          icon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
          text="用画笔涂抹水印区域（红色覆盖），可拖动滑块调节笔粗，点击「AI 修复」重建。处理后可拖动分割线对比前后效果，也能继续涂抹补充修复或撤销回退。"
        />
      }
      config={
        imgSize ? (
          <Box>
            <SidebarTitle>画笔设置</SidebarTitle>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <BrushIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
              <Slider
                size="small"
                min={5}
                max={150}
                value={brushSize}
                onChange={(_, v) => setBrushSize(v as number)}
                disabled={busy}
                sx={{ flex: 1 }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontFamily: 'var(--font-geist-mono)',
                  flexShrink: 0,
                  width: 44,
                  textAlign: 'right',
                }}
              >
                {brushSize}px
              </Typography>
            </Stack>
          </Box>
        ) : undefined
      }
      resource={
        imgSize ? (
          <Box>
            <SidebarTitle>资源信息</SidebarTitle>
            <SidebarResourceInfo
              data={{
                name: sourceName,
                before: { size: sourceSize, width: imgSize.w, height: imgSize.h },
                after: resultBlob
                  ? { size: resultBlob.size, width: resultSize?.w, height: resultSize?.h }
                  : undefined,
              }}
            />
          </Box>
        ) : undefined
      }
      flow={flowImages.length > 0 ? <FlowPill images={flowImages} /> : undefined}
    >
      {!imgSize ? null : (
        <>
          {/* ───────── 左：画布预览 + 底部工具栏 ───────── */}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Box
              sx={{
                width: '100%',
                // 预览容器：图片等比居中，不固定宽度
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {/* 内容区：fit-content = 图片等比显示尺寸，三画布绝对覆盖其上（与图片完全同区域，不错位不变形）。
                  canvasWrapRef 挂在此处：分割线拖动比例基于图片区域计算，不会受外层留白影响 */}
              <Box
                ref={canvasWrapRef}
                sx={{
                  position: 'relative',
                  width: 'fit-content',
                  maxWidth: '100%',
                  maxHeight: 480,
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                {/* 隐形原图撑开容器，保证画布比例 = 图片比例 */}
                <img
                  src={sourceUrl ?? undefined}
                  alt=""
                  draggable={false}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: 480,
                    width: 'auto',
                    height: 'auto',
                    visibility: 'hidden',
                  }}
                />
                {/* 底层：当前底图（处理后为最新结果） */}
                <canvas
                  ref={baseCanvasRef}
                  width={imgSize.w}
                  height={imgSize.h}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                />
                {/* 对比层：最原始底图，仅处理后可拖动分割线露出左侧 */}
                {isProcessed && (
                  <canvas
                    ref={compareCanvasRef}
                    width={imgSize.w}
                    height={imgSize.h}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      clipPath: `inset(0 ${100 - splitRatio}% 0 0)`,
                    }}
                  />
                )}
                {/* 涂抹层（最上） */}
                <canvas
                  ref={maskCanvasRef}
                  width={imgSize.w}
                  height={imgSize.h}
                  onPointerDown={onPointerDown}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    cursor: busy ? 'default' : 'crosshair',
                    touchAction: 'none',
                  }}
                />
                {/* 前后对比分割线：放在内容区内，与 canvas 同区域，比例与高度都一致 */}
                {isProcessed && (
                  <Box
                    onPointerDown={onSplitPointerDown}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${splitRatio}%`,
                      zIndex: 3,
                      transform: 'translateX(-50%)',
                      width: 16,
                      cursor: 'ew-resize',
                      touchAction: 'none',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 2,
                        bgcolor: 'common.white',
                        boxShadow: '0 0 3px rgba(0,0,0,0.6)',
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'common.white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                        border: '1px solid rgba(0,0,0,0.12)',
                      },
                    }}
                  />
                )}
              </Box>
            </Box>

            {showProgress && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                  {statusText ?? `${Math.round(progress * 100)}%`}
                </Typography>
                <LinearProgress
                  variant={phase === 'repairing' ? 'indeterminate' : 'determinate'}
                  value={Math.round(progress * 100)}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* 底部工具栏：功能按钮单行展示（配置项统一放右栏） */}
            <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center', flexWrap: 'nowrap' }}>
              <Button
                variant="outlined"
                size="small"
                component="label"
                disabled={busy}
                startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              >
                更换图片
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
              </Button>

              <Tooltip title="撤销上一步">
                <span>
                  <IconButton
                    size="small"
                    color="inherit"
                    onClick={handleUndo}
                    disabled={busy || (historyRef.current.length === 0 && maskHistoryRef.current.length === 0)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <UndoIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="清除所有涂抹">
                <span>
                  <IconButton
                    size="small"
                    color="inherit"
                    onClick={clearMask}
                    disabled={!hasMask || busy}
                    sx={{ color: 'text.secondary' }}
                  >
                    <RestartAltIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>

              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                size="small"
                onClick={handleProcess}
                disabled={busy || !hasMask}
                startIcon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
              >
                {busy ? '处理中' : 'AI 修复'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                onClick={handleDownload}
                disabled={!isProcessed || busy}
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              >
                下载
              </Button>
            </Stack>
          </Box>
        </>
      )}
    </ToolWorkbench>
  );
}
