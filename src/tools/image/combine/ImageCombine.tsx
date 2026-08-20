'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import LayersIcon from '@mui/icons-material/Layers';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  ShortcutList,
  SidebarResourceInfo,
  useContainSize,
} from '@/components/tools/ToolWorkbench';
import {
  CANVAS_W,
  CANVAS_H,
  aabb,
  clampInside,
  computeMove,
  computeResize,
  computeRotate,
  hitInside,
  pickCorner,
  type Point,
} from './_lib/transform';
import FlowPill from '@/components/tools/FlowPill';
import { SelectedOverlay } from '@/components/tools/SelectedOverlay';
import { resolveImageFromSearch } from '@/lib/cross-tool-image';
import { useFlowInput, flowImagesToFiles, makeFlowImage, type FlowImage } from '@/lib/flow';

type CompositeMode = GlobalCompositeOperation;

type Layer = {
  id: string;
  img: HTMLImageElement;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number; // radians
  opacity: number; // 0-1
  mode: CompositeMode;
  name: string;
  radius: number; // 圆角（画布像素，0 = 直角）
};

const MODE_PRESETS: ReadonlyArray<{
  v: CompositeMode;
  label: string;
  desc: string;
}> = [
  { v: 'source-over', label: '默认', desc: '直接覆盖在底图上（最常用）' },
  { v: 'source-atop', label: '局部', desc: '图层只在与底图重叠处显示，超出部分被裁剪，适合贴在底图形状内' },
  { v: 'lighter', label: '加亮', desc: '叠加区域整体变亮，适合光斑、高光、星光' },
  { v: 'screen', label: '滤色', desc: '保留底图亮部、黑色区域不变，整体变亮，适合发光、柔和光效' },
  { v: 'multiply', label: '正片叠底', desc: '保留底图暗部、白色区域不变，整体变暗，适合叠纹理、布料/纸张质感' },
  { v: 'source-in', label: '剪贴', desc: '只保留图层与底图重叠的部分，把内容装进底图形状 = 剪贴蒙版' },
  { v: 'source-out', label: '反剪', desc: '重叠处只保留底图，图层仅显示在底图之外' },
  { v: 'destination-out', label: '擦除', desc: '把底图上被图层盖住的部分擦成透明（手动抠图的橡皮擦），图层本身不显示' },
  { v: 'xor', label: '挖空', desc: '重叠处图层与底图都消失、透出背景，不重叠的部分都保留（镂空）' },
];

const HIT_SIZE = 12; // px，旋转后的屏幕坐标

// 吸附对齐：移动时贴近其他图层（边缘/中心）或画布（边缘/中心）自动吸附并显示高亮线
const SNAP_TOL = 8; // 吸附阈值（屏幕像素，换算画布像素时除以 scale）
type SnapLine = { axis: 'v' | 'h'; pos: number };

