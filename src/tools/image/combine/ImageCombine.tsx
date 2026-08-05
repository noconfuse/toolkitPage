'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  CANVAS_W,
  CANVAS_H,
  clampInside,
  computeMove,
  computeResize,
  computeRotate,
  hitInside,
  pickCorner,
  type Point,
} from './_lib/transform';
import { SelectedOverlay } from '@/components/tools/SelectedOverlay';

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
};

const MODE_PRESETS: ReadonlyArray<{
  v: CompositeMode;
  label: string;
  desc: string;
}> = [
  { v: 'source-over', label: '默认', desc: '直接盖在底图上' },
  { v: 'source-atop', label: '局部', desc: '只保留与底图重叠的部分' },
  { v: 'lighter', label: '加亮', desc: '颜色叠加变亮，适合光效' },
  { v: 'source-in', label: '剪贴', desc: '只显示落在底图内的部分' },
  { v: 'source-out', label: '反剪', desc: '只显示落在底图外的部分' },
  { v: 'destination-out', label: '擦除', desc: '擦掉底图被盖住的部分' },
  { v: 'xor', label: '互斥', desc: '重叠区域挖空透出底图' },
  { v: 'copy', label: '替换', desc: '替换掉整块底图' },
];

const HIT_SIZE = 12; // px，旋转后的屏幕坐标

