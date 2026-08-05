// 共用「选中图层拖动 / 缩放 / 键盘」hook
// 输入屏幕坐标，内部换算到 canvas 单位，输出仍然是 canvas 单位的 Rect。
// 不关心上层是 PDF 还是 canvas 图片——只要消费方能正确把 canvas 单位的 Rect 存到自己的 state。

import * as React from 'react';
import {
  type Corner,
  type Rect,
  centerOf,
  clampRectInside,
  pickCornerAt,
  pointInRect,
} from './_lib/rect';

type DragState =
  | { kind: 'none' }
  | { kind: 'move'; startSx: number; startSy: number; startRect: Rect }
  | {
      kind: 'resize';
      corner: Corner;
      startSx: number;
      startSy: number;
      startRect: Rect;
      // 用于等比缩放的「起始 w/h」；非等比时等同 startRect.w/h
      aspectRatio: number;
    };

export type UseLayerDragOptions = {
  /** 绑 mousedown 的容器 */
  surfaceRef: React.RefObject<HTMLElement | null>;
  /** 画布尺寸（canvas 单位），用于边界 clamp 和最大缩放 */
  bounds: { w: number; h: number };
  /** 当前 rect（canvas 单位，左上角 + 宽高）。null 时 hook 不接管 */
  rect: Rect | null;
  /** 写入新 rect（canvas 单位）。返回 falsy 值表示忽略（边界外） */
  setRect: (r: Rect) => void;
  /** 等比缩放基准（w/h）。undefined = 自由缩放（按角点独立调 w/h） */
  aspectRatio?: number;
  /** 启用 Delete/方向键 快捷键 */
  enableKeyboard?: boolean;
  /** Delete/Backspace 时回调 */
  onDelete?: () => void;
  /** 整体开关；false 时不接管 mousedown / 键盘 */
  enabled?: boolean;
};

