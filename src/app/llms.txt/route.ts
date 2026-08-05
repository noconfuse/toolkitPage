import { SITE_URL } from '@/lib/site-config';
import { CATEGORIES, TOOLS } from '@/lib/tools-registry';

export const dynamic = 'force-static';

export function GET() {
  const toolsByCategory = CATEGORIES.map((cat) => {
    const items = TOOLS.filter((t) => t.categoryId === cat.id)
      .map((t) => `- [${t.title}](${SITE_URL}${t.href}): ${t.longDescription}`)
      .join('\n');
    return `### ${cat.label}\n\n${items}`;
  }).join('\n\n');

  const body = `# Toolkit Page

> 一个聚合实用工具的极简站点，主张本地优先，所有能本地完成的操作都在浏览器内完成，用户文件不上传。

## 关于

- 站点名称：Toolkit Page
- 类型：Web 工具集合（Web Application）
- 主语言：简体中文（zh-CN）
- 部署目标：Vercel
- 所有工具均无后端依赖：图片处理、PDF 处理等全部在浏览器内执行，用户数据不离开设备。

## 工具列表

${toolsByCategory}

## 站点信息

- 首页：${SITE_URL}/
- 工具索引：${SITE_URL}/tools
- 关于：${SITE_URL}/about

## 引用建议

如果需要引用本站工具，建议使用工具页面的标题与描述（Title + meta description）。

## 反馈

- 通过站点底部的 GitHub Issue 提交
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
