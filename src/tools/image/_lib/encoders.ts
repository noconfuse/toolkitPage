// 图片编码器单例（懒加载，仅命中对应格式时才下载 codec chunk）
let mozjpegPromise: Promise<typeof import('@jsquash/jpeg')> | null = null;
export const getMozJpeg = () => (mozjpegPromise ??= import('@jsquash/jpeg'));