export default function ImageCombine() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const baseFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const overlayFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);

  const [baseImg, setBaseImg] = React.useState<HTMLImageElement | null>(null);
  const [baseName, setBaseName] = React.useState<string | null>(null);
  const [layers, setLayers] = React.useState<Layer[]>([]);
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

  // ───────── 重绘 ─────────
  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (baseImg) {
      const r = Math.min(CANVAS_W / baseImg.width, CANVAS_H / baseImg.height);
      const w = baseImg.width * r;
      const h = baseImg.height * r;
      const x = (CANVAS_W - w) / 2;
      const y = (CANVAS_H - h) / 2;
      ctx.drawImage(baseImg, x, y, w, h);
    }

    for (const layer of layers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.mode;
      ctx.translate(layer.cx, layer.cy);
      ctx.rotate(layer.rotation);
      ctx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
      ctx.restore();
    }
  }, [baseImg, layers]);

  React.useEffect(() => {
    render();
  }, [render]);

  // ───────── 屏幕 ↔ canvas 坐标转换 ─────────
  const screenToCanvas = React.useCallback(
    (sx: number, sy: number): Point | null => {
      const el = surfaceRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = ((sx - rect.left) / rect.width) * CANVAS_W;
      const y = ((sy - rect.top) / rect.height) * CANVAS_H;
      return { x, y };
    },
    [],
  );

  // 暴露 scale 给覆盖层用
  React.useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / CANVAS_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // ───────── 底图 ─────────
  const handleBaseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = await readImage(file);
    setBaseImg(img);
    setBaseName(file.name);
    setLayers([]);
    setSelectedId(null);
    e.target.value = '';
  };

  // ───────── 加叠加层 ─────────
  const handleOverlayFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!baseImg) return;
    const img = await readImage(file);
    // 默认 contain 到画布的 60%，居中
    const ratio = Math.min(
      (CANVAS_W * 0.6) / img.width,
      (CANVAS_H * 0.6) / img.height,
    );
    const w = img.width * ratio;
    const h = img.height * ratio;
    const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const layer: Layer = {
      id,
      img,
      cx: CANVAS_W / 2,
      cy: CANVAS_H / 2,
      w,
      h,
      rotation: 0,
      opacity: 1,
      mode: 'source-over',
      name: file.name,
    };
    setLayers((prev) => [...prev, layer]);
    setSelectedId(id);
    e.target.value = '';
  };

  // ───────── 选中 ─────────
  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;

  // ───────── 鼠标按下 ─────────
  const onSurfaceMouseDown = (e: React.MouseEvent) => {
    // 如果点在覆盖层控件上（删除按钮 / 角点 / 旋转柄），让它们自己处理
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-overlay-control]')) {
      return;
    }
    const p = screenToCanvas(e.clientX, e.clientY);
    if (!p) return;

    // 1) 如果有选中层，先检查是否点在角点 / 旋转柄 / 内部
    if (selectedLayer) {
      // 角点
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
        return;
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
        return;
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
        return;
      }
    }

    // 2) 点中其他 layer（按 z-order 从顶到底）→ 选中
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
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== dragState.layerId) return l;
          if (dragState.kind === 'move') {
            const c = computeMove(dragState, p, l.w, l.h, l.rotation, { w: CANVAS_W, h: CANVAS_H });
            return { ...l, cx: c.cx, cy: c.cy };
          }
          if (dragState.kind === 'resize') {
            const s = computeResize(dragState, p, { w: CANVAS_W, h: CANVAS_H });
            return { ...l, w: s.w, h: s.h }; // 中心不变
          }
          if (dragState.kind === 'rotate') {
            const r = computeRotate(dragState, p, l.w, l.h, { w: CANVAS_W, h: CANVAS_H });
            return { ...l, rotation: r.rotation, cx: r.cx, cy: r.cy };
          }
          return l;
        }),
      );
    };

    const onUp = () => setDragState({ kind: 'none' });

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, screenToCanvas, scale]);

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

  const moveLayer = (id: string, dir: 'up' | 'down') => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
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
  const handleDownload = () => {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png', 1);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `合成图-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleClear = () => {
    setBaseImg(null);
    setBaseName(null);
    setLayers([]);
    setSelectedId(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      {/* ───────── 画布 + 覆盖层 + 下方按钮 ───────── */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Box
          ref={surfaceRef}
          onMouseDown={onSurfaceMouseDown}
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: '#fafaf7',
            backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`,
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
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              backgroundColor: '#fafaf7',
            }}
          />

          {/* 选中层覆盖层 */}
          {selectedLayer && (
            <SelectedOverlay
              layer={selectedLayer}
              bounds={{ w: CANVAS_W, h: CANVAS_H }}
              onDelete={() => deleteLayer(selectedLayer.id)}
            />
          )}

          {/* 空底图占位 */}
          {!baseImg && (
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
              <Typography variant="body2">上传第一张图作为底图</Typography>
            </Box>
          )}
        </Box>

        {/* 按钮行 */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            mt: 1.5,
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
          >
            {baseImg ? '换底图' : '上传底图'}
            <input
              ref={baseFileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleBaseFile}
            />
          </Button>

          <Tooltip
            title={baseImg ? '在画布上添加新的一层' : '请先上传底图'}
            placement="top"
          >
            <span>
              <Button
                variant="outlined"
                size="small"
                component="label"
                disabled={!baseImg}
                startIcon={<AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
              >
                叠加图片
                <input
                  ref={overlayFileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleOverlayFile}
                />
              </Button>
            </span>
          </Tooltip>

          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
            onClick={handleDownload}
            disabled={!baseImg}
          >
            下载
          </Button>

          <Button
            variant="text"
            color="inherit"
            size="small"
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            onClick={handleClear}
            disabled={!baseImg}
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
            {baseImg
              ? `${baseName ?? ''} · ${layers.length} 个叠加层`
              : `${CANVAS_W} × ${CANVAS_H}`}
          </Typography>
        </Stack>
      </Box>

      {/* ───────── 右栏：叠加层列表 + 选中层属性 ───────── */}
      <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
            fontFamily: 'var(--font-geist-mono)',
            display: 'block',
            mb: 1.5,
          }}
        >
          叠加层 · {layers.length}
        </Typography>

        {layers.length === 0 ? (
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{ py: 2, fontSize: 13 }}
          >
            还没有叠加层
          </Typography>
        ) : (
          <Stack
            divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}
          >
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
                      sx={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: 10,
                      }}
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

        {/* 选中层属性 */}
        {selectedLayer && (
          <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontFamily: 'var(--font-geist-mono)',
                display: 'block',
                mb: 2,
              }}
            >
              选中层
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}
              >
                合成方式
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ flexWrap: 'wrap', gap: 0.5 }}
              >
                {MODE_PRESETS.map((m) => {
                  const active = selectedLayer.mode === m.v;
                  return (
                    <Tooltip
                      key={m.v}
                      title={m.desc}
                      placement="top"
                    >
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
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block' }}
              >
                不透明度 · {Math.round(selectedLayer.opacity * 100)}%
              </Typography>
              <Slider
                size="small"
                value={selectedLayer.opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(_, v) =>
                  updateLayer(selectedLayer.id, { opacity: v as number })
                }
                sx={{ mt: 0.5 }}
              />
            </Box>

            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block' }}
              >
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
          </Box>
        )}

        {/* 快捷键 + 提示 */}
        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              fontFamily: 'var(--font-geist-mono)',
              display: 'block',
              mb: 1.5,
            }}
          >
            快捷键
          </Typography>
          <Stack spacing={0.75}>
            {[
              { k: '↑↓←→', d: '微调位置' },
              { k: 'Shift + 方向键', d: '大步移动' },
              { k: 'Delete', d: '删除选中层' },
              { k: 'Esc', d: '取消选中' },
            ].map((h) => (
              <Box
                key={h.k}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                }}
              >
                <Box
                  sx={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 10,
                    color: 'text.secondary',
                    bgcolor: 'rgba(15, 31, 29, 0.05)',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.5,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  {h.k}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {h.d}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}