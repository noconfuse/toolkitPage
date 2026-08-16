'use client';

// 图片工作流：跨工具串流的状态传递。
//
// 各工具的产物统一抽象为「图片集合」(FlowImage[])，写入内存 Store 后以短 id 通过
// ?flow=<id> 传给下一个工具页；目标工具挂载时读取并直接进入「已上传」状态。
// 批量工具整包消费集合（N→N），单图工具对集合进入逐张模式（单图逐张处理，N→N），
// 合成类工具收敛（N→1）。无论批量还是单图，链路始终是串行的一条流水线。
//
// 存储策略：纯内存（SPA 客户端导航期间有效）+ 30 分钟过期 + 数量上限兜底。
// 不做 sessionStorage / IndexedDB：Blob 无法序列化，且工具链在一次会话内即可完成，
// 刷新页面丢失链路属于可接受范围（工具的「上传」入口始终可用）。
//
// 注意：各工具页都是 dynamic(ssr:false) 懒加载的独立 chunk，webpack 可能把本模块
// 打进多个 chunk 实例。store / idSeq 必须挂到 globalThis 上作为唯一单例，
// 否则「裁剪页写入 → 去水印页读取」会读到两个不同的空 store，导致串流丢失。

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

export type FlowImage = {
  id: string;
  blob: Blob;
  name: string;
  mime: string;
  width: number;
  height: number;
};

export type FlowContext = {
  images: FlowImage[];
};

type FlowEntry = { ctx: FlowContext; createdAt: number };

const MAX_FLOWS = 20;
const FLOW_TTL = 30 * 60 * 1000; // 30 分钟

// 全局单例：避免 ssr:false 懒加载 chunk 各自持有一份空 store
const G = globalThis as unknown as {
  __flowStore?: Map<string, FlowEntry>;
  __flowIdSeq?: number;
};

const store: Map<string, FlowEntry> =
  G.__flowStore ?? (G.__flowStore = new Map<string, FlowEntry>());

// 淘汰过期 + 超上限的旧上下文
const prune = () => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([id, e]) => {
    if (now - e.createdAt > FLOW_TTL) store.delete(id);
  });
  if (store.size > MAX_FLOWS) {
    const oldest = Array.from(store.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
};

// id 序号也挂全局，避免多 chunk 实例各自从 0 计数产生 id 冲突
const makeId = () => {
  const seq = G.__flowIdSeq ?? 0;
  G.__flowIdSeq = seq + 1;
  return `${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
};

/** 构造一个 FlowImage（工具已知道宽高时无需再解码图片） */
export function makeFlowImage(blob: Blob, name: string, width: number, height: number): FlowImage {
  return {
    id: makeId(),
    blob,
    name,
    mime: blob.type || 'image/png',
    width,
    height,
  };
}

/** 异步解码图片得到宽高后构造 FlowImage（工具只持有 blob、不追踪尺寸时用） */
export function blobToFlowImage(blob: Blob, name: string): Promise<FlowImage> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(makeFlowImage(blob, name, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    img.src = url;
  });
}

/** 写入工作流上下文，返回可拼到 ?flow= 的短 id */
export function createFlow(images: FlowImage[]): string {
  prune();
  const id = makeId();
  store.set(id, { ctx: { images }, createdAt: Date.now() });
  return id;
}

/** 读取工作流上下文；id 无效 / 已过期返回 null */
export function getFlow(id: string | null | undefined): FlowContext | null {
  if (!id) return null;
  const e = store.get(id);
  if (!e) return null;
  if (Date.now() - e.createdAt > FLOW_TTL) {
    store.delete(id);
    return null;
  }
  return e.ctx;
}

/** 把 FlowImage[] 还原为 File[]，便于直接复用各工具已有的文件摄入逻辑 */
export function flowImagesToFiles(images: FlowImage[]): File[] {
  return images.map(
    (im, i) => new File([im.blob], im.name || `image-${i + 1}.${im.mime === 'image/jpeg' ? 'jpg' : 'png'}`, { type: im.mime }),
  );
}

/**
 * 读取当前路由 ?flow= 对应的工作流上下文（结果态的串流入口）。
 * 工具应在挂载时把 flowInput.images 摄入自身状态（复用文件摄入逻辑）。
 */
export function useFlowInput(): FlowContext | null {
  const params = useSearchParams();
  const id = params?.get('flow');
  return React.useMemo(() => getFlow(id), [id]);
}
