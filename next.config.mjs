/** @type {import('next').NextConfig} */
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
  webpack: (config, { isServer }) => {
    // pdfjs-dist 5 是纯 ESM，webpack 5 默认会把它转 CJS；
    // 浏览器侧直接当 ESM 处理，避免 Object.defineProperty 报错。
    if (!isServer) {
      config.experiments = { ...config.experiments, outputModule: true };
      config.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules\/pdfjs-dist/,
        type: 'javascript/auto',
        resolve: { fullySpecified: false },
      });
    }
    return config;
  },
};

export default nextConfig;