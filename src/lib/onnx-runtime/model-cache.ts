// 通用 ONNX 模型二进制 IndexedDB 缓存。
// - 多模型共用同一 DB（toolkit-inpaint / store=models），按 cacheKey 隔离。
// - 首次会话：fetch + 写入；二次会话：IndexedDB 直读，秒进。
// - 用版本号 key 防止模型更新后旧缓存生效；版本号跟随调用方常量。
// - 模型自托管到 public/models，调用方通过入参 URL 传入。

const DB_NAME = 'toolkit-inpaint';
const DB_VERSION = 1;
const STORE = 'models';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const getCached = async (key: string): Promise<ArrayBuffer | null> => {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const putCached = async (key: string, buf: ArrayBuffer): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(buf, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const cacheKey = (version: string, url: string) => `${version}::${url}`;

/** 读取模型 ArrayBuffer：优先 IndexedDB，没有则 fetch 并写入。 */
export async function loadModelBytes(
  urlOrOnProgress: string | ((p: number) => void),
  versionOrUrl?: string | ((p: number) => void),
  onProgress?: (p: number) => void,
): Promise<ArrayBuffer> {
  // 兼容旧调用：loadModelBytes(onProgress) — 用默认 MIGAN 模型
  // 新调用：loadModelBytes(url, version, onProgress)
  let url: string;
  let version: string;
  let progress: ((p: number) => void) | undefined;
  if (typeof urlOrOnProgress === 'function') {
    // 旧签名：loadModelBytes(onProgress)
    url = process.env.NEXT_PUBLIC_MIGAN_MODEL_URL || '/models/migan_pipeline_v2.onnx';
    version = 'migan-pipeline-v2';
    progress = urlOrOnProgress;
  } else {
    url = urlOrOnProgress;
    version = (versionOrUrl as string) ?? 'default';
    progress = onProgress;
  }

  const key = cacheKey(version, url);
  const cached = await getCached(key).catch(() => null);
  if (cached) {
    progress?.(1);
    return cached;
  }
  // 流式 fetch 才能拿到真实下载进度
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`模型下载失败：${res.status}`);
  const total = Number(res.headers.get('content-length') || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) progress?.(Math.min(0.99, received / total));
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  const ab = buf.buffer;
  // 异步写入缓存（不阻塞返回，用户体感更顺）
  putCached(key, ab).catch(() => {
    /* 写入失败下次重新下载即可 */
  });
  progress?.(1);
  return ab;
}
