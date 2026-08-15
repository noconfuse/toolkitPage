'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LayersIcon from '@mui/icons-material/Layers';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { BeforeAfterCompare } from '@/components/tools/BeforeAfterCompare';
import { ToolWorkbench, type ToolWorkbenchTip } from '@/components/tools/ToolWorkbench';
import { stashImage, buildCombineHref } from '@/lib/cross-tool-image';

// 阶段标识：与图片去水印一致。idle = 无任务；loading = 加载识别引擎/模型
// （含动态 import 与 wasm/onnx 模型下载）；processing = 跑模型推理 + 编码。
// 进度统一用 0-1 的 progress，与去水印进度模型保持一致。
type Phase = 'idle' | 'loading' | 'processing';

// 把去背景内部进度 key 映射为「阶段 + 0-1 进度」，与去水印的 phase 语义对齐。
// @imgly/background-removal 的 progress 回调 key 大致形态：
//   - fetch:/models/<file>            模型文件字节进度
//   - fetch:/onnxruntime-web/<file>   wasm/线程运行时字节进度
//   - compute:wasm:load / :init       引擎初始化（无 total）
//   - compute:inference               模型推理
// processing 阶段子步骤文字：库内部推理/编码无进度回调，按时间轮转这几个提示，
// 让用户明确感知"程序在跑"。子步骤顺序对应实际流水线：解码图像 → 模型推理 → 生成 PNG
const PROCESSING_HINTS = ['正在解码图像…', '正在识别主体…', '正在生成结果…'];

function classifyProgress(
  key: string,
  current: number,
  total: number,
): { phase: Phase; progress: number; label: string } | null {
  if (key.startsWith('fetch:')) {
    // 模型 / 运行时下载：合并归到 loading 阶段
    const r = total > 0 ? current / total : 0;
    const label = key.startsWith('fetch:/models/') ? '下载 AI 模型' : '下载识别引擎';
    return { phase: 'loading', progress: r, label };
  }
  if (key.startsWith('compute:') || key === 'compute:init') {
    // wasm 初始化 + 模型推理都归到 processing（已经下载完）
    const r = total > 0 ? current / total : 0;
    const label = key === 'compute:inference' ? '识别主体' : '初始化识别引擎';
    return { phase: 'processing', progress: r, label };
  }
  return null;
}

