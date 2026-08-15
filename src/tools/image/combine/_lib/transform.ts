// 几何 / 变换工具
// 所有坐标都基于"画布未旋转的本地坐标系"（layer 的 w/h 决定了它的本地矩形）

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

// 默认画布尺寸（无底图时使用）。有底图/纯色背景时，会被动态调整为底图尺寸。
export const CANVAS_W = 1200;
export const CANVAS_H = 800;

// ───────── 旋转矩形 8 角 ─────────
// 中心 (cx, cy)，宽 w，高 h，旋转 rad
export function cornersOf(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number,
): Record<Corner, Point> {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = w / 2;
  const dy = h / 2;
  const localCorners: Record<Corner, Point> = {
    tl: { x: -dx, y: -dy },
    tr: { x: dx, y: -dy },
    br: { x: dx, y: dy },
    bl: { x: -dx, y: dy },
  };
  const out: Record<Corner, Point> = { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } };
  for (const k of Object.keys(localCorners) as Corner[]) {
    const p = localCorners[k];
    out[k] = {
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos,
    };
  }
  return out;
}

// AABB 包围盒（用于手柄定位）
export function aabb(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number,
): Rect {
  const cs = cornersOf(cx, cy, w, h, rotation);
  const xs = [cs.tl.x, cs.tr.x, cs.br.x, cs.bl.x];
  const ys = [cs.tl.y, cs.tr.y, cs.br.y, cs.bl.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// 约束在画布内的 AABB（让旋转后的矩形完整落在画布里）
// bounds 可传入自定义画布尺寸（PDF 贴图用页面像素尺寸）
export function clampInside(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number,
  bounds: Bounds = { w: CANVAS_W, h: CANVAS_H },
): { cx: number; cy: number } {
  const bb = aabb(cx, cy, w, h, rotation);
  let dx = 0;
  let dy = 0;
  if (bb.x < 0) dx = -bb.x;
  else if (bb.x + bb.w > bounds.w) dx = bounds.w - (bb.x + bb.w);
  if (bb.y < 0) dy = -bb.y;
  else if (bb.y + bb.h > bounds.h) dy = bounds.h - (bb.y + bb.h);
  return { cx: cx + dx, cy: cy + dy };
}

// 反向旋转点：世界坐标 → 图层本地坐标
// 正旋转：x' = cx + dx·cos - dy·sin;  y' = cy + dx·sin + dy·cos
// 逆旋转：x  = cx + dx·cos + dy·sin;  y  = cy - dx·sin + dy·cos
export function inverseRotate(
  p: Point,
  cx: number,
  cy: number,
  rotation: number,
): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * cos + dy * sin,
    y: cy - dx * sin + dy * cos,
  };
}

// 在屏幕坐标上选角点（hit-test）
export function pickCorner(
  p: Point,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number,
  hitSize: number,
): Corner | null {
  const cs = cornersOf(cx, cy, w, h, rotation);
  for (const k of ['tl', 'tr', 'br', 'bl'] as Corner[]) {
    const c = cs[k];
    if (Math.abs(p.x - c.x) <= hitSize && Math.abs(p.y - c.y) <= hitSize) {
      return k;
    }
  }
  return null;
}

// 命中点在旋转矩形内（外接矩形快速判定，足够 UI 用）
export function hitInside(
  p: Point,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number,
): boolean {
  const local = inverseRotate(p, cx, cy, rotation);
  return (
    local.x >= cx - w / 2 &&
    local.x <= cx + w / 2 &&
    local.y >= cy - h / 2 &&
    local.y <= cy + h / 2
  );
}

// ───────── 拖动计算（ImageCombine 与 PdfStamp 共用，保证行为完全一致） ─────────

export type Bounds = { w: number; h: number };

export type ResizeStart = {
  startCx: number;
  startCy: number;
  startW: number;
  startH: number;
  startRotation: number;
};

export type MoveStart = { offsetX: number; offsetY: number };

export type RotateStart = { startAngle: number; startRotation: number; center: Point };

// 移动：鼠标位置 - 起始偏移，约束在 bounds 内
export function computeMove(
  start: MoveStart,
  p: Point,
  w: number,
  h: number,
  rotation: number,
  bounds: Bounds,
): { cx: number; cy: number } {
  return clampInside(p.x - start.offsetX, p.y - start.offsetY, w, h, rotation, bounds);
}

// 中心锚定等比缩放：把鼠标点逆旋转到层本地坐标，
// 用「鼠标到中心的距离 / 角点到中心的距离」作为统一比例，
// w/h 乘同一比例 → 原图比例不变、中心完全不动
export function computeResize(
  start: ResizeStart,
  p: Point,
  bounds: Bounds,
): { w: number; h: number } {
  const localP = inverseRotate(p, start.startCx, start.startCy, start.startRotation);
  const d0 = Math.hypot(start.startW / 2, start.startH / 2); // 角点到中心距离
  const d1 = Math.hypot(localP.x - start.startCx, localP.y - start.startCy); // 鼠标到中心距离
  const minRatio = Math.max(20 / start.startW, 20 / start.startH); // 最小尺寸（整体等比）
  // 最大尺寸：AABB 恰好不超出画布 → 中心不动也能停住
  const absSin = Math.abs(Math.sin(start.startRotation));
  const absCos = Math.abs(Math.cos(start.startRotation));
  const maxRatio = Math.min(
    (2 * Math.min(start.startCx, bounds.w - start.startCx)) /
      (start.startW * absCos + start.startH * absSin),
    (2 * Math.min(start.startCy, bounds.h - start.startCy)) /
      (start.startW * absSin + start.startH * absCos),
  );
  const ratio = Math.min(Math.max(d1 / d0, minRatio), Math.max(maxRatio, minRatio));
  return { w: start.startW * ratio, h: start.startH * ratio }; // 中心不变
}

// 旋转：鼠标相对中心的夹角增量 → 新旋转角，约束中心在 bounds 内
export function computeRotate(
  start: RotateStart,
  p: Point,
  w: number,
  h: number,
  bounds: Bounds,
): { rotation: number; cx: number; cy: number } {
  const currentAngle = Math.atan2(p.y - start.center.y, p.x - start.center.x);
  const rotation = start.startRotation + (currentAngle - start.startAngle);
  const fixed = clampInside(start.center.x, start.center.y, w, h, rotation, bounds);
  return { rotation, cx: fixed.cx, cy: fixed.cy };
}