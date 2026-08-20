'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// 工具页面通用工作区骨架（所有工具页面统一使用）。
//
// 统一的布局约束（见 AGENTS.md）：
// ┌─ 外壳（可拖拽上传）────────────────────────────────────────┐
// │ ┌─ 左主区（flex:1，独立 padding）──────────┐┌─ 右栏（常驻）──┐ │
// │ │  工具标题 + 描述 ⓘ help 提示 ││  ① 配置属性面板（表单控件）│ │
// │ │  资源操作区（flex:1 占满剩余空间）       ││  ② 资源信息（大小/尺寸，处理前/后）│ │
// │ │  （画布 / 列表 / 空状态）                ││  ③ 工作流胶囊（需要时）│ │
// │ │  处理进度条（处理阶段）                  ││                  │ │
// │ │  功能按钮行（贴底）                      ││                  │ │
// │ └─────────────────────────────────────────┘└──────────────────┘ │
// └────────────────────────────────────────────────────────────────┘
//
// 左主区是 flex column：头部固定，资源操作区 flex:1 占满剩余空间，
// 进度条 + 功能按钮行（actions）固定在底部——内容不足一屏时按钮栏也贴在
// 底部，不会浮在页面中间。右栏常驻：无论是否上传内容都渲染（空状态显示
// "尚未上传资源"占位），左右两栏用竖向分割线隔开（移动端折叠为上下排列）。
// 左右两栏 padding 保持一致（用户要求：中间区域 padding 与侧边栏一致，不用太大）。
//
// 调用方只需传：
// - title / description：工具标题与描述（渲染在主区头部，替代页面内联标题）
// - hasContent：是否已上传（决定主区显示空状态还是 children）
// - children：左主区「资源操作区」内容
// - usage：主区头部右侧「使用说明 / 快捷键」help 提示（与标题/描述并排，常驻）
// - actions：左主区底部操作栏（处理进度条 + 功能按钮行，固定在内容区下方）
// - config：右栏「配置属性面板」（有才显示）
// - resource：右栏「资源信息」（大小与尺寸，处理前 / 后）
// - flow：右栏底部「工作流胶囊」（显眼）
// - emptyState / onPickFile / onDrop：空状态与拖拽上传

export interface ToolWorkbenchTip {
  icon: React.ReactNode;
  text: React.ReactNode;
}

export interface ToolWorkbenchProps {
  /** 工具标题（主区顶部） */
  title: string;
  /** 工具描述（标题下方，可选） */
  description?: string;
  /** 是否已上传：有内容时显示工作区，无内容时显示空状态 */
  hasContent: boolean;
  /** 左主区内容 */
  children: React.ReactNode;
  /** 主区头部右侧：使用说明 / 快捷键（与标题/描述并排，常驻） */
  usage?: React.ReactNode;
  /** 左主区底部操作栏：处理进度条 + 功能按钮行（固定在资源操作区下方贴底） */
  actions?: React.ReactNode;
  /** 侧边栏第一节：工具配置参数（有才显示） */
  config?: React.ReactNode;
  /** 侧边栏第二节：资源信息（大小与尺寸，处理前 / 后） */
  resource?: React.ReactNode;
  /** 侧边栏底部：工作流胶囊（显眼） */
  flow?: React.ReactNode;
  /**
   * 自定义空状态节点（点击 + 拖拽上传的 Dropzone）。
   * 缺省时渲染带 onPickFile 的内置 Dropzone。
   */
  emptyState?: React.ReactNode;
  /** 触发文件选择（点击 Dropzone 时调用） */
  onPickFile?: () => void;
  /** 拖拽上传处理 */
  onDrop?: (files: FileList | null) => void;
  /** 右栏宽度（默认 300） */
  sidebarWidth?: number;
}

// 跟去水印工具一致的对角线棋盘格背景（空状态 Dropzone 用；工具自定义空状态同样引用）
export const dropzoneBg = `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`;
export const dropzoneBgSize = '20px 20px';
export const dropzoneBgPos = '0 0, 0 10px, 10px -10px, 10px 0px';

// 左右两栏统一内边距（不用太大；移动端稍小）
const COLUMN_PAD = { px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } };

