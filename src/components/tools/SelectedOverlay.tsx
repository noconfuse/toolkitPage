'use client';

// 共用「选中层」视觉覆盖层：边框 + 4 角缩放手柄 + 顶部旋转手柄 + 删除按钮
// 输入为 canvas 坐标域（ImageCombine 用 1200×800，PdfStamp 用页面像素尺寸），
// 内部换算成百分比定位，手柄固定为屏幕像素（不随画布缩放变化）。

import Box from '@mui/material/Box';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  aabb,
  cornersOf,
  type Corner,
} from '@/tools/image/combine/_lib/transform';

const HANDLE_SIZE = 12;

export function SelectedOverlay({
  layer,
  bounds,
  onDelete,
}: {
  layer: { cx: number; cy: number; w: number; h: number; rotation: number };
  bounds: { w: number; h: number };
  onDelete: () => void;
}) {
  const cs = cornersOf(layer.cx, layer.cy, layer.w, layer.h, layer.rotation);
  const bb = aabb(layer.cx, layer.cy, layer.w, layer.h, layer.rotation);

  // 旋转手柄：旋转后的顶部中点，沿法线外移 24px
  const rotSin = Math.sin(layer.rotation);
  const rotCos = Math.cos(layer.rotation);
  const rotHandleX = layer.cx + (layer.h / 2) * rotSin - rotSin * 24;
  const rotHandleY = layer.cy - (layer.h / 2) * rotCos + rotCos * 24;

  // 把 canvas 坐标转屏幕 %
  const toPct = (x: number) => `${(x / bounds.w) * 100}%`;
  const toPctY = (y: number) => `${(y / bounds.h) * 100}%`;

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {/* 「图层右上角」的删除按钮：跟随图层位置，不跟随旋转（hit 区稳定） */}
      <Box
        data-delete
        data-overlay-control
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}
        sx={{
          position: 'absolute',
          left: toPct(bb.x + bb.w),
          top: toPctY(bb.y),
          width: 26,
          height: 26,
          transform: 'translate(50%, -50%)',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '50%',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          cursor: 'pointer',
          color: 'text.secondary',
          transition: 'all 160ms ease',
          zIndex: 2,
          '&:hover': {
            borderColor: 'error.main',
            color: 'error.main',
            transform: 'translate(50%, -50%) scale(1.08)',
          },
        }}
      >
        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
      </Box>
      {/* 边框 */}
      <Box
        sx={{
          position: 'absolute',
          left: toPct(bb.x),
          top: toPctY(bb.y),
          width: toPct(bb.w),
          height: toPctY(bb.h),
          border: '1px solid',
          borderColor: 'primary.main',
          pointerEvents: 'none',
        }}
      />

      {/* 4 个角点 */}
      {(['tl', 'tr', 'br', 'bl'] as Corner[]).map((k) => {
        const c = cs[k];
        return (
          <Box
            key={k}
            data-corner={k}
            data-overlay-control
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              left: toPct(c.x),
              top: toPctY(c.y),
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              transform: 'translate(-50%, -50%)',
              bgcolor: 'background.paper',
              border: '1.5px solid',
              borderColor: 'primary.main',
              borderRadius: 0.25,
              pointerEvents: 'auto',
              cursor:
                k === 'tl' || k === 'br' ? 'nwse-resize' : 'nesw-resize',
            }}
          />
        );
      })}

      {/* 顶部旋转手柄 */}
      <Box
        data-rotate
        data-overlay-control
        onMouseDown={(e) => e.stopPropagation()}
        sx={{
          position: 'absolute',
          left: toPct(rotHandleX),
          top: toPctY(rotHandleY),
          width: 10,
          height: 10,
          transform: 'translate(-50%, -50%)',
          bgcolor: 'background.paper',
          border: '1.5px solid',
          borderColor: 'primary.main',
          borderRadius: '50%',
          pointerEvents: 'auto',
          cursor: 'grab',
        }}
      />
    </Box>
  );
}
