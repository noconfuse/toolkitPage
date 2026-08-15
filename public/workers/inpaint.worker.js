// 去水印推理 Worker —— 独立静态文件，不经过 webpack 编译。
// 由主线程以 module worker 方式加载（new Worker('/workers/inpaint.worker.js', { type: 'module' })），
// 因此可以放心使用动态 import() 加载同源的 ORT bundle（ESM）。
//
// 模型：MI-GAN Pipeline v2（migan_pipeline_v2.onnx，uint8 动态输入）。
//   - 输入1：uint8 图像 [1,3,H,W]（RGB CHW）
//   - 输入2：uint8 mask [1,1,H,W]（255=保留区，0=待修复区）
//   - 输出：uint8 [1,3,H,W]，已是最终修复结果
// 推理使用 ORT WASM 单线程后端（numThreads=1，不依赖 SharedArrayBuffer）。

// 启动标记：验证 worker 真的执行到（控制台可查）
console.log('[WORKER STARTED]', typeof self, typeof importScripts);

// 只加载 wasm bundle（内部按 import.meta.url 相对路径拉取同目录的
// ort-wasm-simd-threaded.wasm），不加载 webgpu bundle，减少失败面。
const ORT_WASM_URL = '/vendor/onnxruntime-web/ort.wasm.bundle.min.mjs';

let ortMod = null;
let sessionPromise = null;

// 动态加载 ORT 运行时，30s 超时兜底，失败抛出带原因的合并错误
async function ensureOrt() {
  if (ortMod) return ortMod;
  console.log('[worker] trying wasm bundle', ORT_WASM_URL);
  try {
    const importPromise = import(ORT_WASM_URL);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('ORT 加载超时（30s）')), 30_000),
    );
    const mod = await Promise.race([importPromise, timeout]);
    console.log('[worker] loaded wasm bundle');
    ortMod = mod;
    return mod;
  } catch (err) {
    console.error('[worker] failed wasm bundle', err);
    const detail = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
    throw new Error(`ORT 运行时加载失败：${detail}`);
  }
}

// ───────── 张量转换（RGBA/HWC ⇄ CHW） ─────────
function rgbaToChwRgb(rgba, w, h) {
  const n = w * h;
  const out = new Uint8Array(3 * n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = rgba[j];
    out[n + i] = rgba[j + 1];
    out[2 * n + i] = rgba[j + 2];
  }
  return out;
}

// mask：涂抹处（alpha>0）为待修复区 → 0，其余 → 255
function maskToChw(maskRgba, w, h) {
  const n = w * h;
  const out = new Uint8Array(n);
  for (let i = 0, j = 3; i < n; i++, j += 4) {
    out[i] = maskRgba[j] > 0 ? 0 : 255;
  }
  return out;
}

// 输出：CHW uint8 → RGBA 像素流
function chwToRgba(chw, w, h) {
  const n = w * h;
  const out = new Uint8Array(4 * n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[j] = chw[i];
    out[j + 1] = chw[n + i];
    out[j + 2] = chw[2 * n + i];
    out[j + 3] = 255;
  }
  return out;
}

// ───────── Session 管理 ─────────
async function createSession(modelBytes) {
  console.log('[worker] createSession start, bytes=', modelBytes.byteLength);
  const api = await ensureOrt();
  // 单线程：避免依赖 SharedArrayBuffer（需 COOP/COEP），对 inpainting 够用
  api.env.wasm.numThreads = 1;
  api.env.wasm.simd = true;
  console.log('[worker] createSession ep=wasm');
  const session = await api.InferenceSession.create(modelBytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  console.log('[worker] createSession done');
  return session;
}

async function ensureSession(modelBytes) {
  if (sessionPromise) return sessionPromise;
  if (!modelBytes) throw new Error('Worker 未初始化：缺少模型二进制');
  sessionPromise = createSession(modelBytes).catch((err) => {
    sessionPromise = null; // 失败允许重试
    throw err;
  });
  return sessionPromise;
}

// ───────── 消息处理 ─────────
self.addEventListener('message', async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      // 初始化失败转成可读消息，主线程显示给用户
      try {
        await ensureSession(msg.modelBytes);
      } catch (err) {
        const detail = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
        self.postMessage({ type: 'error', error: `Init failed: ${detail}` });
        return;
      }
      self.postMessage({ type: 'ready' });
      return;
    }

    if (msg.type === 'dispose') {
      if (sessionPromise) {
        try {
          const s = await sessionPromise;
          await s.release();
        } catch {
          /* ignore */
        }
        sessionPromise = null;
      }
      return;
    }

    if (msg.type === 'inpaint') {
      const api = await ensureOrt();
      const session = await ensureSession();
      const { id, w, h } = msg;
      const imageChw = rgbaToChwRgb(msg.image, w, h);
      const maskChw = maskToChw(msg.mask, w, h);
      const feeds = {
        [session.inputNames[0]]: new api.Tensor('uint8', imageChw, [1, 3, h, w]),
        [session.inputNames[1]]: new api.Tensor('uint8', maskChw, [1, 1, h, w]),
      };
      const outputs = await session.run(feeds);
      const out = outputs[session.outputNames[0]].data;
      const rgba = chwToRgba(out, w, h);
      // transferable 零拷贝回传
      self.postMessage({ type: 'inpaint:done', id, out: rgba.buffer }, [rgba.buffer]);
      return;
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err),
    });
  }
});

// 兜底上报：把 Worker 顶层未捕获异常 / unhandledrejection 转成 'error' 消息后关闭
self.addEventListener('error', (e) => {
  try {
    e.preventDefault();
    const stack = e.error instanceof Error ? e.error.stack : '';
    const detail = e.message || e.filename || 'Worker 未捕获错误';
    const full = stack ? `${detail}\n${stack}` : detail;
    self.postMessage({ type: 'error', error: `Worker fatal: ${full}` });
  } catch {
    /* postMessage 自身失败时无能为力 */
  }
  setTimeout(() => self.close(), 50);
});
self.addEventListener('unhandledrejection', (e) => {
  try {
    const reason = e.reason;
    const detail = reason instanceof Error ? `${reason.message}\n${reason.stack || ''}` : String(reason);
    self.postMessage({ type: 'error', error: `Unhandled rejection: ${detail}` });
  } catch {
    /* ignore */
  }
  setTimeout(() => self.close(), 50);
});
