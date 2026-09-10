'use client';

// 签名画板：受控组件，画布按传入的逻辑空间（width×height）渲染，pointer 事件换算为
// 逻辑坐标交给外层。外层持有笔迹 state（同时是光电交接的载荷），本组件只负责绘制与事件采集。
// 画布 CSS 撑满父容器：父容器需与逻辑空间保持相同宽高比，避免拉伸变形。

import * as React from 'react';
import Box from '@mui/material/Box';
import {
  SIG_W,
  SIG_H,
  renderSignature,
  type Point,
  type SignatureStroke,
  type SignatureDraft,
} from './_lib/signature';

export type { SignatureStroke, SignatureDraft };

type SignaturePadProps = {
  strokes: SignatureStroke[];
  mode: 'draw' | 'type';
  fontKey: string;
  typedText: string;
  penEnabled: boolean; // 手写模式下才接受指针输入
  width?: number; // 逻辑空间宽，默认 SIG_W
  height?: number; // 逻辑空间高，默认 SIG_H
  onStrokeStart: (p: Point) => void;
  onStrokeMove: (p: Point) => void;
  onStrokeEnd: () => void;
};

export function SignaturePad({
  strokes,
  mode,
  fontKey,
  typedText,
  penEnabled,
  width = SIG_W,
  height = SIG_H,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // 状态即所见：任何输入变化都全量重绘画板
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = Math.max(1, Math.round(width));
    c.height = Math.max(1, Math.round(height));
    renderSignature(ctx, { strokes, mode, fontKey, typedText }, c.width, c.height);
  }, [strokes, mode, fontKey, typedText, width, height]);

  const toLogical = React.useCallback(
    (e: React.PointerEvent): Point => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(width, ((e.clientX - rect.left) / rect.width) * width)),
        y: Math.max(0, Math.min(height, ((e.clientY - rect.top) / rect.height) * height)),
      };
    },
    [width, height],
  );

  const onDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (!penEnabled) return;
      e.preventDefault();
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      onStrokeStart(toLogical(e));
    },
    [penEnabled, onStrokeStart, toLogical],
  );

  const onMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!penEnabled) return;
      onStrokeMove(toLogical(e));
    },
    [penEnabled, onStrokeMove, toLogical],
  );

  const onUp = React.useCallback(() => onStrokeEnd(), [onStrokeEnd]);

  return (
    <Box>
      <canvas
        ref={canvasRef}
        width={Math.max(1, Math.round(width))}
        height={Math.max(1, Math.round(height))}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: penEnabled ? 'crosshair' : 'default',
          pointerEvents: penEnabled ? 'auto' : 'none',
          touchAction: 'none',
        }}
      />
    </Box>
  );
}