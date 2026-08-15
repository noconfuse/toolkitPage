// @jsquash/oxipng 的多线程 codec（wasm-bindgen-rayon）只在 Worker 内才有意义，
// 本应用的图片压缩全部运行在主线程，永远走单线程 codec（codec/pkg/）。
// next.config.mjs 用 NormalModuleReplacementPlugin 把 pkg-parallel 的 import
// 指向此 stub，从打包产物中彻底移除 rayon 并行 chunk，消除它与 webpack runtime
// 之间的循环依赖告警。此 stub 永远不会被真正执行。
//
// 若未来需要在 Worker 内做并行压缩，请移除该替换并回归 @jsquash/oxipng 原行为。
export default function init() {
  throw new Error('[oxipng] 多线程 codec 已在 next.config.mjs 中被禁用（主线程压缩用不到）');
}
export function initThreadPool() {
  throw new Error('[oxipng] 多线程 codec 已在 next.config.mjs 中被禁用（主线程压缩用不到）');
}
export function optimise() {
  throw new Error('[oxipng] 多线程 codec 已在 next.config.mjs 中被禁用（主线程压缩用不到）');
}
export function optimise_raw() {
  throw new Error('[oxipng] 多线程 codec 已在 next.config.mjs 中被禁用（主线程压缩用不到）');
}