export function useLayerDrag(opts: UseLayerDragOptions) {
  const {
    surfaceRef,
    bounds,
    rect,
    setRect,
    aspectRatio,
    enableKeyboard = false,
    onDelete,
    enabled = true,
  } = opts;
  const dragRef = React.useRef<DragState>({ kind: 'none' });
  const [dragging, setDragging] = React.useState(false);

  // 画布坐标内的矩形 → 屏幕坐标
  const rectToScreen = React.useCallback(
    (r: Rect, surfaceRect: DOMRect): Rect => {
      const sx = surfaceRect.left + (r.x / bounds.w) * surfaceRect.width;
      const sy = surfaceRect.top + (r.y / bounds.h) * surfaceRect.height;
      const sw = (r.w / bounds.w) * surfaceRect.width;
      const sh = (r.h / bounds.h) * surfaceRect.height;
      return { x: sx, y: sy, w: sw, h: sh };
    },
    [bounds.w, bounds.h],
  );

  const onSurfaceMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || !rect) return;
      const surface = surfaceRef.current;
      if (!surface) return;
      const sr = surface.getBoundingClientRect();
      const sx = e.clientX - sr.left;
      const sy = e.clientY - sr.top;
      const screenRect = rectToScreen(rect, sr);

      const corner = pickCornerAt(sx, sy, screenRect, 14);
      if (corner) {
        dragRef.current = {
          kind: 'resize',
          corner,
          startSx: sx,
          startSy: sy,
          startRect: { ...rect },
          aspectRatio: aspectRatio ?? rect.w / Math.max(rect.h, 0.001),
        };
        setDragging(true);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (pointInRect(sx, sy, screenRect)) {
        dragRef.current = {
          kind: 'move',
          startSx: sx,
          startSy: sy,
          startRect: { ...rect },
        };
        setDragging(true);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [enabled, rect, rectToScreen, surfaceRef, aspectRatio],
  );

  // 鼠标移动 → 计算新 rect → setRect
  React.useEffect(() => {
    if (dragRef.current.kind === 'none') return;
    const drag = dragRef.current;
    const onMove = (e: MouseEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const sr = surface.getBoundingClientRect();
      const sx = e.clientX - sr.left;
      const sy = e.clientY - sr.top;
      const dxScreen = sx - drag.startSx;
      const dyScreen = sy - drag.startSy;
      // 屏幕位移 → canvas 单位
      const dx = (dxScreen / sr.width) * bounds.w;
      const dy = (dyScreen / sr.height) * bounds.h;
      const orig = drag.startRect;
      const center = centerOf(orig);

      let next: Rect | null = null;

      if (drag.kind === 'move') {
        next = clampRectInside(
          { x: orig.x + dx, y: orig.y + dy, w: orig.w, h: orig.h },
          bounds.w,
          bounds.h,
        );
      } else if (drag.kind === 'resize') {
        const k = drag.corner;
        const ratio = drag.aspectRatio;
        if (ratio) {
          // 等比缩放：把鼠标点逆变换到以矩形中心为原点的坐标系，
          // 用「鼠标到中心的距离 / 角点到中心的距离」作为比例
          // （PDF 工具不需要旋转，简化为 axis-aligned）
          const cornerOffset: Record<Corner, { x: number; y: number }> = {
            tl: { x: -orig.w / 2, y: -orig.h / 2 },
            tr: { x: orig.w / 2, y: -orig.h / 2 },
            br: { x: orig.w / 2, y: orig.h / 2 },
            bl: { x: -orig.w / 2, y: orig.h / 2 },
          };
          const cornerLocal = cornerOffset[k];
          const mouseLocal = { x: dx + cornerLocal.x, y: dy + cornerLocal.y };
          // 距离符号（鼠标相对中心的方向决定缩放正向/反向）
          const signX = Math.sign(mouseLocal.x) || 1;
          const signY = Math.sign(mouseLocal.y) || 1;
          const m0 = Math.hypot(cornerLocal.x, cornerLocal.y); // 角点到中心
          const m1 = Math.hypot(mouseLocal.x, mouseLocal.y); // 鼠标到中心
          let s = m1 / Math.max(m0, 0.001);
          // 保持正向：让最终角点远离中心
          if (signX * signY < 0) s = -s;
          const newW = Math.max(10, orig.w * Math.abs(s));
          const newH = newW / ratio;

          // 中心锚定：w/h 变化时锚点角不变，对侧角点收缩/扩展
          // 找到拖动角点的对角（保持不动）
          const opposite: Record<Corner, Corner> = {
            tl: 'br', tr: 'bl', br: 'tl', bl: 'tr',
          };
          const opp = opposite[k];
          const oppositeOffset = cornerOffset[opp];
          const newCenter = {
            x: center.x + oppositeOffset.x + (signX * newW) / 2,
            y: center.y + oppositeOffset.y + (signY * newH) / 2,
          };
          next = {
            x: newCenter.x - newW / 2,
            y: newCenter.y - newH / 2,
            w: newW,
            h: newH,
          };
        } else {
          // 自由缩放：4 角独立调 w/h
          let { x, y, w, h } = orig;
          if (k === 'br') {
            w = Math.max(10, orig.w + dx);
            h = Math.max(10, orig.h + dy);
          } else if (k === 'bl') {
            w = Math.max(10, orig.w - dx);
            x = orig.x + dx;
            h = Math.max(10, orig.h + dy);
          } else if (k === 'tr') {
            w = Math.max(10, orig.w + dx);
            h = Math.max(10, orig.h - dy);
            y = orig.y + dy;
          } else if (k === 'tl') {
            w = Math.max(10, orig.w - dx);
            x = orig.x + dx;
            h = Math.max(10, orig.h - dy);
            y = orig.y + dy;
          }
          next = { x, y, w, h };
        }
      }

      if (next) {
        // 缩放后再做一次边界 clamp（中心锚定可能让矩形超出画布）
        next = clampRectInside(next, bounds.w, bounds.h);
        setRect(next);
      }
    };

    const onUp = () => {
      dragRef.current = { kind: 'none' };
      setDragging(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [surfaceRef, bounds.w, bounds.h, setRect]);

  // 键盘
  React.useEffect(() => {
    if (!enableKeyboard || !enabled || !rect) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (onDelete) {
          e.preventDefault();
          onDelete();
        }
        return;
      }

      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let { x, y } = rect;
      const { w, h } = rect;
      if (e.key === 'ArrowUp') y -= step;
      if (e.key === 'ArrowDown') y += step;
      if (e.key === 'ArrowLeft') x -= step;
      if (e.key === 'ArrowRight') x += step;
      setRect(clampRectInside({ x, y, w, h }, bounds.w, bounds.h));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enableKeyboard, enabled, rect, onDelete, setRect, bounds.w, bounds.h]);

  return {
    onSurfaceMouseDown,
    dragging,
  };
}