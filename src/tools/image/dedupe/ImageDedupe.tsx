'use client';

// 图片去重：拖入一个图片目录（或选择多个图片文件），系统基于 MD5（精确重复）
// 与感知哈希 dHash（近似重复）判定目录内是否存在重复图片，可逐组确认保留哪张，
// 最后把去重后的目录打包为 ZIP 下载（保留原目录结构）。
//
// 检测策略：
// - 精确：对每个文件计算 MD5，字节完全一致即判为重复（同一张图的不同副本）。
// - 近似：对每张图计算 dHash（差异哈希，9×8 灰度 → 64 bit），汉明距离 ≤ 阈值
//   判为近似重复（同一张图的不同压缩/缩放/格式版本）。
// - 两者：先按 MD5 分精确组，再对剩余未分组图片按 dHash 聚类。
//
// 全部在浏览器内完成，文件不上传。

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Slider from '@mui/material/Slider';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import JSZip from 'jszip';
import {
  ToolWorkbench,
  SidebarTitle,
  TipCard,
  SidebarResourceInfo,
  formatBytes,
  dropzoneBg,
  dropzoneBgSize,
  dropzoneBgPos,
} from '@/components/tools/ToolWorkbench';
import FlowPill from '@/components/tools/FlowPill';
import { useFlowInput, flowImagesToFiles, makeFlowImage, type FlowImage } from '@/lib/flow';

type DedupMode = 'exact' | 'perceptual';
type KeepStrategy = 'first' | 'largest';
type ViewMode = 'duplicates' | 'all';

type ImageEntry = {
  id: string;
  file: File;
  relPath: string; // 目录内相对路径（拖入文件夹时保留结构；多选文件时为文件名）
  name: string;
  size: number;
  width: number;
  height: number;
  dataUrl: string;
  md5: string;
  phash: string;
  groupId: string | null; // 所属重复组
  keep: boolean; // 是否保留（输出）
};

type Progress = { total: number; done: number; currentId: string | null };

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'];

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('图片解码失败'));
    i.src = src;
  });

// ───────── MD5（纯 JS，Web Crypto 不支持 MD5）─────────
const md5 = (() => {
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const rotl = (x: number, c: number) => ((x << c) | (x >>> (32 - c))) >>> 0;
  const toHex = (n: number) => {
    let s = '';
    for (let i = 0; i < 4; i++) s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return s;
  };
  return function md5(bytes: Uint8Array): string {
    const origLen = bytes.length;
    const bitLen = origLen * 8;
    const paddedLen = (((origLen + 8) >> 6) + 1) << 6;
    const data = new Uint8Array(paddedLen);
    data.set(bytes);
    data[origLen] = 0x80;
    const dv = new DataView(data.buffer);
    dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
    dv.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let off = 0; off < paddedLen; off += 64) {
      const M = new Uint32Array(16);
      for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F: number, g: number;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + rotl(F, S[i])) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
  };
})();

// ───────── dHash（差异感知哈希，9×8 灰度 → 64 bit）─────────
async function computeDHash(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = 9, h = 8;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray: number[] = [];
  for (let i = 0; i < w * h; i++) {
    gray.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  let bits = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      bits += gray[y * w + x] > gray[y * w + x + 1] ? '1' : '0';
    }
  }
  return bits;
}

const hamming = (a: string, b: string): number => {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
};

// ───────── 文件夹拖拽遍历（webkitGetAsEntry 保留目录结构）─────────
type DirEntry = { path: string; file: File };

