'use client';

// PDF 合并 / 拆分：合并多个 PDF 为一个，或把一个 PDF 按页拆成多个单页 PDF。
// 使用 pdf-lib（与 PDF 贴图同栈），全部在浏览器内完成，不上传。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import JSZip from 'jszip';

type Mode = 'merge' | 'split';

type PdfItem = {
  id: string;
  file: File;
  pages: number;
};

type PageRange = { from: number; to: number };

type Result =
  | { kind: 'merge'; blob: Blob; name: string; size: number; pages: number }
  | { kind: 'split'; blob: Blob; name: string; size: number; pages: number };

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

// pdf-lib save() 返回 Uint8Array<ArrayBufferLike>，Blob 构造需 ArrayBuffer 视图
const toBlobPart = (bytes: Uint8Array): BlobPart => bytes.slice();

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 解析页码范围输入："1-3, 5-8"、"2"、"1-3,6" 等，支持中英文逗号/分号/空格分隔
const parseRanges = (input: string, total: number): { ranges: PageRange[]; error?: string } => {
  const parts = input
    .split(/[,，;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ranges: PageRange[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*[-—–~～]\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > total) {
        return { ranges, error: `页码 ${a}-${b} 超出范围（共 ${total} 页）` };
      }
      ranges.push({ from: a, to: b });
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p < 1 || p > total) {
        return { ranges, error: `页码 ${p} 超出范围（共 ${total} 页）` };
      }
      ranges.push({ from: p, to: p });
    } else {
      return { ranges, error: `无法识别「${part}」，请用如 1-3, 5-8 的格式` };
    }
  }
  if (!ranges.length) {
    return { ranges, error: '请输入页码范围' };
  }
  return { ranges };
};

