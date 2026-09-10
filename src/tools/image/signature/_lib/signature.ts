// 电子签名核心库
//
// 签名全程在浏览器内完成：画板使用固定的「逻辑坐标系」（SIG_W × SIG_H，与设备分辨率无关），
// 笔迹以 Stroke 数组存储，导出时按内容包围盒自动裁边得到紧致的透明 PNG。
//
// 手机 ↔ 电脑的光学交接：手写笔迹简化 → 差分+varint 压缩 → base64 塞进二维码；
// 对端用摄像头识别后按原始参数重绘，视觉与来源一致（仅支持手写笔迹，不支持文字模式）。

export const SIG_W = 1000; // 逻辑画布宽度
export const SIG_H = 300; // 逻辑画布高度

export type Point = { x: number; y: number };

export type SignatureStroke = {
  points: Point[];
  lineWidth: number; // 逻辑像素，1..255
};

export type SigMode = 'draw' | 'type';

export type SignatureDraft = {
  strokes: SignatureStroke[];
  mode: SigMode;
  fontKey: string;
  typedText: string;
};

// 字体风格（与旧版一致）：文字模式用 fillText 渲染，找不到时自动回退系统字体
export const FONT_STYLES: ReadonlyArray<{ key: string; label: string; family: string }> = [
  { key: 'pen',      label: '原笔',   family: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' },
  { key: 'cursive',  label: '草书',   family: 'cursive' },
  { key: 'kaiti',    label: '行楷',   family: '"Kaiti SC", "STKaiti", KaiTi, "楷体", serif' },
  { key: 'lishu',    label: '隶书',   family: '"STLiti", "FangSong", "仿宋", Lisu, serif' },
  { key: 'fangsong', label: '仿宋',   family: '"STFangsong", "FangSong", "仿宋", serif' },
];

export const PEN_WIDTHS: ReadonlyArray<{ key: string; label: string; width: number }> = [
  { key: 'thin',   label: '细', width: 4 },
  { key: 'medium', label: '中', width: 7 },
  { key: 'bold',   label: '粗', width: 11 },
];

export const INK_COLOR = '#0f1f1d';

export function fontFamilyOf(fontKey: string): string {
  return (FONT_STYLES.find((f) => f.key === fontKey) ?? FONT_STYLES[0]).family;
}

export function lineWidthOf(penKey: string): number {
  return (PEN_WIDTHS.find((p) => p.key === penKey) ?? PEN_WIDTHS[1]).width;
}

/** 在画布上渲染一份签名草稿（先清空整幅，两种模式二选一；width/height 为逻辑空间尺寸） */
export function renderSignature(ctx: CanvasRenderingContext2D, draft: SignatureDraft, width: number, height: number): void {
  const { strokes, mode, fontKey, typedText } = draft;
  ctx.clearRect(0, 0, width, height);

  if (mode === 'type') {
    const text = typedText.trim();
    if (!text) return;
    // 字号自适应：先按高度给一个初值，超宽则等比缩小
    let size = Math.min(height * 0.72, 190);
    ctx.fillStyle = INK_COLOR;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `500 ${size}px ${fontFamilyOf(fontKey)}`;
    while (size > 24 && ctx.measureText(text).width > width * 0.9) {
      size *= 0.92;
      ctx.font = `500 ${size}px ${fontFamilyOf(fontKey)}`;
    }
    ctx.fillText(text, width / 2, height / 2);
    return;
  }

  ctx.strokeStyle = INK_COLOR;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    ctx.lineWidth = s.lineWidth;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x, s.points[i].y);
    }
    ctx.stroke();
  }
}