function readEntry(entry: FileSystemEntry, path: string): Promise<DirEntry[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => resolve([{ path, file }]),
        () => resolve([]),
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries(
          (entries) => {
            if (entries.length === 0) {
              Promise.all(all.map((e) => readEntry(e, path ? `${path}/${e.name}` : e.name))).then(
                (arrs) => resolve(arrs.flat()),
              );
            } else {
              all.push(...entries);
              readBatch();
            }
          },
          () => resolve([]),
        );
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

function traverseDataTransfer(dt: DataTransfer): Promise<DirEntry[]> {
  const items = Array.from(dt.items);
  const entries = items
    .map((it) => (it as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return Promise.resolve([]);
  return Promise.all(entries.map((e) => readEntry(e, e.name))).then((arrs) => arrs.flat());
}

// ───────── 分组：按模式计算重复组并设置 keep 标记 ─────────
function buildGroups(entries: ImageEntry[], mode: DedupMode, threshold: number, strategy: KeepStrategy): void {
  entries.forEach((e) => {
    e.groupId = null;
    e.keep = true;
  });
  let seq = 0;
  const newGroup = () => `g${seq++}`;

  if (mode === 'exact') {
    const byMd5 = new Map<string, ImageEntry[]>();
    entries.forEach((e) => {
      const arr = byMd5.get(e.md5) ?? [];
      arr.push(e);
      byMd5.set(e.md5, arr);
    });
    byMd5.forEach((arr) => {
      if (arr.length > 1) {
        const gid = newGroup();
        arr.forEach((e) => (e.groupId = gid));
      }
    });
  }

  if (mode === 'perceptual') {
    const ungrouped = entries.filter((e) => !e.groupId);
    const assigned = new Set<string>();
    for (const e of ungrouped) {
      if (assigned.has(e.id)) continue;
      const gid = newGroup();
      e.groupId = gid;
      assigned.add(e.id);
      for (const o of ungrouped) {
        if (assigned.has(o.id)) continue;
        if (hamming(e.phash, o.phash) <= threshold) {
          o.groupId = gid;
          assigned.add(o.id);
        }
      }
    }
    // 单成员组不是重复 → 清除
    const counts = new Map<string, number>();
    entries.forEach((e) => {
      if (e.groupId) counts.set(e.groupId, (counts.get(e.groupId) ?? 0) + 1);
    });
    entries.forEach((e) => {
      if (e.groupId && counts.get(e.groupId) === 1) e.groupId = null;
    });
  }

  // 每组保留一张（按策略）
  const groups = new Map<string, ImageEntry[]>();
  entries.forEach((e) => {
    if (e.groupId) {
      const arr = groups.get(e.groupId) ?? [];
      arr.push(e);
      groups.set(e.groupId, arr);
    }
  });
  groups.forEach((arr) => {
    let keeper = arr[0];
    if (strategy === 'largest') {
      for (const e of arr) if (e.width * e.height > keeper.width * keeper.height) keeper = e;
    }
    arr.forEach((e) => (e.keep = e.id === keeper.id));
  });
}

export default function ImageDedupe({ title, description }: { title: string; description: string }) {
  const [entries, setEntries] = React.useState<ImageEntry[]>([]);
  const [working, setWorking] = React.useState(false);
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [processed, setProcessed] = React.useState(false);

  const [mode, setMode] = React.useState<DedupMode>('exact');
  const [threshold, setThreshold] = React.useState(8);
  const [strategy, setStrategy] = React.useState<KeepStrategy>('first');
  const [view, setView] = React.useState<ViewMode>('duplicates');

  const entriesRef = React.useRef<ImageEntry[]>(entries);
  React.useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // 摄入工作流产物
  const flowInput = useFlowInput();
  const flowConsumed = React.useRef(false);
  React.useEffect(() => {
    if (flowConsumed.current || !flowInput?.images.length) return;
    flowConsumed.current = true;
    ingest(flowImagesToFiles(flowInput.images).map((f) => ({ file: f, relPath: f.name })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowInput]);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);

  // 摄入：构造条目（解码 + 尺寸），随后自动触发检测
  const ingest = async (list: { file: File; relPath: string }[]) => {
    const supported = list.filter(({ file }) => SUPPORTED_TYPES.includes(file.type));
    if (supported.length === 0) {
      setError('未找到可识别的图片（支持 PNG / JPG / WebP / GIF / BMP / AVIF）');
      return;
    }
    setError(null);
    const next: ImageEntry[] = [];
    for (const { file, relPath } of supported) {
      try {
        const dataUrl = await readDataUrl(file);
        const img = await loadImage(dataUrl);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          relPath,
          name: file.name,
          size: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          dataUrl,
          md5: '',
          phash: '',
          groupId: null,
          keep: true,
        });
      } catch {
        // 解码失败跳过
      }
    }
    setEntries((prev) => {
      const merged = [...prev, ...next];
      entriesRef.current = merged;
      queueMicrotask(() => detect());
      return merged;
    });
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) await ingest(files.map((f) => ({ file: f, relPath: f.name })));
  };

  const handleAddFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) {
      await ingest(
        files.map((f) => {
          // webkitdirectory 输入的文件带 webkitRelativePath（含子目录结构）
          const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
          return { file: f, relPath: rel && rel !== f.name ? rel : f.name };
        }),
      );
    }
  };

  const handleDrop = async (files: FileList | null, dt?: DataTransfer) => {
    if (!files) return;
    // 优先用 DataTransfer 遍历文件夹结构；失败则退回扁平文件列表
    if (dt) {
      try {
        const dirEntries = await traverseDataTransfer(dt);
        if (dirEntries.length) {
          await ingest(dirEntries.map((d) => ({ file: d.file, relPath: d.path })));
          return;
        }
      } catch {
        // 回退
      }
    }
    const list = Array.from(files);
    if (list.length) await ingest(list.map((f) => ({ file: f, relPath: f.name })));
  };

  const clearAll = () => {
    entries.forEach((e) => URL.revokeObjectURL(e.dataUrl));
    setEntries([]);
    setProcessed(false);
    setProgress(null);
  };

  const tokenRef = React.useRef(0);

  // 检测：计算 md5 + dHash，然后分组
  const detect = async (): Promise<void> => {
    const list = entriesRef.current;
    if (list.length === 0) {
      setError('请先添加图片');
      return;
    }
    const myToken = ++tokenRef.current;
    setWorking(true);
    setError(null);
    setProcessed(false);
    setProgress({ total: list.length, done: 0, currentId: null });

    const out: ImageEntry[] = [...list];
    try {
      for (let i = 0; i < list.length; i++) {
        if (tokenRef.current !== myToken) return;
        const src = list[i];
        setProgress({ total: list.length, done: i, currentId: src.id });
        try {
          const bytes = new Uint8Array(await src.file.arrayBuffer());
          const phash = await computeDHash(src.dataUrl);
          out[i] = { ...out[i], md5: md5(bytes), phash };
        } catch (e) {
          console.error('[ImageDedupe] hash failed', src.name, e);
          out[i] = { ...out[i], md5: 'err', phash: 'err' };
        }
        if (tokenRef.current !== myToken) return;
        setProgress({ total: list.length, done: i + 1, currentId: null });
        setEntries([...out]);
      }
      if (tokenRef.current !== myToken) return;
      buildGroups(out, mode, threshold, strategy);
      setEntries(out);
      setProcessed(true);
      setView('duplicates');
    } finally {
      if (tokenRef.current === myToken) setWorking(false);
    }
  };

  // 卸载释放 url
  React.useEffect(() => {
    return () => {
      entriesRef.current.forEach((e) => URL.revokeObjectURL(e.dataUrl));
    };
  }, []);

  // 设为保留：点击组内某张 → 该张保留，组内其余删除
  const setKeeper = (groupId: string, id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.groupId === groupId ? { ...e, keep: e.id === id } : e)),
    );
  };

  // 下载去重后目录（ZIP，保留相对路径）
  const downloadZip = async () => {
    const kept = entries.filter((e) => e.keep);
    if (!kept.length) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const e of kept) {
      let name = e.relPath;
      if (used.has(name)) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let i = 1;
        while (used.has(`${base}-${i}${ext}`)) i++;
        name = `${base}-${i}${ext}`;
      }
      used.add(name);
      zip.file(name, e.file);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dedupe-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 汇总
  const totalSize = entries.reduce((s, e) => s + e.size, 0);
  const keptSize = entries.filter((e) => e.keep).reduce((s, e) => s + e.size, 0);
  const groups = new Map<string, ImageEntry[]>();
  entries.forEach((e) => {
    if (e.groupId) {
      const arr = groups.get(e.groupId) ?? [];
      arr.push(e);
      groups.set(e.groupId, arr);
    }
  });
  const groupList = Array.from(groups.values());
  const removedCount = entries.filter((e) => !e.keep).length;
  const keptCount = entries.length - removedCount;

  // 结果态串流出口：保留的图片还原为 FlowImage[]
  const flowImages: FlowImage[] = React.useMemo(
    () =>
      entries
        .filter((e) => e.keep)
        .map((e) => makeFlowImage(e.file, e.name, e.width, e.height)),
    [entries],
  );

  const visibleEntries = view === 'all' ? entries : entries.filter((e) => e.groupId);

  return (
    <ToolWorkbench
      title={title}
      description={description}
      hasContent={entries.length > 0}
      onPickFile={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      emptyState={
        <Box
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
          }}
        >
          <Typography variant="body2">拖入一个图片目录，或选择图片文件开始去重</Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              component="label"
              startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
            >
              选择文件夹
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory 非标准属性
                webkitdirectory=""
                multiple
                hidden
                onChange={handleAddFolder}
              />
            </Button>
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            >
              选择图片
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
                multiple
                hidden
                onChange={handleAddFiles}
              />
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, mt: 0.5 }}>
            支持 PNG / JPG / WebP / GIF / BMP / AVIF
          </Typography>
        </Box>
      }
      usage={
        <TipCard
          icon={<ContentCopyIcon />}
          text="拖入图片目录或选择图片，系统基于 MD5（精确重复）与感知哈希（近似重复）自动找出重复图片，逐组确认保留哪张后，把去重后的目录打包为 ZIP 下载。"
        />
      }
      config={
        <Box>
          <SidebarTitle>去重设置</SidebarTitle>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                检测方式
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={mode}
                onChange={(_, v) => v && setMode(v)}
              >
                <ToggleButton value="exact">精确</ToggleButton>
                <ToggleButton value="perceptual">近似</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, display: 'block', mt: 1 }}>
                {mode === 'exact'
                  ? '仅按文件 MD5 判定字节完全一致的重复。'
                  : '仅按感知哈希判定内容相近的重复（不同压缩/缩放/格式）。'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                近似阈值
              </Typography>
              <Slider
                size="small"
                value={threshold}
                min={0}
                max={20}
                step={1}
                disabled={mode === 'exact'}
                onChange={(_, v) => setThreshold(v as number)}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, display: 'block' }}>
                阈值越小越严格（0 仅判完全一致），越大越宽松（可能误判）。
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                保留策略
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={strategy}
                onChange={(_, v) => v && setStrategy(v)}
              >
                <ToggleButton value="first">第一张</ToggleButton>
                <ToggleButton value="largest">最大分辨率</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                显示
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={view}
                onChange={(_, v) => v && setView(v)}
              >
                <ToggleButton value="duplicates">仅重复</ToggleButton>
                <ToggleButton value="all">全部</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>
        </Box>
      }
      resource={
        entries.length > 0 ? (
          <Box>
            <SidebarTitle>资源信息</SidebarTitle>
            <SidebarResourceInfo
              data={{
                name: `${entries.length} 张图片`,
                before: { size: totalSize },
                after: processed ? { size: keptSize } : undefined,
                extra: processed
                  ? [
                      { label: '重复组', value: `${groupList.length} 组` },
                      { label: '删除', value: `${removedCount} 张` },
                      { label: '保留', value: `${keptCount} 张` },
                    ]
                  : undefined,
              }}
            />
          </Box>
        ) : undefined
      }
      flow={flowImages.length > 0 ? <FlowPill images={flowImages} /> : undefined}
      actions={
        <Stack spacing={1}>
          {working && progress && (
            <Box>
              <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                  {progress.currentId ? '正在检测…' : '收尾中…'}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}
                >
                  {progress.done}/{progress.total}
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
            </Box>
          )}
          {entries.length > 0 && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                component="label"
                startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              >
                继续添加
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
                  multiple
                  hidden
                  onChange={handleAddFiles}
                />
              </Button>
              <Tooltip title="清空全部">
                <IconButton size="small" color="inherit" onClick={clearAll} sx={{ color: 'text.secondary' }}>
                  <DeleteSweepIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              {processed && (
                <Typography
                  variant="caption"
                  sx={{
                    color: removedCount > 0 ? 'warning.main' : 'success.main',
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 11,
                  }}
                >
                  {removedCount > 0
                    ? `发现 ${groupList.length} 组重复 · 将删除 ${removedCount} 张`
                    : '未发现重复图片'}
                </Typography>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={detect}
                disabled={working}
                startIcon={<SearchIcon sx={{ fontSize: 16 }} />}
              >
                重新检测
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={downloadZip}
                disabled={!processed || keptCount === 0 || working}
                startIcon={<FolderZipIcon sx={{ fontSize: 16 }} />}
              >
                下载去重 ZIP
              </Button>
            </Stack>
          )}
        </Stack>
      }
    >
      {/* 左主区：重复组 / 全部图片列表 */}
      <Stack
        spacing={1.5}
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
        {!processed && entries.length > 0 && (
          <Box
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: '#fafaf7',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'text.secondary',
            }}
          >
            <CircularProgress size={14} thickness={5} />
            <Typography variant="body2" sx={{ fontSize: 13 }}>
              已添加 {entries.length} 张图片，正在检测重复…
            </Typography>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'error.main',
              borderRadius: 1,
              bgcolor: 'rgba(211,47,47,0.06)',
              color: 'error.main',
            }}
          >
            <Typography variant="body2" sx={{ fontSize: 13 }}>
              {error}
            </Typography>
          </Box>
        )}

        {processed && groupList.length === 0 && (
          <Box
            sx={{
              p: 3,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: '#fafaf7',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              color: 'text.secondary',
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 28, color: 'success.main' }} />
            <Typography variant="body2" sx={{ fontSize: 13 }}>
              未发现重复图片，全部 {entries.length} 张均为唯一。
            </Typography>
          </Box>
        )}

        {view === 'duplicates' &&
          groupList.map((group, gi) => (
            <Box
              key={group[0].groupId}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: '#fafaf7',
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', mb: 1.25, gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'var(--font-geist-mono)',
                    color: 'warning.main',
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  重复组 #{gi + 1}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                  {group.length} 张 · 保留 {group.filter((e) => e.keep).length} 张
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10 }}>
                  点击缩略图设为保留
                </Typography>
              </Stack>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {group.map((e) => (
                  <Box
                    key={e.id}
                    onClick={() => setKeeper(e.groupId!, e.id)}
                    sx={{
                      width: 96,
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: 2,
                      borderColor: e.keep ? 'success.main' : 'divider',
                      overflow: 'hidden',
                      bgcolor: '#fff',
                      transition: 'border-color 150ms ease',
                      '&:hover': { borderColor: e.keep ? 'success.main' : 'primary.main' },
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        height: 72,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        bgcolor: '#fff',
                      }}
                    >
                      <img
                        src={e.dataUrl}
                        alt={e.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                      />
                    </Box>
                    <Box
                      sx={{
                        px: 0.5,
                        py: 0.25,
                        textAlign: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: e.keep ? 'success.main' : 'text.disabled',
                        bgcolor: e.keep ? 'rgba(46,125,50,0.08)' : 'transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.keep ? '保留' : '删除'}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}

        {view === 'all' &&
          visibleEntries.map((e) => (
            <Box
              key={e.id}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1.5,
                border: 1,
                borderColor: e.groupId ? 'warning.main' : 'divider',
                borderRadius: 1,
                bgcolor: '#fafaf7',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  flexShrink: 0,
                  borderRadius: 1,
                  bgcolor: '#fff',
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={e.dataUrl}
                  alt={e.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                />
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
                  {e.relPath}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    mt: 0.25,
                    color: 'text.secondary',
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 11,
                  }}
                >
                  <span>
                    {e.width}×{e.height}
                  </span>
                  <span>·</span>
                  <span>{formatBytes(e.size)}</span>
                  <span>·</span>
                  <span>MD5 {e.md5.slice(0, 8)}</span>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
                  {e.groupId ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'warning.main',
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      重复
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'success.main',
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      唯一
                    </Typography>
                  )}
                  {e.groupId && (
                    <Button
                      size="small"
                      variant={e.keep ? 'contained' : 'outlined'}
                      color={e.keep ? 'success' : 'inherit'}
                      sx={{ minWidth: 0, px: 1, fontSize: 11, py: 0.25 }}
                      onClick={() => setKeeper(e.groupId!, e.id)}
                    >
                      {e.keep ? '保留' : '设为保留'}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Box>
          ))}
      </Stack>
    </ToolWorkbench>
  );
}