export default function PdfMerge() {
  const [mode, setMode] = React.useState<Mode>('merge');
  const [items, setItems] = React.useState<PdfItem[]>([]);
  const [working, setWorking] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [, setError] = React.useState<string | null>(null);
  const [splitInput, setSplitInput] = React.useState('');
  const [splitError, setSplitError] = React.useState<string | null>(null);

  const clearAll = () => {
    setItems([]);
    setResult(null);
    setSplitError(null);
  };

  // 上传 PDF，读取页数（拆分模式只保留一个文件，直接替换）
  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) return;
    e.target.value = '';
    setResult(null);
    setError(null);
    setSplitError(null);
    const next: PdfItem[] = [];
    for (const file of files) {
      const { PDFDocument } = await import('pdf-lib');
      let pages = 0;
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        pages = doc.getPageCount();
      } catch {
        pages = 0;
      }
      next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, pages });
    }
    setItems((prev) => (mode === 'split' ? next : [...prev, ...next]));
  };

  const run = async () => {
    if (mode === 'merge' && items.length < 2) return;
    if (mode === 'split' && items.length !== 1) return;
    setWorking(true);
    setResult(null);
    setError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      if (mode === 'merge') {
        setProgress({ done: 0, total: items.length });
        const out = await PDFDocument.create();
        let done = 0;
        for (const it of items) {
          const src = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
          done++;
          setProgress({ done, total: items.length });
        }
        const bytes = await out.save();
        setResult({
          kind: 'merge',
          blob: new Blob([toBlobPart(bytes)], { type: 'application/pdf' }),
          name: `merged-${Date.now()}.pdf`,
          size: bytes.byteLength,
          pages: out.getPageCount(),
        });
      } else {
        const src = await PDFDocument.load(await items[0].file.arrayBuffer(), { ignoreEncryption: true });
        const n = src.getPageCount();
        const { ranges, error } = parseRanges(splitInput, n);
        if (error) {
          setSplitError(error);
          return;
        }
        const zip = new JSZip();
        const base = items[0].file.name.replace(/\.pdf$/i, '');
        setProgress({ done: 0, total: ranges.length });
        for (let k = 0; k < ranges.length; k++) {
          const { from, to } = ranges[k];
          const idx = [];
          for (let p = from - 1; p < to; p++) idx.push(p);
          const doc = await PDFDocument.create();
          const pages = await doc.copyPages(src, idx);
          pages.forEach((pg) => doc.addPage(pg));
          const bytes = await doc.save();
          const label = from === to ? `p${from}` : `p${from}-${to}`;
          zip.file(`${base}-${label}.pdf`, new Blob([toBlobPart(bytes)], { type: 'application/pdf' }));
          setProgress({ done: k + 1, total: ranges.length });
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        setResult({ kind: 'split', blob, name: `${base}-split.zip`, size: blob.size, pages: ranges.length });
      }
    } catch (err) {
      console.error('[PdfMerge] failed', err);
      setError('处理失败，请检查 PDF 是否损坏或加密');
    } finally {
      setWorking(false);
    }
  };

  const onModeChange = (_: unknown, next: Mode | null) => {
    if (!next || next === mode) return;
    setMode(next);
    setItems([]);
    setResult(null);
    setSplitError(null);
  };

  return (
    <Box>
      {/* 模式切换 */}
      <ToggleButtonGroup exclusive size="small" value={mode} onChange={onModeChange} sx={{ mb: 2 }}>
        <ToggleButton value="merge" sx={{ px: 2, fontSize: 13 }}>
          合并 PDF
        </ToggleButton>
        <ToggleButton value="split" sx={{ px: 2, fontSize: 13 }}>
          拆分 PDF
        </ToggleButton>
      </ToggleButtonGroup>

      {/* 上传区 */}
      <Box
        sx={{
          width: '100%',
          minHeight: 160,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: '#fafaf7',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          p: 3,
          color: 'text.secondary',
        }}
      >
        <Box sx={{ fontSize: 32, opacity: 0.5 }}>{mode === 'merge' ? '📑' : '✂️'}</Box>
        <Typography variant="body2">
          {mode === 'merge' ? '上传多个 PDF，按顺序合并为一个' : '上传一个 PDF，按页码范围拆分为多个 PDF'}
        </Typography>
        <Button
          variant="contained"
          size="small"
          component="label"
          startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 1 }}
        >
          {mode === 'merge' ? '选择多个 PDF' : '选择 PDF'}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple={mode === 'merge'}
            hidden
            onChange={handleAdd}
          />
        </Button>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>
          所有处理在浏览器内完成 · 文件不会上传
        </Typography>
      </Box>

      {/* 文件列表 */}
      {items.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {items.map((it, idx) => (
            <Box
              key={it.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: '#fafaf7',
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: 'var(--font-geist-mono)', color: 'text.secondary' }}>
                {String(idx + 1).padStart(2, '0')}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.file.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
                {it.pages} 页
              </Typography>
              {mode === 'merge' && (
                <Tooltip title="移除">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setItems((prev) => prev.filter((x) => x.id !== it.id));
                      setResult(null);
                    }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <DeleteSweepIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
          {mode === 'split' && items.length === 1 && (
            <Box sx={{ pt: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                页码范围（共 {items[0].pages} 页，支持多个区间，每个区间拆成一个 PDF）
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="如：1-3, 5-8"
                value={splitInput}
                onChange={(e) => {
                  setSplitInput(e.target.value);
                  if (splitError) setSplitError(null);
                }}
                error={!!splitError}
                helperText={splitError ?? '输入 1-N 可拆分整本，单个页码如 3 只拆第 3 页'}
              />
            </Box>
          )}
        </Stack>
      )}

      {/* 操作行 */}
      {items.length > 0 && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={run}
            disabled={working || (mode === 'merge' ? items.length < 2 : items.length !== 1)}
          >
            {working ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CircularProgress size={12} thickness={5} color="inherit" />
                处理中…
              </span>
            ) : mode === 'merge' ? (
              '合并'
            ) : (
              '拆分'
            )}
          </Button>
          <Tooltip title="清空全部">
            <IconButton size="small" color="inherit" onClick={clearAll} sx={{ color: 'text.secondary' }}>
              <DeleteSweepIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {working && progress && progress.total > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
              {mode === 'merge' ? '合并中…' : '拆分中…'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
              {progress.done}/{progress.total}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
        </Box>
      )}

      {/* 结果 */}
      {result && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: '#fafaf7',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box sx={{ fontSize: 24, opacity: 0.6 }}>{result.kind === 'merge' ? '📄' : '🗂️'}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
              {result.kind === 'merge' ? `已合并 ${result.pages} 页` : `已按 ${result.pages} 个区间拆分`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
              {formatBytes(result.size)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={() => downloadBlob(result.blob, result.name)}
            startIcon={result.kind === 'merge' ? <DownloadIcon sx={{ fontSize: 16 }} /> : <FolderZipIcon sx={{ fontSize: 16 }} />}
          >
            下载 {result.kind === 'merge' ? 'PDF' : 'ZIP'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