export default function BackgroundReplace() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [sourceName, setSourceName] = React.useState<string>('image');
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [progress, setProgress] = React.useState(0);
  const [stageLabel, setStageLabel] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  // 计时：用于显示已用时长，让用户知道程序还在跑（库内部推理/编码阶段
  // 没有真实进度回调，UI 上 indeterminate 滚动 + elapsed 文字比静默好得多）
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [processingHintIdx, setProcessingHintIdx] = React.useState(0);

  const reset = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setSourceUrl(null);
    setResultUrl(null);
    setError(null);
    setPhase('idle');
    setProgress(0);
    setStageLabel('');
    setStartedAt(null);
    setElapsed(0);
    setProcessingHintIdx(0);
  };

  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [sourceUrl, resultUrl]);

  const handlePickFile = (file: File) => {
    setError(null);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setSourceUrl(URL.createObjectURL(file));
    setSourceName(file.name.replace(/\.[^.]+$/, ''));
    setResultUrl(null);
    setPhase('idle');
    setProgress(0);
    setStageLabel('');
    setStartedAt(null);
    setElapsed(0);
    setProcessingHintIdx(0);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePickFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (files: FileList | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'));
    if (file) handlePickFile(file);
  };

  const handleRemoveBackground = async () => {
    if (!sourceUrl) return;
    setError(null);
    setPhase('loading');
    setProgress(0);
    setStageLabel('加载识别引擎…');
    setStartedAt(Date.now());
    setElapsed(0);
    setProcessingHintIdx(0);
    try {
      // 由 webpack 正常打包（包内部会再按需 import onnxruntime-web，
      // wasm 文件已复制到 public/onnxruntime-web/ 供运行时按绝对路径加载）
      const { removeBackground } = await import('@imgly/background-removal');
      setProgress(0.05);
      const blob = await removeBackground(sourceUrl, {
        model: 'small',
        // publicPath 必须是完整绝对 URL（库内部用 new URL(path, base) 拼接），
        // 库通过 base URL 解析所有模型/wasm 资源。提前在浏览器拿到 origin，
        // 避免 'Failed to construct URL: Invalid base URL' 错误。
        publicPath: `${window.location.origin}/bg-removal-data/`,
        // 默认 true：库内部用 worker 跑 ONNX 推理，主线程只 await，避免渲染卡死
        // （之前为 false 时推理在主线程同步跑，长达数秒冻结渲染 → setInterval/UI 全停）
        proxyToWorker: true,
        output: { format: 'image/png', quality: 1 },
        progress: (key: string, current: number, total: number) => {
          const cls = classifyProgress(key, current, total);
          if (!cls) return;
          // fetch 阶段：fetch 一旦 100% 完成，库还要做 ONNX session 准备 + 图像解码
          // （几秒，无任何 progress 回调）。这里主动接管：fetch 完成立刻切到 processing，
          // 启动子步骤轮转，避免进度条卡在 100% 的"看起来卡死"状态。
          if (cls.phase === 'loading' && cls.progress >= 1) {
            setPhase('processing');
            setProgress(0);
            setStageLabel('正在解码图像…');
            setProcessingHintIdx(0);
            return;
          }
          setPhase(cls.phase);
          setProgress(cls.progress);
          setStageLabel(cls.label);
          // compute:inference 切到 processing 也启动子步骤轮转
          if (cls.phase === 'processing') {
            setProcessingHintIdx(0);
          }
        },
      });
      // 完成：resultUrl 就绪，重置进度状态
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setPhase('idle');
      setProgress(0);
      setStageLabel('');
      setStartedAt(null);
      setElapsed(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('idle');
      setProgress(0);
      setStageLabel('');
      setStartedAt(null);
      setElapsed(0);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${sourceName}-no-bg.png`;
    a.click();
  };

  // 把去背景结果通过 sessionStorage 透传到「图片合成」工具，自动作为前景图叠加
  const handleGoCombine = async () => {
    if (!resultUrl) return;
    setError(null);
    try {
      const blob = await fetch(resultUrl).then((r) => r.blob());
      const token = await stashImage({
        key: 'fg',
        blob,
        name: `${sourceName}-no-bg.png`,
      });
      window.location.href = buildCombineHref({ fg: token });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // busy 期间每秒刷新 elapsed；processing 阶段每 2 秒切换一次子步骤文字，
  // 给用户"程序还在动"的反馈（库内部推理/编码阶段无进度回调）
  React.useEffect(() => {
    if (phase === 'idle') return;
    const t = window.setInterval(() => {
      if (startedAt) setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    const p = window.setInterval(() => {
      if (phase === 'processing') {
        setProcessingHintIdx((i) => (i + 1) % PROCESSING_HINTS.length);
      }
    }, 2000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(p);
    };
  }, [phase, startedAt]);

  const busy = phase !== 'idle';
  const elapsedStr = elapsed > 0 ? `${elapsed}s` : '';
  const statusText =
    phase === 'loading'
      ? `${stageLabel} ${Math.round(progress * 100)}%${elapsedStr ? ` · 已用 ${elapsedStr}` : ''}`
      : phase === 'processing'
        ? `${PROCESSING_HINTS[processingHintIdx]} · 已用 ${elapsedStr || '0s'}`
        : null;

  // 提示卡：右栏使用说明（保持简短）
  const tips: ToolWorkbenchTip[] = [
    {
      icon: <AutoFixHighIcon sx={{ fontSize: 16 }} />,
      text: '自动识别主体，输出透明背景 PNG',
    },
   
  ];

  return (
    <ToolWorkbench
      hasContent={!!sourceUrl}
      onPickFile={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      // 暴露一个自定义空状态：保留工具自己的"选择图片"按钮文案
      emptyState={
        <Box
          onClick={() => fileInputRef.current?.click()}
          sx={{
            width: '100%',
            minHeight: 320,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: '#fafaf7',
            backgroundImage: `linear-gradient(45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,31,29,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,31,29,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,31,29,0.05) 75%)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            color: 'text.secondary',
            cursor: 'pointer',
          }}
        >
          <Typography variant="body2">上传图片，AI 自动识别主体并生成透明背景 PNG</Typography>
          <Button
            variant="contained"
            size="small"
            component="label"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            选择图片
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFile} />
          </Button>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, mt: 0.5 }}>
            图片仅在本地处理，不会上传
          </Typography>
        </Box>
      }
      tips={tips}
    >
      {/* 左主区 */}
      <BeforeAfterCompare
        originalUrl={sourceUrl}
        resultUrl={resultUrl}
        originalLabel="原图"
        resultLabel="去背景结果（透明 PNG）"
        resultCheckerboard
      />

      {busy && (
        <Box sx={{ mt: 2 }}>
          {/* loading 阶段：状态文字 + 真实字节进度（determinate）
              processing 阶段：库内部推理/编码无进度回调，用 indeterminate 滚动
                + 子步骤轮转 + 已用时长，让用户清楚知道程序在跑、不是卡死 */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 0.75 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
              {statusText ?? `${Math.round(progress * 100)}%`}
            </Typography>
            {phase === 'processing' && (
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontFamily: 'var(--font-geist-mono)' }}
              >
                {elapsedStr || '0s'}
              </Typography>
            )}
          </Stack>
          <LinearProgress
            variant={phase === 'processing' ? 'indeterminate' : 'determinate'}
            value={Math.round(progress * 100)}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 2, alignItems: 'center', flexWrap: 'nowrap' }}
      >
        <Button
          variant="outlined"
          size="small"
          component="label"
          disabled={busy}
          startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
        >
          更换图片
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFile} />
        </Button>

        <Button
          variant="text"
          size="small"
          color="inherit"
          startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
          onClick={reset}
          disabled={busy}
          sx={{ color: 'text.secondary' }}
        >
          清空
        </Button>

        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          size="small"
          startIcon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
          onClick={handleRemoveBackground}
          disabled={busy}
        >
          {resultUrl ? '重新处理' : 'AI 去背景'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="inherit"
          onClick={handleDownload}
          disabled={!resultUrl || busy}
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
        >
          下载
        </Button>

        {resultUrl && (
          <Button
            onClick={handleGoCombine}
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<LayersIcon sx={{ fontSize: 16 }} />}
          >
            去图片合成换背景
          </Button>
        )}
      </Stack>
    </ToolWorkbench>
  );
}
