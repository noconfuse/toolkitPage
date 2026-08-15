'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// 通用"前后对比"组件：左右拖动分割线比对待处理原图与处理结果。
// - original / result 都要传 URL（blob: / data: / http: 都行），缺一不可时退化为只显示已就绪那一边。
// - resultCheckerboard=true 时，下方 result 容器显示棋盘格背景（用于透明 PNG）。
// - 尺寸：默认填满父容器宽度，按图片自然尺寸比 (aspect-ratio) 自适应高度。
// - 初始分割线位置 50%。
// - 鼠标 + 触摸都支持：水平拖动分割线。

export interface BeforeAfterCompareProps {
  originalUrl: string | null;
  resultUrl: string | null;
  /** 处理前的标题，默认"原图" */
  originalLabel?: string;
  /** 处理后的标题，默认"处理结果" */
  resultLabel?: string;
  /** result 容器是否用棋盘格背景（用于透明 PNG） */
  resultCheckerboard?: boolean;
}

export function BeforeAfterCompare({
  originalUrl,
  resultUrl,
  originalLabel = '原图',
  resultLabel = '处理结果',
  resultCheckerboard = false,
}: BeforeAfterCompareProps) {
  const hasOriginal = !!originalUrl;
  const hasResult = !!resultUrl;

  // 哪一边是"原图"通过分割线对比显示
  // - 只有原图：原图整张显示
  // - 只有结果：结果整张显示
  // - 两边都有：拖分割线对比
  const showSlider = hasOriginal && hasResult;

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = React.useState(50); // 0~100
  const [dragging, setDragging] = React.useState(false);

  // 源图自然尺寸用于 aspect-ratio（配合 maxHeight 限制竖图高度）
  const [origSize, setOrigSize] = React.useState<{ w: number; h: number } | null>(null);
  const [resSize, setResSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    if (!originalUrl) { setOrigSize(null); return; }
    const img = new Image();
    img.onload = () => setOrigSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = originalUrl;
  }, [originalUrl]);

  React.useEffect(() => {
    if (!resultUrl) { setResSize(null); return; }
    const img = new Image();
    img.onload = () => setResSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = resultUrl;
  }, [resultUrl]);

  // 取两边中较大的宽高比
  const aspect = React.useMemo(() => {
    const a = origSize ? origSize.w / origSize.h : null;
    const b = resSize ? resSize.w / resSize.h : null;
    if (a && b) return Math.max(a, b);
    return a ?? b ?? 1;
  }, [origSize, resSize]);

  // 拖拽逻辑
  React.useEffect(() => {
    if (!dragging) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onMove = (clientX: number) => {
      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const r = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setRatio(r);
    };

    const onMouse = (e: MouseEvent) => onMove(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    };
    const onUp = () => setDragging(false);

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging]);

  const checkerboardBg =
    'repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 50% / 16px 16px';

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2">{originalLabel}</Typography>
        <Typography variant="subtitle2">{resultLabel}</Typography>
      </Box>

      <Box
        ref={wrapRef}
        sx={{
          position: 'relative',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          width: '100%',
          aspectRatio: aspect,
          // maxHeight 限制容器高度：竖图不再无限撑高。
          // CSS 当 maxHeight 与 aspectRatio 冲突时 maxHeight 优先，
          // 高度被限制在480px，宽度按比例收缩，图片 object-fit:contain 不变形。
          maxHeight: 480,
          background: '#fff',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* 原图：底层整张 */}
        {hasOriginal && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={originalUrl!}
              alt={originalLabel}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              draggable={false}
            />
          </Box>
        )}

        {/* 结果：上半 / 左侧 clip（仅在 split 模式） */}
        {resultUrl && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: resultCheckerboard ? checkerboardBg : 'transparent',
              clipPath: showSlider ? `inset(0 ${100 - ratio}% 0 0)` : 'none',
              pointerEvents: 'none',
            }}
          >
            <img
              src={resultUrl}
              alt={resultLabel}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              draggable={false}
            />
          </Box>
        )}

        {/* 分割线 + 拖拽手柄 */}
        {showSlider && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${ratio}%`,
                width: 2,
                transform: 'translateX(-1px)',
                bgcolor: 'common.white',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                pointerEvents: 'none',
              }}
            />
            <Box
              role="slider"
              aria-label="拖动以对比处理前后"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio)}
              tabIndex={0}
              onMouseDown={() => setDragging(true)}
              onTouchStart={() => setDragging(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setRatio((r) => Math.max(0, r - 2));
                if (e.key === 'ArrowRight') setRatio((r) => Math.min(100, r + 2));
              }}
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${ratio}%`,
                transform: 'translateX(-50%)',
                width: 28,
                cursor: 'ew-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 36,
                  borderRadius: 14,
                  bgcolor: 'common.white',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&::before': {
                    content: '""',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #555',
                    marginRight: 4,
                  },
                  '&::after': {
                    content: '""',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #555',
                    marginLeft: 4,
                  },
                }}
              />
            </Box>
          </>
        )}

        {/* 占位文案 */}
        {!hasOriginal && !hasResult && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">暂无图片</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
