'use client';

// 图片裁剪：上传一张图 → 拖拽/角点调整裁剪框（可锁定比例）→ 裁剪 → 下载。
// 裁剪框坐标记录在图片原始像素坐标系中，界面用百分比定位渲染，
// 这样窗口缩放 / 响应式布局时裁剪框始终贴合图片，无需换算显示尺寸。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CropFreeIcon from '@mui/icons-material/CropFree';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
  type ResourceInfoData,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import FlowPill from '@/components/tools/FlowPill';
import { useFlowInput, makeFlowImage, type FlowImage } from '@/lib/flow';

type Rect = { x: number; y: number; w: number; h: number };
type Phase = 'idle' | 'edit' | 'result';
type Corner = 'tl' | 'tr' | 'bl' | 'br';

const RATIOS: ReadonlyArray<{ id: string; label: string; ratio: number | null }> = [
  { id: 'free', label: '自由', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

const MIN_SIZE = 16; // 裁剪框最小边长（原始像素）

// 放大镜参数：8 倍放大，180px 视窗 → 视野 23×23 原图像素
const MAG_SIZE = 180;
const MAG_ZOOM = 8;
const MAG_VIEW = Math.ceil(MAG_SIZE / MAG_ZOOM);

// 绘制放大镜：原图像素 + 整数像素网格 + 裁剪框边缘 + 角点标记。
//
// 设计要点：
// 1. 视野中心锁定在被拖动的角点（cx/cy），不跟鼠标——裁剪时人的注意力在「框边缘」而非「鼠标」，
//    鼠标越界（继续向外拉）时放大镜不应滚出去。
// 2. 网格用 fillRect 画「像素方块」+ 黑边 1px，避开 line + 双层描边在亚像素位置
//    抗锯齿叠加产生的斜纹伪影（截图中看到的斜线）。
// 3. 角点用 2px 实心方块标出，告知用户「当前放大镜显示的就是这个角的附近」。
const drawMagnifier = (
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  rect: Rect,
  activeCorner: Corner | null,
  edgeX: ReadonlyArray<number>,
  edgeY: ReadonlyArray<number>,
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const SIZE = canvas.width;
  // 视野中心按整数像素对齐，让网格落在像素方块边界上（避免抗锯齿）
  const ccx = Math.round(cx);
  const ccy = Math.round(cy);
  const half = Math.floor(MAG_VIEW / 2);
  const x0 = ccx - half;
  const y0 = ccy - half;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, SIZE, SIZE);
  // 放大的原图像素（最近邻，不模糊）
  ctx.drawImage(img, x0, y0, MAG_VIEW, MAG_VIEW, 0, 0, SIZE, SIZE);

  // 整数像素网格：用 fillRect 在每两个像素的交界画 1px 黑色细缝，
  // 既能看清网格，又不会出现 line 抗锯齿带来的斜纹
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 1; i < MAG_VIEW; i++) {
    // 竖直网格线：x 落在像素边界
    ctx.fillRect(i * MAG_ZOOM, 0, 1, SIZE);
    // 水平网格线：y 落在像素边界
    ctx.fillRect(0, i * MAG_ZOOM, SIZE, 1);
  }
  // 整 100 像素加粗加深（便于定位）
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  // 仅当视野跨越整 100 像素边界时画
  const baseX = Math.floor(x0 / 100) * 100;
  const baseY = Math.floor(y0 / 100) * 100;
  for (let p = baseX; p <= x0 + MAG_VIEW; p += 100) {
    const vx = (p - x0) * MAG_ZOOM;
    if (vx >= 0 && vx < SIZE) ctx.fillRect(vx - 1, 0, 2, SIZE);
  }
  for (let p = baseY; p <= y0 + MAG_VIEW; p += 100) {
    const vy = (p - y0) * MAG_ZOOM;
    if (vy >= 0 && vy < SIZE) ctx.fillRect(0, vy - 1, SIZE, 2);
  }

  // 裁剪框边缘：双色线——先画白色 4px 外描边（深色图片上可见），
  // 再叠深色 2px 中心线（白色图片上可见），任意底色下都清晰
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const ex of edgeX) {
    const vx = (ex - x0) * MAG_ZOOM;
    if (vx >= -2 && vx <= SIZE + 2) ctx.fillRect(vx - 2, 0, 4, SIZE);
  }
  for (const ey of edgeY) {
    const vy = (ey - y0) * MAG_ZOOM;
    if (vy >= -2 && vy <= SIZE + 2) ctx.fillRect(0, vy - 2, SIZE, 4);
  }
  ctx.fillStyle = 'rgba(15,61,58,0.9)';
  for (const ex of edgeX) {
    const vx = (ex - x0) * MAG_ZOOM;
    if (vx >= -2 && vx <= SIZE + 2) ctx.fillRect(vx - 1, 0, 2, SIZE);
  }
  for (const ey of edgeY) {
    const vy = (ey - y0) * MAG_ZOOM;
    if (vy >= -2 && vy <= SIZE + 2) ctx.fillRect(0, vy - 1, SIZE, 2);
  }

  // 被拖动的角点标记：醒目方块提示「这是当前正在对齐的角」
  if (activeCorner) {
    const corner = {
      tl: { x: rect.x, y: rect.y },
      tr: { x: rect.x + rect.w, y: rect.y },
      bl: { x: rect.x, y: rect.y + rect.h },
      br: { x: rect.x + rect.w, y: rect.y + rect.h },
    }[activeCorner];
    const ax = (corner.x - x0) * MAG_ZOOM;
    const ay = (corner.y - y0) * MAG_ZOOM;
    ctx.fillStyle = 'rgba(15,61,58,0.95)';
    ctx.fillRect(ax - 4, ay - 4, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ax - 2, ay - 2, 4, 4);
  }
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// 居中铺出符合 ratio 的最大裁剪框
const fitRect = (ratio: number, W: number, H: number): Rect => {
  let w = W;
  let h = w / ratio;
  if (h > H) {
    h = H;
    w = h * ratio;
  }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
};

