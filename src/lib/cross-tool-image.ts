// 跨工具传图工具（去背景 / 去水印等工具结果 → 图片合成）。
//
// 用 sessionStorage 中转 + URL session: 标记，避免 Base64 进 URL（爆长 + 编码问题）。
// 同一个浏览器 Tab 内有效，关闭后自动清理。
//
// 约定：
// - 传图方：await stashImage({ key: 'bg' | 'fg', file, name? }) → 拿到 session:<id>
// - 跳转 URL：/tools/image/combine?bg=session:<id> （fg 同理）
// - 接图方：useEffect 里读取 URL 中的 session 标记 → resolveImage() 取出 Blob/File
//
// 设计要点：
// 1. 容量上限 50MB / key，超限抛错让上层提示用户改用下载后手动上传。
// 2. 取出后立刻删除（一次性消费），避免下次打开残留。
// 3. name 可选：去背景等场景默认 "image.png"，合成工具拿不到原始文件名时使用。

export const SESSION_PREFIX = 'session:';
const PREFIX = 'toolkit-page:image-handoff:';
const MAX_BYTES = 50 * 1024 * 1024;

export type StashKey = 'bg' | 'fg';

export async function stashImage(opts: {
  key: StashKey;
  blob: Blob;
  name?: string;
  mime?: string;
}): Promise<string> {
  if (opts.blob.size > MAX_BYTES) {
    throw new Error(
      `图片过大（${(opts.blob.size / 1024 / 1024).toFixed(1)}MB > 50MB），请改用下载后手动上传`,
    );
  }
  if (typeof sessionStorage === 'undefined') {
    throw new Error('当前环境不支持 sessionStorage');
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const arrayBuf = await opts.blob.arrayBuffer();
  // 把 ArrayBuffer 转 base64 存进 sessionStorage（结构化克隆不支持 Blob/File）
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  sessionStorage.setItem(
    `${PREFIX}${opts.key}:${id}`,
    JSON.stringify({
      base64,
      type: opts.blob.type || opts.mime || 'image/png',
      name: opts.name || 'image.png',
      size: opts.blob.size,
      ts: Date.now(),
    }),
  );
  return `${SESSION_PREFIX}${id}`;
}

/**
 * 从 URL search params 中解析所有 session: 引用，转换成 File。
 * 解析成功立刻从 sessionStorage 删除（一次性消费）。
 */
export function resolveImageFromSearch(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): Partial<Record<StashKey, File>> {
  const result: Partial<Record<StashKey, File>> = {};
  for (const key of ['bg', 'fg'] as StashKey[]) {
    const raw = searchParams instanceof URLSearchParams
      ? searchParams.get(key)
      : (searchParams[key] as string | undefined);
    if (!raw || !raw.startsWith(SESSION_PREFIX)) continue;
    const id = raw.slice(SESSION_PREFIX.length);
    const file = consumeStash(key, id);
    if (file) result[key] = file;
  }
  return result;
}

function consumeStash(key: StashKey, id: string): File | null {
  if (typeof sessionStorage === 'undefined') return null;
  const storageKey = `${PREFIX}${key}:${id}`;
  const raw = sessionStorage.getItem(storageKey);
  sessionStorage.removeItem(storageKey);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      base64: string;
      type: string;
      name: string;
    };
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], data.name, { type: data.type });
  } catch {
    return null;
  }
}

/**
 * 把 stashImage 返回的 session: 标记拼接到跳转 URL 上。
 */
export function buildCombineHref(opts: {
  fg?: string;
  bg?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.fg) params.set('fg', opts.fg);
  if (opts.bg) params.set('bg', opts.bg);
  const qs = params.toString();
  return qs ? `/tools/image/combine?${qs}` : '/tools/image/combine';
}