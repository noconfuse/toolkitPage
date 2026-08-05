# Toolkit Page

一个聚合实用工具的极简站点，**本地优先、零追踪、SEO/GEO 友好**。

> 旧版本基于 React 18 + 自定义 Webpack（SPA），已废弃。  
> 当前版本基于 **Next.js 14 App Router**，所有页面静态生成，原生支持 SEO / GEO。

## 已上线的工具

- **图片叠加** — `/tools/image-combine`
  - 11 种 Canvas `globalCompositeOperation` 混合模式
  - 可调画布尺寸，一键下载 PNG
  - 所有处理在浏览器内完成，**不上传任何文件**

## 技术栈

- Next.js 14 (App Router, RSC, SSG)
- React 18
- TypeScript
- MUI v5 (统一用 `sx`，无 Tailwind)
- Emotion (App Router 适配的 SSR cache)

## 本地开发

```bash
npm install
npm run dev        # http://localhost:3000
```

## 构建

```bash
npm run build
npm run start      # 生产模式启动
```

## 部署到 Vercel

1. 推送代码到 GitHub
2. 在 Vercel 后台 Import Project
3. Framework Preset 自动识别为 Next.js
4. 设置环境变量 `NEXT_PUBLIC_SITE_URL` 为你的线上域名
5. Deploy

> Vercel 默认会预渲染所有静态路由、生成 sitemap.xml / robots.txt / manifest.webmanifest。

## 目录结构

```
src/
  app/                       # App Router 路由
    layout.tsx               # 根布局，注入 MUI Theme + 全局 metadata
    page.tsx                 # 首页
    about/page.tsx
    tools/
      page.tsx               # 工具索引
      image-combine/page.tsx # 图片叠加
    sitemap.ts               # 动态生成 sitemap.xml
    robots.ts                # 动态生成 robots.txt
    manifest.ts              # PWA manifest
    not-found.tsx            # 404
  components/
    layout/AppShell.tsx      # Header + SideBar
  lib/
    site-config.ts           # 站点配置（SITE_URL/SITE_NAME/...）
    ThemeRegistry.tsx        # MUI + Emotion SSR 适配
  tools/
    image-combine/
      ImageCombine.tsx       # 工具主体（client component）
public/
  favicon.ico
  llms.txt                   # GEO: AI 搜索引擎入口
```

## SEO / GEO 措施

- ✅ 所有页面 SSG，搜索引擎拿到的是完整 HTML
- ✅ 每个工具页独立 `<title>`、`<description>`、Canonical、OG/Twitter Card
- ✅ 每个工具页注入 `WebApplication` JSON-LD
- ✅ `sitemap.xml` / `robots.txt` 自动生成
- ✅ `llms.txt` 为 ChatGPT / Perplexity / Kimi 等 AI 搜索引擎提供结构化站点索引
- ✅ PWA manifest + theme-color，移动端可"添加到主屏幕"

## 迁移日志

| 版本 | 框架 | 状态 |
|---|---|---|
| v0.1 (旧) | React 18 + Webpack 5 SPA | 已删除 |
| v1.0 (当前) | Next.js 14 App Router + MUI v5 | ✅ |

## License

MIT