export default function ImageCombine({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const guideCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const baseFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);

  const [layers, setLayers] = React.useState<Layer[]>([]);
  // 拖拽中吸附产生的对齐辅助线（绘制在 guideCanvas 上，不参与导出）
  const [snapLines, setSnapLines] = React.useState<SnapLine[]>([]);
  // layers 的最新值镜像，供拖拽移动计算吸附时读取，避免闭包陈旧
  const layersRef = React.useRef<Layer[]>(layers);
  React.useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  // 背景色（画布属性，不参与层级）：color + opacity
  const [bgColor, setBgColor] = React.useState<{ color: string; opacity: number } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragState, setDragState] = React.useState<
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
      }
  >({ kind: 'none' });
  const [scale, setScale] = React.useState(1); // 屏幕 px / canvas px
  // 画布真实像素（用户可设置）。界面 CSS：宽度固定占满容器，高度按 宽/高 比例自适应
  const [canvasW, setCanvasW] = React.useState(CANVAS_W);
  const [canvasH, setCanvasH] = React.useState(CANVAS_H);
  // 画布按容器等比撑满（contain-fit）：宽高变化或容器缩放时自动重算
  const [fitRef, fitSize] = useContainSize(canvasW, canvasH);

  // ───────── 重绘 ─────────
  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // 背景色填充（画布属性，不参与层级）
    if (bgColor) {
      ctx.save();
      ctx.globalAlpha = bgColor.opacity;
      ctx.fillStyle = bgColor.color;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }

    // 图层按数组顺序从底到顶绘制（layers[0] 最底）
    for (const layer of layers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.translate(layer.cx, layer.cy);
      ctx.rotate(layer.rotation);

      if (layer.radius > 0) {
        // 图片：圆角路径裁剪后绘制
        ctx.save();
        ctx.globalCompositeOperation = layer.mode;
        ctx.beginPath();
        ctx.roundRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h, layer.radius);
        ctx.clip();
        ctx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalCompositeOperation = layer.mode;
        ctx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
        ctx.restore();
      }
      ctx.restore();
    }
  }, [bgColor, canvasW, canvasH, layers]);

  React.useEffect(() => {
    render();
  }, [render]);

  // ───────── 屏幕 ↔ canvas 坐标转换 ─────────
  const screenToCanvas = React.useCallback(
    (sx: number, sy: number): Point | null => {
      const el = surfaceRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = ((sx - rect.left) / rect.width) * canvasW;
      const y = ((sy - rect.top) / rect.height) * canvasH;
      return { x, y };
    },
    [canvasW, canvasH],
  );

  // ───────── 吸附对齐 ─────────
  // 把移动层的 AABB 三参考线（左/中/右、上/中/下）与其它图层的 AABB 三参考线
  // 以及画布边缘/中心对齐：命中阈值内吸附并返回高亮线（画布坐标）。
  const applySnap = React.useCallback(
    (layer: Layer, others: Layer[]): { cx: number; cy: number; lines: SnapLine[] } => {
      const tol = SNAP_TOL / scale;
      const lines: SnapLine[] = [];
      let cx = layer.cx;
      let cy = layer.cy;

      const trySnap = (axis: 'x' | 'y') => {
        const bb = aabb(cx, cy, layer.w, layer.h, layer.rotation);
        const me =
          axis === 'x'
            ? [bb.x, bb.x + bb.w / 2, bb.x + bb.w]
            : [bb.y, bb.y + bb.h / 2, bb.y + bb.h];
        const targets: number[] =
          axis === 'x' ? [0, canvasW / 2, canvasW] : [0, canvasH / 2, canvasH];
        for (const o of others) {
          const ob = aabb(o.cx, o.cy, o.w, o.h, o.rotation);
          if (axis === 'x') targets.push(ob.x, ob.x + ob.w / 2, ob.x + ob.w);
          else targets.push(ob.y, ob.y + ob.h / 2, ob.y + ob.h);
        }
        let best: { diff: number; t: number; m: number } | null = null;
        for (const t of targets) {
          for (const m of me) {
            const diff = Math.abs(m - t);
            if (best === null || diff < best.diff) best = { diff, t, m };
          }
        }
        if (best && best.diff <= tol) {
          if (axis === 'x') {
            cx += best.t - best.m;
            lines.push({ axis: 'v', pos: best.t });
          } else {
            cy += best.t - best.m;
            lines.push({ axis: 'h', pos: best.t });
          }
        }
      };

      trySnap('x');
      trySnap('y');
      return { cx, cy, lines };
    },
    [scale, canvasW, canvasH],
  );

  // 对齐辅助线绘制：吸附命中时在 guideCanvas 上画出贯穿画布的高亮线
  React.useEffect(() => {
    const g = guideCanvasRef.current;
    if (!g) return;
    const ctx = g.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    const drawn = new Set<string>();
    for (const line of snapLines) {
      const key = `${line.axis}:${Math.round(line.pos)}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      if (line.axis === 'v') {
        ctx.moveTo(line.pos, 0);
        ctx.lineTo(line.pos, canvasH);
      } else {
        ctx.moveTo(0, line.pos);
        ctx.lineTo(canvasW, line.pos);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [snapLines, canvasW, canvasH]);

  // 暴露 scale 给覆盖层用
  React.useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / canvasW);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);

  // ───────── 文件读取 ─────────
  const readImage = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ───────── 接图（URL ?fg= / ?bg= → sessionStorage → File → 加载）─────────
  // 直接读 window.location.search，避免 useSearchParams 在 Next 14 需要 Suspense 包裹
  const inboundHandledRef = React.useRef(false);
  React.useEffect(() => {
    if (inboundHandledRef.current) return;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const resolved = resolveImageFromSearch(url.searchParams);
    if (Object.keys(resolved).length === 0) return;
    inboundHandledRef.current = true;
    (async () => {
      // ?bg= 作为底层图层加入，?fg= 作为顶层图层加入；均为普通图层，层级可自由调整
      const incoming: Layer[] = [];
      if (resolved.bg) {
        const img = await readImage(resolved.bg);
        // bg 层铺满画布（contain 居中），保持原图比例
        const br = Math.min(canvasW / img.width, canvasH / img.height);
        incoming.push({
          id: `layer-${Date.now()}-bg`,
          img,
          cx: canvasW / 2,
          cy: canvasH / 2,
          w: img.width * br,
          h: img.height * br,
          rotation: 0,
          opacity: 1,
          mode: 'source-over',
          name: resolved.bg.name,
          radius: 0,
        });
      }
      if (resolved.fg) {
        const img = await readImage(resolved.fg);
        const ratio = Math.min((canvasW * 0.6) / img.width, (canvasH * 0.6) / img.height);
        incoming.push({
          id: `layer-${Date.now()}-fg`,
          img,
          cx: canvasW / 2,
          cy: canvasH / 2,
          w: img.width * ratio,
          h: img.height * ratio,
          rotation: 0,
          opacity: 1,
          mode: 'source-over',
          name: resolved.fg.name,
          radius: 0,
        });
      }
      if (incoming.length > 0) {
        setLayers((prev) => [...prev, ...incoming]);
        setSelectedId(incoming[incoming.length - 1].id);
      }
      // 清理 URL 上的 session: 参数，避免刷新再次触发
      url.searchParams.delete('fg');
      url.searchParams.delete('bg');
      window.history.replaceState({}, '', url.toString());
    })();
  }, [canvasW, canvasH]);

  // ───────── 背景色（画布属性，不参与层级） ─────────
  // 选色时保留当前透明度；设透明度时不改变颜色；可单独清除
  const handleColorBase = (color: string) => {
    setBgColor((prev) => ({ color, opacity: prev?.opacity ?? 1 }));
  };
  const handleBgOpacity = (opacity: number) => {
    setBgColor((prev) => (prev ? { ...prev, opacity } : null));
  };
  const handleClearBg = () => {
    setBgColor(null);
  };

  // ───────── 添加图层 ─────────
  // 新图默认添加到顶层；画布尺寸由用户设置，添加图片不改动画布
  // 单张图片摄入：文件选择与工作流串流（?flow=）共用
  const addImageFile = async (file: File) => {
    const img = await readImage(file);
    // 默认 contain 到画布的 60%，居中
    const ratio = Math.min((canvasW * 0.6) / img.width, (canvasH * 0.6) / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const layer: Layer = {
      id,
      img,
      cx: canvasW / 2,
      cy: canvasH / 2,
      w,
      h,
      rotation: 0,
      opacity: 1,
      mode: 'source-over',
      name: file.name,
      radius: 0,
    };
    setLayers((prev) => [...prev, layer]);
    setSelectedId(id);
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addImageFile(file);
    e.target.value = '';
  };

  // ToolWorkbench 统一处理拖拽：每张图作为一个图层加入
  const onToolDrop = (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    list.forEach((f) => void addImageFile(f));
  };

  // ───────── 工作流串流摄入（?flow=） ─────────
  // 挂载时把上游工具传来的图片整批加入图层，复用 addImageFile 的文件摄入逻辑
  const flowInput = useFlowInput();
  const flowConsumed = React.useRef(false);
  React.useEffect(() => {
    if (flowConsumed.current || !flowInput?.images.length) return;
    flowConsumed.current = true;
    Promise.allSettled(flowImagesToFiles(flowInput.images).map((f) => addImageFile(f)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowInput]);

  // ───────── 选中 ─────────
  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;

  // ───────── 鼠标按下 ─────────
  // 从屏幕坐标尝试对「选中层」启动拖拽（角点缩放 → 旋转 → 移动），命中返回 true。
  // 覆盖层的角点 / 旋转柄 onMouseDown 复用同一逻辑：手柄就停在命中点正上方，
  // 点角点必命中 pickCorner，点旋转柄必命中旋转检测。
  const tryStartDrag = (clientX: number, clientY: number): boolean => {
    const p = screenToCanvas(clientX, clientY);
    if (!p || !selectedLayer) return false;

    // 角点缩放
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
      return true;
    }

    // 旋转手柄（旋转后的顶部中点，沿法线外移 24px）
    const rotSin = Math.sin(selectedLayer.rotation);
    const rotCos = Math.cos(selectedLayer.rotation);
    const handleX =
      selectedLayer.cx + (selectedLayer.h / 2) * rotSin - rotSin * 24;
    const handleY =
      selectedLayer.cy - (selectedLayer.h / 2) * rotCos + rotCos * 24;
    if (
      Math.abs(p.x - handleX) < 8 / scale &&
      Math.abs(p.y - handleY) < 8 / scale
    ) {
      const startAngle = Math.atan2(
        p.y - selectedLayer.cy,
        p.x - selectedLayer.cx,
      );
      setDragState({
        kind: 'rotate',
        layerId: selectedLayer.id,
        startAngle,
        startRotation: selectedLayer.rotation,
        center: { x: selectedLayer.cx, y: selectedLayer.cy },
      });
      return true;
    }

    // 内部 → 移动
    if (
      hitInside(
        p,
        selectedLayer.cx,
        selectedLayer.cy,
        selectedLayer.w,
        selectedLayer.h,
        selectedLayer.rotation,
      )
    ) {
      setDragState({
        kind: 'move',
        layerId: selectedLayer.id,
        offsetX: p.x - selectedLayer.cx,
        offsetY: p.y - selectedLayer.cy,
      });
      return true;
    }
    return false;
  };

  const onSurfaceMouseDown = (e: React.MouseEvent) => {
    // 点在覆盖层控件上（删除按钮 / 角点 / 旋转柄）时，由控件自己处理
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-overlay-control]')) {
      return;
    }
    if (tryStartDrag(e.clientX, e.clientY)) {
      return;
    }

    // 2) 点中其他 layer（按 z-order 从顶到底）→ 选中
    const p = screenToCanvas(e.clientX, e.clientY);
    if (!p) return;
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

  // ───────── 鼠标移动 ─────────
  React.useEffect(() => {
    if (dragState.kind === 'none') return;

    const onMove = (e: MouseEvent) => {
      const p = screenToCanvas(e.clientX, e.clientY);
      if (!p) return;
      const cur = layersRef.current;
      const idx = cur.findIndex((l) => l.id === dragState.layerId);
      if (idx < 0) return;
      const l = cur[idx];

      if (dragState.kind === 'move') {
        const c = computeMove(dragState, p, l.w, l.h, l.rotation, { w: canvasW, h: canvasH });
        // 吸附：以最新图层列表为参照，命中阈值内对齐并返回高亮线
        const others = cur.filter((o) => o.id !== l.id);
        const snapped = applySnap({ ...l, cx: c.cx, cy: c.cy }, others);
        const fixed = clampInside(snapped.cx, snapped.cy, l.w, l.h, l.rotation, { w: canvasW, h: canvasH });
        setSnapLines(snapped.lines);
        setLayers((prev) => prev.map((x) => (x.id === l.id ? { ...x, cx: fixed.cx, cy: fixed.cy } : x)));
      } else {
        // 缩放 / 旋转时不做吸附，清掉可能残留的对齐线
        setSnapLines([]);
        if (dragState.kind === 'resize') {
          const s = computeResize(dragState, p, { w: canvasW, h: canvasH });
          setLayers((prev) => prev.map((x) => (x.id === l.id ? { ...x, w: s.w, h: s.h } : x)));
        } else if (dragState.kind === 'rotate') {
          const r = computeRotate(dragState, p, l.w, l.h, { w: canvasW, h: canvasH });
          setLayers((prev) => prev.map((x) => (x.id === l.id ? { ...x, rotation: r.rotation, cx: r.cx, cy: r.cy } : x)));
        }
      }
    };

    const onUp = () => {
      setDragState({ kind: 'none' });
      setSnapLines([]);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, screenToCanvas, scale, canvasW, canvasH, applySnap]);

  // ───────── 键盘快捷键 ─────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 在输入控件内不响应
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteLayer(selectedId);
        return;
      }
      // 方向键微调位置（每按 1px）
      if (selectedId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
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
            const fixed = clampInside(cx, cy, l.w, l.h, l.rotation);
            return { ...l, cx: fixed.cx, cy: fixed.cy };
          }),
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // ───────── 右栏操作 ─────────
  const updateLayer = (id: string, patch: Partial<Layer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const moveLayer = (id: string, dir: 'up' | 'down' | 'top' | 'bottom') => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      if (dir === 'top') {
        if (idx === prev.length - 1) return prev;
        const next = [...prev];
        const [item] = next.splice(idx, 1);
        next.push(item);
        return next;
      }
      if (dir === 'bottom') {
        if (idx === 0) return prev;
        const next = [...prev];
        const [item] = next.splice(idx, 1);
        next.unshift(item);
        return next;
      }
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

  // ───────── 下载 / 清空 ─────────
  // 出参（工作流串流）：合成画布 → PNG Blob，供 FlowPill 接力到下一工具
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [resultW, setResultW] = React.useState(0);
  const [resultH, setResultH] = React.useState(0);

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 画布内容（含底图 + 各图层）的包围盒，用于"去除周围透明像素后导出"
  const getTrimmedDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (data[(row + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // 全透明，无内容
    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = tw;
    out.height = th;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
    return out.toDataURL('image/png', 1);
  };

  const handleDownload = () => {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // 写工作流出参：合成画布 → PNG Blob + 画布宽高
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          setResultBlob(blob);
          setResultW(canvas.width);
          setResultH(canvas.height);
        },
        'image/png',
        1,
      );
      downloadDataUrl(canvas.toDataURL('image/png', 1), `合成图-${Date.now()}.png`);
    });
  };

  // 去除周围透明像素后导出（底图 contain 或图层未铺满时，结果尺寸小于画布）
  const handleTrimmedDownload = () => {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const dataUrl = getTrimmedDataUrl();
      if (!dataUrl) return; // 画布全透明
      downloadDataUrl(dataUrl, `合成图-裁剪-${Date.now()}.png`);
    });
  };

  const handleClear = () => {
    setLayers([]);
    setBgColor(null);
    setSelectedId(null);
  };

  // 工作流出参：合成结果 → FlowImage（供 FlowPill 接力到下一工具）
  const flowImages: FlowImage[] = React.useMemo(
    () => (resultBlob ? [makeFlowImage(resultBlob, '合成图.png', resultW, resultH)] : []),
    [resultBlob, resultW, resultH],
  );

  return (
    <ToolWorkbench
      title={title}
      description={description}
      hasContent
      onDrop={onToolDrop}
      usage={
        <>
          <TipCard
            icon={<LayersIcon />}
            text="把多张图片作为图层叠加合成：画布上拖动调整位置，贴近其他图片或画布边缘/中心时自动吸附并显示对齐线；角点缩放、上方手柄旋转；右栏可改混合模式、透明度、圆角与背景色。"
          />
          <Box sx={{ mt: 2.5 }}>
            <ShortcutList
              items={[
                { k: '↑↓←→', d: '微调位置' },
                { k: 'Shift + 方向键', d: '大步移动' },
                { k: 'Delete', d: '删除选中层' },
                { k: 'Esc', d: '取消选中' },
              ]}
            />
          </Box>
        </>
      }
      config={
        <>
          {/* CONFIG_COMBINE */}
          <SidebarTitle>画布尺寸 (px)</SidebarTitle>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              type="number"
              value={canvasW}
              onChange={(e) => {
                const v = Math.max(1, Math.floor(Number(e.target.value) || CANVAS_W));
                setCanvasW(v);
              }}
              slotProps={{ htmlInput: { min: 1, style: { fontSize: 13 } } }}
              sx={{ width: 110 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              ×
            </Typography>
            <TextField
              size="small"
              type="number"
              value={canvasH}
              onChange={(e) => {
                const v = Math.max(1, Math.floor(Number(e.target.value) || CANVAS_H));
                setCanvasH(v);
              }}
              slotProps={{ htmlInput: { min: 1, style: { fontSize: 13 } } }}
              sx={{ width: 110 }}
            />
          </Stack>

          <Box sx={{ mt: 2.5 }}>
            <SidebarTitle>背景色</SidebarTitle>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box component="label" sx={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: bgColor?.color ?? '#ffffff',
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: (t) => t.shadows[1],
                  }}
                />
                <input
                  type="color"
                  value={bgColor?.color ?? '#ffffff'}
                  onChange={(e) => handleColorBase(e.target.value)}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
                />
              </Box>
              <Slider
                size="small"
                value={bgColor?.opacity ?? 1}
                min={0}
                max={1}
                step={0.05}
                onChange={(_, v) => handleBgOpacity(v as number)}
                disabled={!bgColor}
                sx={{ flex: 1 }}
              />
              <IconButton size="small" onClick={handleClearBg} disabled={!bgColor} title="清除背景色">
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          </Box>
          {/* CONFIG_COMBINE_2 */}
          <Box sx={{ mt: 2.5 }}>
            <SidebarTitle>图层 · {layers.length}</SidebarTitle>
            {layers.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ py: 0.5, fontSize: 13 }}>
                还没有图层，先添加图片
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
                        py: 1.25,
                        px: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        transition: 'background-color 160ms ease',
                        bgcolor: selected ? 'rgba(15, 61, 58, 0.06)' : 'transparent',
                        border: 1,
                        borderColor: selected ? 'primary.main' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 20,
                          flexShrink: 0,
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: 11,
                          color: 'text.secondary',
                          textAlign: 'right',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </Box>
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
                          {layer.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10 }}
                        >
                          {MODE_PRESETS.find((m) => m.v === layer.mode)?.label} ·{' '}
                          {Math.round(layer.opacity * 100)}% ·{' '}
                          {Math.round((layer.rotation * 180) / Math.PI)}°
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayer(layer.id, 'top');
                          }}
                          disabled={i === layers.length - 1}
                          sx={{ p: 0.25 }}
                        >
                          <VerticalAlignTopIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayer(layer.id, 'up');
                          }}
                          disabled={i === layers.length - 1}
                          sx={{ p: 0.25 }}
                        >
                          <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayer(layer.id, 'down');
                          }}
                          disabled={i === 0}
                          sx={{ p: 0.25 }}
                        >
                          <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayer(layer.id, 'bottom');
                          }}
                          disabled={i === 0}
                          sx={{ p: 0.25 }}
                        >
                          <VerticalAlignBottomIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLayer(layer.id);
                          }}
                          sx={{ p: 0.25, color: 'text.secondary' }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
          {/* CONFIG_COMBINE_3 */}
          {selectedLayer && (
            <Box sx={{ mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
              <SidebarTitle>选中层</SidebarTitle>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  合成方式
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {MODE_PRESETS.map((m) => {
                    const active = selectedLayer.mode === m.v;
                    return (
                      <Tooltip key={m.v} title={m.desc} placement="top">
                        <Box
                          onClick={() => updateLayer(selectedLayer.id, { mode: m.v })}
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
                            '&:hover': {
                              borderColor: active ? 'primary.main' : 'text.secondary',
                            },
                          }}
                        >
                          {m.label}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  不透明度 · {Math.round(selectedLayer.opacity * 100)}%
                </Typography>
                <Slider
                  size="small"
                  value={selectedLayer.opacity}
                  min={0}
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
                    );
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === selectedLayer.id
                          ? { ...l, rotation: rad, cx: fixed.cx, cy: fixed.cy }
                          : l,
                      ),
                    );
                  }}
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  圆角 · {Math.round(selectedLayer.radius)}px
                </Typography>
                <Slider
                  size="small"
                  value={selectedLayer.radius}
                  min={0}
                  max={200}
                  step={1}
                  onChange={(_, v) => updateLayer(selectedLayer.id, { radius: v as number })}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Box>
          )}
        </>
      }
      resource={
        <SidebarResourceInfo
          data={{
            name: layers.length ? `${layers.length} 个图层` : undefined,
            extra: [
              { label: '画布', value: `${canvasW} × ${canvasH}` },
              ...(resultBlob ? [{ label: '已导出', value: `${resultW} × ${resultH}` }] : []),
            ],
          }}
        />
      }
      flow={flowImages.length > 0 ? <FlowPill images={flowImages} /> : undefined}
      actions={
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
          >
            添加图片
            <input
              ref={baseFileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleAddImage}
            />
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={handleDownload}
            disabled={layers.length === 0}
          >
            画布下载
          </Button>
          <Tooltip title="去除周围透明像素后导出（结果尺寸小于画布，默认下载）">
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={handleTrimmedDownload}
              disabled={layers.length === 0}
            >
              下载
            </Button>
          </Tooltip>
          <Button
            variant="text"
            color="inherit"
            size="small"
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            onClick={handleClear}
            disabled={layers.length === 0 && !bgColor}
          >
            清空
          </Button>
          <Box sx={{ flex: 1 }} />
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
            {layers.length > 0
              ? `${layers[0].name} · ${layers.length} 个图层`
              : `${canvasW} × ${canvasH}`}
          </Typography>
        </Stack>
      }
    >
      {/* ───────── 画布 + 覆盖层 + 下方按钮 ───────── */}
      {/* 画布预览：容器 flex:1 居中，画布按宽高比等比撑满可用区域（contain-fit），
          不会在中间留下大片空白，也不拉伸变形。 */}
      <Box
        ref={fitRef}
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          ref={surfaceRef}
          onMouseDown={onSurfaceMouseDown}
          sx={{
            position: 'relative',
            width: fitSize ? fitSize.w : '100%',
            height: fitSize ? fitSize.h : '100%',
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            // 棋盘格 = 透明背景示意（canvas 不填底色，透明区域可见）
            bgcolor: '#ffffff',
            backgroundImage:
              'linear-gradient(45deg, #e6e6e6 25%, transparent 25%), linear-gradient(-45deg, #e6e6e6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e6e6e6 75%), linear-gradient(-45deg, transparent 75%, #e6e6e6 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
            cursor:
              !selectedLayer
                ? 'default'
                : dragState.kind !== 'none'
                  ? 'grabbing'
                  : 'grab',
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              // 不设背景色：透明区域直接露出下方棋盘格
            }}
          />

          {/* 对齐辅助线层：吸附命中时绘制贯穿画布的高亮线（不参与导出） */}
          <canvas
            ref={guideCanvasRef}
            width={canvasW}
            height={canvasH}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />

          {/* 选中层覆盖层 */}
          {selectedLayer && (
            <SelectedOverlay
              layer={selectedLayer}
              bounds={{ w: canvasW, h: canvasH }}
              onDelete={() => deleteLayer(selectedLayer.id)}
              onCornerDown={tryStartDrag}
              onRotateDown={tryStartDrag}
            />
          )}

          {/* 空状态占位：无图层且无背景色 */}
          {layers.length === 0 && !bgColor && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                color: 'text.secondary',
                pointerEvents: 'none',
              }}
            >
              <AddPhotoAlternateIcon sx={{ fontSize: 36, opacity: 0.5 }} />
              <Typography variant="body2">添加图片开始合成</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </ToolWorkbench>
  );
}