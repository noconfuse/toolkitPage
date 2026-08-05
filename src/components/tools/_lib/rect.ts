// 共用矩形工具：所有坐标都是「左上角 + 宽高」(Top-Left origin)
// 不依赖 rotation —— 旋转相关的工具留在各自业务的 _lib/transform.ts

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Corner = 'tl' | 'tr' | 'br' | 'bl';

// 矩形 4 个角（左上角坐标 + 宽高）
export function cornersOfRect(rect: Rect): Record<Corner, Point> {
  return {
    tl: { x: rect.x, y: rect.y },
    tr: { x: rect.x + rect.w, y: rect.y },
    br: { x: rect.x + rect.w, y: rect.y + rect.h },
    bl: { x: rect.x, y: rect.y + rect.h },
  };
}

// 矩形中心
export function centerOf(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

// 把矩形完整锁在画布内（拖动边界）
export function clampRectInside(rect: Rect, canvasW: number, canvasH: number): Rect {
  let { x, y } = rect;
  const { w, h } = rect;
  if (x < 0) x = 0;
  else if (x + w > canvasW) x = canvasW - w;
  if (y < 0) y = 0;
  else if (y + h > canvasH) y = canvasH - h;
  return { x, y, w, h };
}

// 命中点在手柄上（手柄在图片外侧 6px，命中半径 10px）
export function pickCornerAt(
  sx: number,
  sy: number,
  rect: Rect,
  hitRadius = 10,
): Corner | null {
  const off = -6;
  const hit = (cx: number, cy: number) =>
    Math.abs(sx - cx) <= hitRadius && Math.abs(sy - cy) <= hitRadius;
  if (hit(rect.x + off, rect.y + off)) return 'tl';
  if (hit(rect.x + rect.w - off, rect.y + off)) return 'tr';
  if (hit(rect.x + off, rect.y + rect.h - off)) return 'bl';
  if (hit(rect.x + rect.w - off, rect.y + rect.h - off)) return 'br';
  return null;
}

// 命中点在矩形内
export function pointInRect(sx: number, sy: number, rect: Rect): boolean {
  return sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h;
}