// 根据原图尺寸初始化裁剪框：居中占 80%（自由比例时）
const defaultRect = (W: number, H: number, ratio: number | null): Rect =>
  ratio == null
    ? { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.8 }
    : fitRect(ratio, W, H);

export default function ImageCrop({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);

  // 资源信息：源文件大小（裁剪结果里 result 已含 size）
  const [sourceSize, setSourceSize] = React.useState(0);

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [mime, setMime] = React.useState('image/png');
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [nat, setNat] = React.useState({ w: 0, h: 0 });
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [ratioId, setRatioId] = React.useState('free');
  const [drag, setDrag] = React.useState<
    | { kind: 'none' }
    | { kind: 'move'; startX: number; startY: number; rect: Rect }
    | { kind: 'resize'; corner: Corner; startX: number; startY: number; rect: Rect }
  >({ kind: 'none' });
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [result, setResult] = React.useState<{ w: number; h: number; size: number } | null>(null);
  // 放大镜：视野中心锚定在「被拖动的裁剪框角点」上（px/py 为角点的原图像素坐标），
  // 不跟随鼠标——鼠标越界时画面不会滚出去，便于对齐框边缘。sx/sy 为角点的屏幕坐标，用于定位放大镜。
  const [mag, setMag] = React.useState<{ px: number; py: number; sx: number; sy: number } | null>(null);
  const magCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // 工作流串流：接收 ?flow= 上一工具的产物，直接载入第一张进入编辑
  const flowInput = useFlowInput();
  const flowConsumed = React.useRef(false);
  React.useEffect(() => {
    if (flowConsumed.current || !flowInput?.images.length) return;
    flowConsumed.current = true;
    const im = flowInput.images[0];
    loadFile(new File([im.blob], im.name, { type: im.mime }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowInput]);

  const ratio = RATIOS.find((r) => r.id === ratioId)?.ratio ?? null;

  // 键盘微调裁剪框：方向键移动（1px，Shift 加速 10px），编辑阶段生效。
  // 用函数式 setRect 避免把 rect 放进依赖导致每次移动都重绑事件。
  React.useEffect(() => {
    if (phase !== 'edit') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      // 微调优先，阻止方向键滚动页面
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      setRect((r) => {
        if (!r) return r;
        return {
          ...r,
          x: clamp(r.x + dx, 0, nat.w - r.w),
          y: clamp(r.y + dy, 0, nat.h - r.h),
        };
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, nat.w, nat.h]);

  // ───────── 上传 ─────────
  const loadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const W = image.naturalWidth;
      const H = image.naturalHeight;
      setNat({ w: W, h: H });
      setRect(defaultRect(W, H, ratio));
      setPhase('edit');
    };
    image.src = url;
    setSourceUrl(url);
    setFileName(file.name);
    setSourceSize(file.size);
    const t = file.type;
    setMime(t === 'image/jpeg' || t === 'image/webp' ? t : 'image/png');
    setImg(image);
    setRatioId('free');
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResultBlob(null);
    setResult(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadFile(file);
    e.target.value = '';
  };

  const handleDrop = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    loadFile(file);
  };

  const resetAll = () => {
    setPhase('idle');
    setSourceUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setResultUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setResultBlob(null);
    setImg(null);
    setRect(null);
    setResult(null);
  };

  // ───────── 比例切换 / 重置选区 ─────────
  const handleRatio = (id: string) => {
    setRatioId(id);
    if (id === 'free') return;
    const r = RATIOS.find((x) => x.id === id)!.ratio!;
    setRect(fitRect(r, nat.w, nat.h));
  };

  const handleReset = () => {
    setRect(defaultRect(nat.w, nat.h, ratio));
  };

  // ───────── 裁剪框交互 ─────────
  const startDrag = (e: React.MouseEvent, kind: 'move' | 'resize', corner?: Corner) => {
    e.preventDefault();
    if (!rect) return;
    setDrag(
      kind === 'move'
        ? { kind: 'move', startX: e.clientX, startY: e.clientY, rect }
        : { kind: 'resize', corner: corner!, startX: e.clientX, startY: e.clientY, rect },
    );
  };

  // 锁定比例时，拖角点只沿固定角所在象限缩放（禁止翻转）
  const resizeLocked = (base: Rect, corner: Corner, f: { x: number; y: number }, d: { x: number; y: number }, r: number): Rect => {
    const MIN = MIN_SIZE;
    let dx = corner.includes('l') ? Math.min(d.x, f.x - MIN) : Math.max(d.x, f.x + MIN);
    let dy = corner.includes('t') ? Math.min(d.y, f.y - MIN) : Math.max(d.y, f.y + MIN);
    dx = clamp(dx, 0, nat.w);
    dy = clamp(dy, 0, nat.h);
    const ddx = Math.abs(dx - f.x);
    const ddy = Math.abs(dy - f.y);
    let w: number;
    let h: number;
    if (ddx / r >= ddy) {
      w = ddx;
      h = w / r;
    } else {
      h = ddy;
      w = h * r;
    }
    // 不能超出图片边界：按比例整体缩小
    const maxX = corner.includes('l') ? f.x : nat.w - f.x;
    const maxY = corner.includes('t') ? f.y : nat.h - f.y;
    const scale = Math.min(1, maxX / w, maxY / h);
    w *= scale;
    h *= scale;
    if (w < MIN || h < MIN) return base;
    return {
      x: corner.includes('l') ? f.x - w : f.x,
      y: corner.includes('t') ? f.y - h : f.y,
      w,
      h,
    };
  };

  const resizeFree = (f: { x: number; y: number }, d: { x: number; y: number }): Rect => {
    const x = clamp(Math.min(f.x, d.x), 0, nat.w - MIN_SIZE);
    const y = clamp(Math.min(f.y, d.y), 0, nat.h - MIN_SIZE);
    const w = clamp(Math.abs(f.x - d.x), MIN_SIZE, nat.w - x);
    const h = clamp(Math.abs(f.y - d.y), MIN_SIZE, nat.h - y);
    return { x, y, w, h };
  };

  React.useEffect(() => {
    if (drag.kind === 'none') return;
    const stage = stageRef.current;
    if (!stage) return;

    const onMove = (e: MouseEvent) => {
      const r = stage.getBoundingClientRect();
      const sx = r.width / nat.w;
      const sy = r.height / nat.h;
      const dx = (e.clientX - drag.startX) / sx;
      const dy = (e.clientY - drag.startY) / sy;

      // 放大镜锚点：图像像素坐标 + 对应屏幕坐标。视野中心锁定在裁剪框角点上，
      // 鼠标越界时框停在边界、画面不滚走。
      const anchor = (ax: number, ay: number) =>
        setMag({ px: ax, py: ay, sx: r.left + ax * sx, sy: r.top + ay * sy });

      if (drag.kind === 'move') {
        const base = drag.rect;
        const nx = clamp(Math.round(base.x + dx), 0, nat.w - base.w);
        const ny = clamp(Math.round(base.y + dy), 0, nat.h - base.h);
        setRect({ ...base, x: nx, y: ny });
        anchor(nx, ny); // 移动时锚定框的左上角
        return;
      }

      const base = drag.rect;
      const c = drag.corner;
      // 固定角（对角的那个角，不动）
      const f = (() => {
        if (c === 'tl') return { x: base.x + base.w, y: base.y + base.h };
        if (c === 'tr') return { x: base.x, y: base.y + base.h };
        if (c === 'bl') return { x: base.x + base.w, y: base.y };
        return { x: base.x, y: base.y };
      })();
      // 被拖动的角点：初始位置 + 鼠标位移，1:1 跟随
      const cornerStart = {
        tl: { x: base.x, y: base.y },
        tr: { x: base.x + base.w, y: base.y },
        bl: { x: base.x, y: base.y + base.h },
        br: { x: base.x + base.w, y: base.y + base.h },
      }[c];
      const dragged = { x: cornerStart.x + dx, y: cornerStart.y + dy };
      const next = ratio == null ? resizeFree(f, dragged) : resizeLocked(base, c, f, dragged, ratio);
      // 1px 吸附：取整后的矩形
      const snap = {
        x: Math.round(next.x),
        y: Math.round(next.y),
        w: Math.max(1, Math.round(next.w)),
        h: Math.max(1, Math.round(next.h)),
      };
      setRect(snap);
      // 放大镜锚定在被拖动的角点上
      const corner = {
        tl: { x: snap.x, y: snap.y },
        tr: { x: snap.x + snap.w, y: snap.y },
        bl: { x: snap.x, y: snap.y + snap.h },
        br: { x: snap.x + snap.w, y: snap.y + snap.h },
      }[c];
      anchor(corner.x, corner.y);
    };

    const onUp = () => {
      setDrag({ kind: 'none' });
      setMag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, nat, ratio]);

  // 放大镜绘制：锚点（角点像素坐标）或裁剪框变化时重绘
  React.useEffect(() => {
    if (!mag || !img || !rect) return;
    const canvas = magCanvasRef.current;
    if (!canvas) return;
    drawMagnifier(
      canvas,
      img,
      mag.px,
      mag.py,
      rect,
      drag.kind === 'resize' ? drag.corner : 'tl',
      [rect.x, rect.x + rect.w],
      [rect.y, rect.y + rect.h],
    );
  }, [mag, img, rect, drag]);

  // ───────── 裁剪出图 ─────────
  const doCrop = async () => {
    if (!img || !rect) return;
    const cw = Math.max(1, Math.round(rect.w));
    const ch = Math.max(1, Math.round(rect.h));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, cw, ch);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片编码失败'))), mime, 0.92);
    });
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setResultBlob(blob);
    setResult({ w: cw, h: ch, size: blob.size });
    setPhase('result');
  };

  const download = () => {
    if (!resultUrl) return;
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const base = fileName.replace(/\.[^.]+$/, '');
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `${base}-裁剪.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 结果态产物 → 工作流出口（供 FlowPill 串到下一个工具）
  const flowImages: FlowImage[] = React.useMemo(() => {
    if (!resultBlob || !result) return [];
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const base = fileName.replace(/\.[^.]+$/, '');
    return [makeFlowImage(resultBlob, `${base}-裁剪.${ext}`, result.w, result.h)];
  }, [resultBlob, result, mime, fileName]);

  // 侧边栏「资源信息」：处理前（原图）→ 处理后（裁剪结果）的大小与尺寸
  const resourceData: ResourceInfoData = {
    name: fileName || undefined,
    before:
      phase !== 'idle'
        ? { size: sourceSize || undefined, width: nat.w || undefined, height: nat.h || undefined }
        : undefined,
    after: result ? { size: result.size, width: result.w, height: result.h } : undefined,
  };

  // ───────── 渲染 ─────────
  const cornerPos: Record<Corner, React.CSSProperties> = {
    tl: { top: -7, left: -7, cursor: 'nwse-resize' },
    tr: { top: -7, right: -7, cursor: 'nesw-resize' },
    bl: { bottom: -7, left: -7, cursor: 'nesw-resize' },
    br: { bottom: -7, right: -7, cursor: 'nwse-resize' },
  };

  const emptyState = (
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
      <CropFreeIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
      <Typography variant="body2">点击或拖拽图片到此处</Typography>
      <Button
        variant="contained"
        size="small"
        startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
        sx={{ mt: 1 }}
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        选择图片
      </Button>
    </Box>
  );

  return (
    <>
      {/* 隐藏 input：作为 ToolWorkbench 兄弟节点，保证空状态/编辑/结果阶段都可用 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <ToolWorkbench
        title={title}
        description={description}
        hasContent={phase !== 'idle'}
        emptyState={emptyState}
        onPickFile={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        usage={
          <TipCard
            icon={<CropFreeIcon />}
            text="上传图片后拖拽移动裁剪框、拖动四角调整大小；可锁定比例，完成后点击「裁剪」下载。"
          />
        }
        config={
          phase === 'edit' && rect ? (
            <Box>
              <SidebarTitle>裁剪设置</SidebarTitle>

              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                比例
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2.5 }}>
                {RATIOS.map((r) => {
                  const active = r.id === ratioId;
                  return (
                    <Box
                      key={r.id}
                      onClick={() => handleRatio(r.id)}
                      sx={{
                        px: 1.25,
                        py: 0.4,
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: 0.75,
                        border: 1,
                        borderColor: active ? 'primary.main' : 'divider',
                        bgcolor: active ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                        color: active ? 'primary.main' : 'text.primary',
                        cursor: 'pointer',
                        transition: 'all 160ms ease',
                        '&:hover': { borderColor: active ? 'primary.main' : 'text.secondary' },
                      }}
                    >
                      {r.label}
                    </Box>
                  );
                })}
              </Stack>

              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                裁剪尺寸
              </Typography>
              <Typography variant="body2">
                {Math.round(rect.w)} × {Math.round(rect.h)} px
                <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.75 }}>
                  （原图 {nat.w} × {nat.h}）
                </Typography>
              </Typography>
            </Box>
          ) : undefined
        }
        resource={
          phase !== 'idle' ? (
            <Box>
              <SidebarTitle>资源信息</SidebarTitle>
              <SidebarResourceInfo data={resourceData} />
            </Box>
          ) : undefined
        }
        flow={flowImages.length ? <FlowPill images={flowImages} /> : undefined}
      >
      {phase === 'edit' && sourceUrl && rect && (
        <>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {/* 舞台：fit-content 贴合图片显示尺寸（等比缩放到不超过 maxHeight），
                裁剪框按原图像素坐标 + 百分比定位，窗口缩放时始终贴合图片 */}
            <Box
              ref={stageRef}
              sx={{
                position: 'relative',
                width: 'fit-content',
                maxWidth: '100%',
                maxHeight: 480,
                overflow: 'hidden',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider',
                background: '#fff',
                userSelect: 'none',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sourceUrl}
                alt="待裁剪"
                draggable={false}
                style={{ display: 'block', maxWidth: '100%', maxHeight: 480, width: 'auto', height: 'auto' }}
              />

            {/* 裁剪框：box-shadow 压暗外部区域 */}
            <Box
              onMouseDown={(e) => startDrag(e, 'move')}
              sx={{
                position: 'absolute',
                left: `${(rect.x / nat.w) * 100}%`,
                top: `${(rect.y / nat.h) * 100}%`,
                width: `${(rect.w / nat.w) * 100}%`,
                height: `${(rect.h / nat.h) * 100}%`,
                border: '1.5px solid #fff',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                cursor: 'move',
                zIndex: 2,
              }}
            >
              {/* 尺寸角标 */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -27,
                  left: -1.5,
                  bgcolor: 'rgba(0,0,0,0.65)',
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: 1.4,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {Math.round(rect.w)} × {Math.round(rect.h)}
              </Box>

              {/* 四角手柄 */}
              {(Object.keys(cornerPos) as Corner[]).map((c) => (
                <Box
                  key={c}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startDrag(e, 'resize', c);
                  }}
                  sx={{
                    position: 'absolute',
                    ...cornerPos[c],
                    width: 14,
                    height: 14,
                    bgcolor: '#fff',
                    border: '1.5px solid',
                    borderColor: 'primary.main',
                    borderRadius: 0.5,
                    zIndex: 3,
                  }}
                />
              ))}
            </Box>
          </Box>
          </Box>

          {/* 功能按钮：放在图片下方，与其他工具布局一致 */}
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button variant="outlined" size="small" onClick={handleReset} startIcon={<RestartAltIcon />}>
              重置选区
            </Button>
            <Button variant="outlined" size="small" onClick={resetAll}>
              更换图片
            </Button>
            <Button variant="contained" size="small" onClick={doCrop} startIcon={<CropFreeIcon />}>
              裁剪
            </Button>
          </Stack>
        </>
      )}

      {/* 放大镜：锚定在裁剪框角点附近，8 倍放大显示像素网格、裁剪框边缘线与角点标记 */}
      {mag && phase === 'edit' && (
        <Box
          sx={{
            position: 'fixed',
            zIndex: 1300,
            pointerEvents: 'none',
            // 默认放在锚点右上方；右/上空间不足时翻转到左侧
            left: mag.sx + MAG_SIZE / 2 + 24 > window.innerWidth ? Math.max(8, mag.sx - MAG_SIZE - 24) : mag.sx + 16,
            top: mag.sy - MAG_SIZE - 16 < 8 ? mag.sy + 16 : mag.sy - MAG_SIZE - 16,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            boxShadow: 3,
            bgcolor: '#fff',
          }}
        >
          <canvas
            ref={magCanvasRef}
            width={MAG_SIZE}
            height={MAG_SIZE}
            style={{ display: 'block', imageRendering: 'pixelated' }}
          />
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: 4,
              top: 4,
              px: 0.5,
              borderRadius: 0.5,
              bgcolor: 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--font-geist-mono)',
              fontSize: 10,
              color: 'text.secondary',
            }}
          >
            {Math.floor(mag.px)}, {Math.floor(mag.py)}
          </Typography>
        </Box>
      )}

      {phase === 'result' && resultUrl && result && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="裁剪结果"
                style={{ display: 'block', maxWidth: '100%', maxHeight: 480 }}
              />
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button variant="contained" size="small" onClick={download} startIcon={<DownloadIcon />}>
              下载
            </Button>
            <Button variant="outlined" size="small" onClick={() => setPhase('edit')}>
              重新裁剪
            </Button>
            <Button variant="outlined" size="small" onClick={resetAll}>
              更换图片
            </Button>
          </Stack>
        </Box>
      )}
      </ToolWorkbench>
    </>
  );
}
