'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

// 工具页面通用工作区骨架。
//
// 视觉构成（与去水印 / 去背景工具一致）：
// ┌─ 整个外壳（可拖拽上传）────────────────────────────┐
// │  ┌─ 空状态（未上传）：大块 dropzone ──┐            │
// │  │  提示文案 + 选择图片按钮 + 隐私文案  │            │
// │  └────────────────────────────────────┘            │
// │  或                                                 │
// │  ┌─ 左主区（flex:1）──────┐┌─ 右栏 sidebarWidth ──┐  │
// │  │  children              ││  sidebar / tips        │  │
// │  │  （画布 / 进度 / 工具栏）││  （表单 / 卡片列表）    │  │
// │  └────────────────────────┘└────────────────────┘  │
// └────────────────────────────────────────────────────┘
//
// 调用方只需传：
// - hasContent：当前是否已上传图片（决定显示空状态还是工作区）
// - children：左主区内容
// - sidebar：右栏自由内容（表单 / 任意 ReactNode）
// - tips：右栏使用说明条目（图标 + 文字）。与 sidebar 二选一；不传则不渲染右栏
// - sidebarTitle：右栏标题（仅 tips 模式生效）
// - sidebarWidth：右栏宽度（默认 300）
// - emptyState：自定义空状态（缺省用内置 Dropzone）
// - onDrop / dragOver：可选拖拽上传

export interface ToolWorkbenchTip {
  icon: React.ReactNode;
  text: React.ReactNode;
}

export interface ToolWorkbenchProps {
  /** 是否已上传：有内容时显示工作区，无内容时显示空状态 */
  hasContent: boolean;
  /** 左主区内容 */
  children: React.ReactNode;
  /** 右栏自由内容（表单 / 任意 ReactNode）。与 tips 互斥 */
  sidebar?: React.ReactNode;
  /** 右栏使用说明条目（图标 + 文字）。与 sidebar 互斥 */
  tips?: ToolWorkbenchTip[];
  /** 右栏标题（仅 tips 模式生效），默认"使用说明" */
  tipsTitle?: string;
  /** 右栏宽度（默认 300） */
  sidebarWidth?: number;
  /**
   * 自定义空状态节点（点击 + 拖拽上传的 Dropzone）。
   * 缺省时渲染带 onPickFile 的内置 Dropzone。
   */
  emptyState?: React.ReactNode;
  /** 触发文件选择（点击 Dropzone 时调用） */
  onPickFile?: () => void;
  /** 拖拽上传处理 */
  onDrop?: (files: FileList | null) => void;
  /** 是否处于拖拽悬停态（控制外框虚线高亮） */
  dragOver?: boolean;
}

// 跟去水印工具一致的对角线棋盘格背景（空状态 Dropzone 用）
const dropzoneBg = `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`;
const dropzoneBgSize = '20px 20px';
const dropzoneBgPos = '0 0, 0 10px, 10px -10px, 10px 0px';

export function ToolWorkbench({
  hasContent,
  children,
  sidebar,
  tips,
  tipsTitle = '使用说明',
  sidebarWidth = 300,
  emptyState,
  onPickFile,
  onDrop,
  dragOver = false,
}: ToolWorkbenchProps) {
  // 拖拽高亮由组件自管理（所有工具统一，无需各自维护 dragOver 状态）；
  // dragOver prop 仅作外部强制覆盖（传 true 时恒亮）。
  const [dragActive, setDragActive] = React.useState(false);
  const dragDepth = React.useRef(0);
  const showDrag = dragOver ?? dragActive;

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

  const hasSidebar = !!sidebar || (tips && tips.length > 0);

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        borderRadius: 1,
        outline: showDrag ? '2px dashed' : '2px dashed transparent',
        outlineColor: showDrag ? 'primary.main' : 'transparent',
        outlineOffset: showDrag ? -2 : 0,
      }}
    >
      {!hasContent ? (
        emptyState ? (
          emptyState
        ) : (
          <DefaultDropzone onPickFile={onPickFile} />
        )
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 2,
            alignItems: 'flex-start',
          }}
        >
          {/* 左主区 */}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>{children}</Box>

          {/* 右栏：sidebar 模式 / tips 模式 */}
          {hasSidebar && (
            <Box sx={{ width: { xs: '100%', lg: sidebarWidth }, flexShrink: 0 }}>
              {sidebar ? (
                sidebar
              ) : (
                <>
                  <Typography
                    variant="overline"
                    sx={{
                      color: 'text.secondary',
                      fontFamily: 'var(--font-geist-mono)',
                      display: 'block',
                      mb: 1.5,
                    }}
                  >
                    {tipsTitle}
                  </Typography>
                  <Stack spacing={2.25}>
                    {tips!.map((tip, i) => (
                      <Box
                        key={i}
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
                          <Box
                            sx={{
                              fontSize: 16,
                              color: 'text.secondary',
                              flexShrink: 0,
                              mt: 0.25,
                              display: 'flex',
                            }}
                          >
                            {tip.icon}
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {tip.text}
                          </Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
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
      <Typography variant="caption" sx={{ fontSize: 11, color: 'text.disabled' }}>
        图片仅在本地处理，不会上传
      </Typography>
    </Box>
  );
}

// 工具右栏小标题（与 ToolWorkbench 的 tips 标题一致：几何字体 + overline）
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
