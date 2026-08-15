/** @type {import('next').NextConfig} */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 允许在任何主机名访问 /llms.txt 等静态文件
  async headers() {
    return [
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pdfjs-dist 5 是纯 ESM，webpack 5 默认会把它转 CJS；
      // 浏览器侧直接当 ESM 处理，避免 Object.defineProperty 报错。
      config.experiments = { ...config.experiments, outputModule: true };
      config.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules\/pdfjs-dist/,
        type: 'javascript/auto',
        resolve: { fullySpecified: false },
      });
      // @jsquash/oxipng 的多线程 codec（wasm-bindgen-rayon）只会在 Worker 内被启用，
      // 而本应用压缩全部跑在主线程（永远走单线程 codec/pkg/）。把它替换为 stub，
      // 避免 rayon 并行 chunk 与 webpack runtime 产生循环依赖告警。
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /pkg-parallel\/squoosh_oxipng\.js$/,
          (resource) => {
            resource.request = require.resolve('./src/lib/oxipng-mt-stub.js');
          }
        )
      );
    }
    return config;
  },
};

export default nextConfig;