// 等比例撑满容器：给定内容宽高比，实时返回容器内可容纳的最大等比尺寸（contain-fit）。
// 用于画布 / 图片预览：资源操作区 flex:1 后，预览内容能自适应放大填满区域，而不是
// 固定小尺寸（如 maxHeight: 480）在中间留下大片空白。返回 [容器 ref, 尺寸]。
// - 容器：需要 flex:1 且内部用 alignItems/justifyContent: center 居中
// - 内容：width/height 取返回值，画布/遮罩层用 inset:0 + width/height:100% 贴合
export function useContainSize(
  ratioW: number,
  ratioH: number,
  enabled = true,
): [React.RefObject<HTMLDivElement | null>, { w: number; h: number } | null] {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || !enabled || ratioW <= 0 || ratioH <= 0) {
      setSize(null);
      return;
    }
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const s = Math.min(rect.width / ratioW, rect.height / ratioH);
      setSize({ w: Math.round(ratioW * s), h: Math.round(ratioH * s) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratioW, ratioH, enabled]);

  return [boxRef, size];
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function ToolWorkbench({
  title,
  description,
  hasContent,
  children,
  usage,
  actions,
  config,
  resource,
  flow,
  sidebarWidth = 300,
  emptyState,
  onPickFile,
  onDrop,
}: ToolWorkbenchProps) {
  // 拖拽高亮由组件自管理（enter/leave 计数法避免经过子元素时闪断）
  const [dragActive, setDragActive] = React.useState(false);
  const dragDepth = React.useRef(0);
  const showDrag = dragActive;

  // 整个外壳统一处理拖拽上传（enter/leave 用计数法，避免经过子元素时高亮闪断）
  const handleDragEnter = (e: React.DragEvent) => {
    if (!onDrop) return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      dragDepth.current += 1;
      setDragActive(true);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!onDrop) return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!onDrop) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    onDrop(e.dataTransfer.files);
  };

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        // 外壳是页根（flex column）的子项；自身再转成 flex column，把高度传给
        // 内部两栏容器（flex:1），侧边栏因此能随 borderLeft 竖线延伸到外壳底部。
        //
        // lg 起用「确定高度」把外壳钉死在视口内（视口 - 导航栏 56px，与
        // tools/layout 的 minHeight 一致）：
        //   - flex: none（flex-basis auto）→ 主尺寸完全由 height 属性决定。
        //     不能写 flex: 1：flex-basis: 0% 会参与百分比解析，auto 高度容器里
        //     会把 height 覆盖掉，高度退回内容驱动 → 大图把整页撑高、贴底 actions
        //     被顶出视口。
        //   - overflow: hidden → 硬性兜底，内部内容无论如何都不能把外壳撑高，
        //     超出的在内部被裁剪（需要滚动的工具各自带 overflowY:auto）。
        // 移动端保持 auto + visible：右栏折叠到左栏下方后随内容自然滚动。
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 1,
        flex: { xs: 1, lg: 'none' },
        minHeight: 0,
        height: { xs: 'auto', lg: 'calc(100vh - 56px)' },
        overflow: { xs: 'visible', lg: 'hidden' },
        outline: showDrag ? '2px dashed' : '2px dashed transparent',
        outlineColor: showDrag ? 'primary.main' : 'transparent',
        outlineOffset: showDrag ? -2 : 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: 'stretch',
        }}
      >
        {/* ───────── 左主区：头部（标题/描述 + help tooltip）→ 资源操作区 → 进度条+功能按钮 ───────── */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            ...COLUMN_PAD,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 2,
              mb: 2.5,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: 24, md: 32 },
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  mb: 1,
                }}
              >
                {title}
              </Typography>

              {description && (
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              )}
            </Box>

            {/* 使用说明 / 快捷键：悬停 info 图标弹出 tooltip，不占主区宽度 */}
            {usage && (
              <Tooltip
                title={<Box sx={{ maxWidth: 380 }}>{usage}</Box>}
                placement="bottom-end"
                arrow
                slotProps={{
                  // 与网站底色一致（暖白），箭头颜色跟随 tooltip 背景，
                  // 避免默认深灰箭头与内容背景不一致。
                  tooltip: {
                    sx: {
                      maxWidth: 420,
                      p: 1.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                      color: 'text.primary',
                      boxShadow: 3,
                      fontSize: 12,
                    },
                  },
                  arrow: { sx: { color: 'background.default' } },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-label="使用说明与快捷键"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    mt: 0.25,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'transparent',
                    color: 'text.secondary',
                    cursor: 'pointer',
                    transition: 'color 160ms ease',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 18 }} />
                </Box>
              </Tooltip>
            )}
          </Box>

          {/* 资源操作区：flex:1 占满左栏剩余空间，功能按钮行因此始终贴底 */}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {!hasContent ? (
              emptyState ? (
                emptyState
              ) : (
                <DefaultDropzone onPickFile={onPickFile} />
              )
            ) : (
              children
            )}
          </Box>

          {/* 处理进度条 + 功能按钮栏：固定在底部（不随内容不足而上浮） */}
          {actions && <Box sx={{ mt: 2.5, flexShrink: 0 }}>{actions}</Box>}
        </Box>

        {/* ───────── 右栏：常驻。配置属性面板 → 资源信息 → 工作流 ───────── */}
        <Box
          sx={{
            width: { xs: '100%', lg: sidebarWidth },
            flexShrink: 0,
            // 左右分割线：桌面端竖线，移动端折叠为顶部横线。
            // 不能用 border shorthand 的响应式写法（断点下会把 border-color 重置为
            // currentColor，导致颜色不透明且与全局 divider 不一致），
            // 需分开指定 width / style / color。
            borderLeftWidth: { xs: 0, lg: 1 },
            borderTopWidth: { xs: 1, lg: 0 },
            // borderStyle/borderColor 会应用到四边，若不显式把其余两边宽度置 0，
            // CSS 默认取 medium(3px)，侧边栏底部/右侧会出现 3px 的 divider 描边。
            borderRightWidth: 0,
            borderBottomWidth: 0,
            borderStyle: 'solid',
            borderColor: 'divider',
            ...COLUMN_PAD,
          }}
        >
          {config || resource || flow ? (
            <>
              {/* 首个可见区块不加顶部分割线，其余区块用细分隔线隔开 */}
              {[config, resource, flow]
                .filter(Boolean)
                .map((node, i) =>
                  i === 0 ? (
                    <Box key={i}>{node}</Box>
                  ) : (
                    <SidebarSection key={i}>{node}</SidebarSection>
                  ),
                )}
            </>
          ) : (
            // 空状态占位：右栏常驻（边框线不消失），未上传时统一显示资源信息空态
            <Box>
              <SidebarTitle>资源信息</SidebarTitle>
              <SidebarResourceInfo data={{}} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// 侧边栏区块：与上一区块用细分割线隔开（说明 → 配置 → 资源 → 工作流）
function SidebarSection({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>{children}</Box>
  );
}

// 内置 Dropzone（空状态默认外观），调用方也可以绕过 ToolWorkbench 自己写
function DefaultDropzone({ onPickFile }: { onPickFile?: () => void }) {
  return (
    <Box
      onClick={() => onPickFile?.()}
      sx={{
        width: '100%',
        minHeight: 320,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: '#fafaf7',
        backgroundImage: dropzoneBg,
        backgroundSize: dropzoneBgSize,
        backgroundPosition: dropzoneBgPos,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        color: 'text.secondary',
        cursor: onPickFile ? 'pointer' : 'default',
      }}
    >
      <Typography variant="body2">点击或拖拽图片到此处</Typography>
    </Box>
  );
}

// 工具右栏小标题（几何字体 + overline）
export function SidebarTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{
        color: 'text.secondary',
        fontFamily: 'var(--font-geist-mono)',
        display: 'block',
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

// 使用说明 / 快捷键的提示卡（图标 + 文字）
export function TipCard({ icon, text }: ToolWorkbenchTip) {
  return (
    <Box
      sx={{
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'rgba(15,61,58,0.04)',
        px: 1.25,
        py: 1,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, mt: 0.25, display: 'flex' }}>
          {icon}
        </Box>
        <Typography variant="body2" sx={{ fontSize: 12, color: 'text.secondary' }}>
          {text}
        </Typography>
      </Stack>
    </Box>
  );
}

// ───────── 资源信息：大小 / 尺寸，处理前 → 处理后 ─────────
export type ResourceInfoData = {
  /** 资源名称（文件名，可选） */
  name?: string;
  /** 处理前（原图 / 原始文件） */
  before?: { size?: number; width?: number; height?: number };
  /** 处理后（结果） */
  after?: { size?: number; width?: number; height?: number };
  /** 附加信息行（如 张数 / 页数 / 格式） */
  extra?: { label: string; value: string }[];
};

export function SidebarResourceInfo({ data }: { data: ResourceInfoData }) {
  const { name, before, after, extra } = data;
  const hasDim =
    (before?.width && before?.height) || (after?.width && after?.height);
  const hasSize = before?.size != null || after?.size != null;
  if (!name && !hasDim && !hasSize && !extra?.length) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        尚未上传资源
      </Typography>
    );
  }

  const dims = (d?: { width?: number; height?: number }) =>
    d?.width && d?.height ? `${d.width} × ${d.height}` : null;
  const dimBefore = dims(before);
  const dimAfter = dims(after);
  const sizeBefore = before?.size != null ? formatBytes(before.size) : null;
  const sizeAfter = after?.size != null ? formatBytes(after.size) : null;

  return (
    <Stack spacing={0.75}>
      {name && (
        <InfoRow
          label="名称"
          value={name}
          valueSx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        />
      )}
      {hasDim && (
        <InfoRow
          label="尺寸"
          value={dimBefore && dimAfter ? `${dimBefore} → ${dimAfter}` : (dimBefore ?? dimAfter!)}
          mono
        />
      )}
      {hasSize && (
        <InfoRow
          label="大小"
          value={sizeBefore && sizeAfter ? `${sizeBefore} → ${sizeAfter}` : (sizeBefore ?? sizeAfter!)}
          mono
        />
      )}
      {extra?.map((e) => (
        <InfoRow key={e.label} label={e.label} value={e.value} mono />
      ))}
    </Stack>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  valueSx,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  valueSx?: Record<string, unknown>;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.primary',
          textAlign: 'right',
          ...(mono ? { fontFamily: 'var(--font-geist-mono)' } : null),
          ...valueSx,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

// 快捷键说明条目（key 键位胶囊 + 描述），与合成器 / PDF 贴图风格一致
export function ShortcutList({ items }: { items: { k: string; d: string }[] }) {
  return (
    <Stack spacing={0.75}>
      {items.map((h) => (
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
  );
}
