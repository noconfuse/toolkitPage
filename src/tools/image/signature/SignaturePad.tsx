'use client';

// 签名画板：受控组件，画布按逻辑坐标系渲染，pointer 事件换算为逻辑坐标交给外层。
// 外层持有笔迹 state（同时是光电交接的载荷），本组件只负责绘制与事件采集。

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
    renderSignature(ctx, { strokes, mode, fontKey, typedText });
  }, [strokes, mode, fontKey, typedText]);

  const toLogical = React.useCallback((e: React.PointerEvent): Point => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SIG_W, ((e.clientX - rect.left) / rect.width) * SIG_W)),
      y: Math.max(0, Math.min(SIG_H, ((e.clientY - rect.top) / rect.height) * SIG_H)),
    };
  }, []);

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
        width={SIG_W}
        height={SIG_H}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          aspectRatio: `${SIG_W} / ${SIG_H}`,
          cursor: penEnabled ? 'crosshair' : 'default',
          pointerEvents: penEnabled ? 'auto' : 'none',
          touchAction: 'none',
        }}
      />
    </Box>
  );
}