/** 按内容（alpha > threshold）包围盒裁掉透明留白，四周留 pad 像素 */
export function cropToContent(src: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const ctx = src.getContext('2d');
  if (!ctx) return src;
  const img = ctx.getImageData(0, 0, W, H);
  const data = img.data;
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (data[row + x * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src;

  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(W, maxX + pad + 1);
  const y1 = Math.min(H, maxY + pad + 1);
  const cw = x1 - x0;
  const ch = y1 - y0;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) return src;
  octx.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}

/** 把草稿渲染成带透明通道的紧致 PNG（按逻辑空间 width×height 渲染 + 自动裁边 + 16px 留白） */
export function renderCropPng(
  draft: SignatureDraft,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  const ctx = c.getContext('2d');
  if (!ctx) return { canvas: c, width: 0, height: 0 };
  renderSignature(ctx, draft, c.width, c.height);
  const cropped = cropToContent(c, 16);
  return { canvas: cropped, width: cropped.width, height: cropped.height };
}

// ───────── 光电交接编解码（手写笔迹 → 二维码载荷）─────────

const MAGIC = 'SKB1'; // 4 字节签名头

/** 写入 16-bit LE（首点坐标，逻辑空间 0..1000 需要用两个字节） */
function pushU16(buf: number[], v: number): void {
  buf.push(v & 0xff, (v >> 8) & 0xff);
}

/** 读取 16-bit LE */
function readU16(data: Uint8Array, p: { i: number }): number {
  const lo = data[p.i++];
  const hi = data[p.i++];
  return (lo | (hi << 8)) >>> 0;
}

/** 简单线化简：径向距离阈值抽稀（误差 < tol 的点丢弃） */
function simplify(points: Point[], tol: number): Point[] {
  if (points.length <= 2) return points.slice();
  const out: Point[] = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if ((p.x - last.x) * (p.x - last.x) + (p.y - last.y) * (p.y - last.y) >= tol * tol) {
      out.push(p);
      last = p;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** LEB128 unsigned */
function pushVarint(buf: number[], value: number): void {
  let v = value;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    buf.push(b);
  } while (v !== 0);
}

/** LEB128 unsigned 读取 */
function readVarint(data: Uint8Array, p: { i: number }): number {
  let result = 0;
  let shift = 0;
  while (p.i < data.length) {
    const b = data[p.i++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return result >>> 0;
}

/** 有符号 → 无符号（zigzag） */
function zz(v: number): number {
  return v >= 0 ? v * 2 : -v * 2 - 1;
}
function uzz(v: number): number {
  const r = Math.floor(v / 2);
  return v % 2 === 0 ? r : -r - 1;
}

/**
 * 把笔迹编码为 base64 载荷。自动加大抽稀阈值直到装进二维码容量。
 * width/height 为签名时的逻辑空间尺寸，对端按它渲染（保证跨端一致、不拉伸）。
 * 返回 null 表示过于复杂无法装下。
 */
export function encodeStrokes(
  strokes: SignatureStroke[],
  space: { width: number; height: number },
): string | null {
  const valid = strokes.filter((s) => s.points.length >= 2);
  if (valid.length === 0) return null;
  const width = Math.max(1, Math.min(65535, Math.round(space.width)));
  const height = Math.max(1, Math.min(65535, Math.round(space.height)));

  const toInt = (pts: Point[]): Point[] => pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

  for (const tol of [1, 2, 3.5, 5, 8]) {
    const buf: number[] = [];
    for (let i = 0; i < MAGIC.length; i++) buf.push(MAGIC.charCodeAt(i));
    pushU16(buf, width);
    pushU16(buf, height);
    buf.push(valid.length); // stroke 数量（≤255）

    let byteLen = buf.length;
    for (const s of valid) {
      const pts = simplify(s.points, tol);
      buf.push(Math.max(1, Math.min(255, Math.round(s.lineWidth))));
      // point 数量用 varint，最多 65535
      pushVarint(buf, pts.length);
      byteLen += pts.length; // 先估算
    }
    // 超出容量（base64≈payload×4/3），直接换更大容错前的粗阈值
    if (byteLen * 4 > 2400 * 3) continue;

    // 正式编码（差分 + zigzag varint）
    const out: number[] = [];
    for (let i = 0; i < MAGIC.length; i++) out.push(MAGIC.charCodeAt(i));
    pushU16(out, width);
    pushU16(out, height);
    out.push(valid.length);
    for (const s of valid) {
      const pts = toInt(simplify(s.points, tol));
      out.push(Math.max(1, Math.min(255, Math.round(s.lineWidth))));
      pushVarint(out, pts.length);
      pushU16(out, pts[0].x);
      pushU16(out, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        pushVarint(out, zz(dx));
        pushVarint(out, zz(dy));
      }
    }
    const bin = Uint8Array.from(out);
    let s = '';
    for (let i = 0; i < bin.length; i++) s += String.fromCharCode(bin[i]);
    const base64 = btoa(s);
    if (base64.length <= 2000) return base64;
    // 继续尝试更粗的抽稀
  }
  return null;
}

export type DecodedStrokes = {
  strokes: SignatureStroke[];
  width: number;
  height: number;
};

/** 解码扫码得到的 base64，返回笔迹与逻辑空间；非法返回 null */
export function decodeStrokes(base64: string): DecodedStrokes | null {
  try {
    const bin = atob(base64.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const p = { i: 0 };
    const readBuf = () => {
      const v = readVarint(bytes, p);
      return v;
    };
    if (bytes.length < 12) return null;
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC.charCodeAt(i)) return null;
    }
    p.i = MAGIC.length;
    const width = readU16(bytes, p);
    const height = readU16(bytes, p);
    const strokeCount = bytes[p.i++];
    const strokes: SignatureStroke[] = [];
    for (let n = 0; n < strokeCount; n++) {
      const lineWidth = bytes[p.i++];
      const count = readBuf();
      if (count < 2) continue;
      const points: Point[] = [];
      let x = readU16(bytes, p);
      let y = readU16(bytes, p);
      points.push({ x, y });
      for (let i = 1; i < count; i++) {
        x += uzz(readBuf());
        y += uzz(readBuf());
        points.push({ x, y });
      }
      strokes.push({ points, lineWidth });
    }
    return strokes.length > 0 ? { strokes, width, height } : null;
  } catch {
    return null;
  }
}