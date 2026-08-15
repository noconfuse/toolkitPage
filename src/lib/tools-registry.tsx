import * as React from 'react';
import ImageIcon from '@mui/icons-material/Image';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

export type ToolId = string;

export type ToolCategory = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
};

export type Tool = {
  id: ToolId;
  categoryId: string;
  title: string;
  shortTitle: string;
  href: string;
  description: string;
  longDescription: string;
  icon: React.ReactNode;
  available: boolean;
  keywords: string[];
  faq?: { q: string; a: string }[];
};

export const CATEGORIES: ReadonlyArray<ToolCategory> = [
  {
    id: 'image',
    label: '图片工具',
    href: '/tools/image',
    icon: <ImageIcon />,
    description: '图片叠加、压缩、转换等浏览器端处理工具。',
  },
  {
    id: 'document',
    label: '文档工具',
    href: '/tools/document',
    icon: <PictureAsPdfIcon />,
    description: 'PDF 处理、文档转换、文本提取等。',
  },
];

export const TOOLS: ReadonlyArray<Tool> = [
  {
    id: 'image-combine',
    categoryId: 'image',
    title: '图片合成器',
    shortTitle: '图片合成',
    href: '/tools/image/combine',
    description: '把多张图按不同效果合成一张，本地处理不上传。',
    longDescription:
      '在线图片合成工具，提供 11 种合成效果（默认叠加、加亮、剪贴蒙版、橡皮擦等），每一项都附带使用场景说明。可自定义画布尺寸，合成后一键下载 PNG。',
    icon: <ImageIcon />,
    available: true,
    keywords: [
      '图片合成',
      '图片叠加',
      '图片融合',
      'Canvas 混合',
      'globalCompositeOperation',
      '图片蒙版',
      '抠图',
    ],
    faq: [
      {
        q: '什么是图片合成？',
        a: '把一张图按某种视觉效果覆盖到另一张图上，例如做 LOGO 贴图、光效、抠图、剪贴蒙版等。',
      },
      {
        q: '图片会上传到服务器吗？',
        a: '不会，所有操作都在你的浏览器内完成，文件不会离开你的设备。',
      },
      {
        q: '支持哪些图片格式？',
        a: '支持 PNG、JPEG、WebP 等浏览器可解码的格式，输出统一为 PNG。',
      },
    ],
  },
  {
    id: 'pdf-stamp',
    categoryId: 'document',
    title: 'PDF 贴图',
    shortTitle: 'PDF 贴图',
    href: '/tools/document/pdf-stamp',
    description: '在 PDF 任意页面插入图片，可自由调整位置和大小后导出。',
    longDescription:
      '在线 PDF 贴图工具：上传 PDF 和图片，选择要插入的页面，在页面上画出图片插入区域，自由调整图片位置和大小后导出新的 PDF。所有处理在浏览器内完成。',
    icon: <PictureAsPdfIcon />,
    available: true,
    keywords: [
      'PDF 贴图',
      'PDF 插图',
      'PDF 加图片',
      'PDF 加水印',
      'PDF 签名',
      'PDF 印章',
    ],
    faq: [
      {
        q: 'PDF 处理会上传到服务器吗？',
        a: '不会。PDF 解析和导出都在浏览器内使用 pdf-lib 完成，文件不会离开你的设备。',
      },
      {
        q: '支持多页 PDF 吗？',
        a: '支持。可以选择任意一页贴图，导出后该页保留贴图，其它页面不变。',
      },
      {
        q: '支持哪些图片格式？',
        a: '支持 PNG、JPEG、WebP，PNG 带透明通道效果最佳。',
      },
    ],
  },
  {
    id: 'image-compress',
    categoryId: 'image',
    title: '图片压缩',
    shortTitle: '图片压缩',
    href: '/tools/image/compress',
    description: '在浏览器内压缩 PNG / JPEG / WebP，保留原始格式与尺寸，自动选择最优压缩方式。',
    longDescription:
      '在线图片压缩工具：批量上传 PNG / JPEG / WebP 图片，保留原格式与原尺寸重新编码。自动选择最优压缩方式，无需手动调参；所有处理在浏览器内完成，文件不上传。',
    icon: <ImageIcon />,
    available: true,
    keywords: [
      '图片压缩',
      '压缩图片',
      'PNG压缩',
      'JPG压缩',
      'WebP压缩',
      '本地压缩',
      '减少体积',
      'tinypng',
    ],
    faq: [
      {
        q: '图片会上传到服务器吗？',
        a: '不会，所有压缩都在你的浏览器内通过 canvas + toBlob 完成。',
      },
      {
        q: '保留原始格式吗？',
        a: '是的，PNG 输入仍输出 PNG，JPEG 输出 JPEG，WebP 输出 WebP，不会偷偷转格式。',
      },
      {
        q: '为什么压缩后体积没明显变小？',
        a: '压缩效果因图而异：已优化的图标 / 截图类图片本身空间有限，减少不明显；照片类图片通常能显著减小体积。',
      },
    ],
  },
  {
    id: 'image-convert',
    categoryId: 'image',
    title: '图片格式转换',
    shortTitle: '格式转换',
    href: '/tools/image/convert',
    description: '批量转换 PNG / JPG / WebP 格式，保持原尺寸，浏览器内完成。',
    longDescription:
      '在线图片格式转换工具：批量上传 PNG / JPG / WebP 图片，一键转换为目标格式，保持原尺寸。PNG 转 JPG 时自动填充白色背景。所有处理在浏览器内完成，文件不上传。',
    icon: <SwapHorizIcon />,
    available: true,
    keywords: [
      '图片格式转换',
      'PNG转JPG',
      'JPG转PNG',
      'WebP转换',
      '图片转格式',
      '批量转换',
    ],
    faq: [
      {
        q: '图片会上传到服务器吗？',
        a: '不会，所有转换都在你的浏览器内完成，文件不会离开你的设备。',
      },
      {
        q: '转换会改变图片尺寸吗？',
        a: '不会，转换保持原始尺寸。',
      },
      {
        q: 'PNG 转 JPG 会怎样？',
        a: 'JPG 不支持透明通道，PNG 的透明区域会填充为白色背景。',
      },
    ],
  },
  {
    id: 'qrcode-generator',
    categoryId: 'image',
    title: '二维码生成',
    shortTitle: '二维码',
    href: '/tools/image/qrcode',
    description: '输入文本或链接，实时生成二维码 PNG，可选纠错级别与尺寸。',
    longDescription:
      '在线二维码生成工具：输入文本或链接即可实时生成二维码，支持 4 档纠错级别与 3 种输出尺寸，一键下载 PNG。全部在浏览器内完成，内容不会上传。',
    icon: <QrCode2Icon />,
    available: true,
    keywords: ['二维码', '二维码生成', 'QRCode', '二维码生成器', '链接转二维码'],
    faq: [
      {
        q: '内容会上传到服务器吗？',
        a: '不会，二维码在浏览器本地生成，内容不会离开你的设备。',
      },
      {
        q: '纠错级别怎么选？',
        a: '级别越高越耐污损遮挡（如印在包装上），但可编码的内容容量越小；一般场景用默认 M 即可。',
      },
    ],
  },
  {
    id: 'pdf-image-convert',
    categoryId: 'document',
    title: '图片 ↔ PDF',
    shortTitle: '图片 PDF',
    href: '/tools/document/pdf-image-convert',
    description: '把多张图片合并成 PDF，或把 PDF 每页导出为 PNG / JPG。',
    longDescription:
      '在线图片与 PDF 互转工具：图片转 PDF 支持多图合并，可选页面尺寸与边距；PDF 转图片支持批量导出全部页面为 PNG / JPG，可自定义分辨率。所有处理在浏览器内完成。',
    icon: <PictureAsPdfIcon />,
    available: true,
    keywords: [
      '图片转PDF',
      'PDF转图片',
      '多图合并PDF',
      'PDF导出图片',
      '图片PDF互转',
      'PDF转PNG',
      'PDF转JPG',
    ],
    faq: [
      {
        q: '文件会上传到服务器吗？',
        a: '不会，所有操作都在浏览器内使用 pdfjs / pdf-lib / Canvas 完成，文件不会离开你的设备。',
      },
      {
        q: '转换速度怎样？',
        a: '图片转 PDF 几乎是即时的；PDF 转图片的耗时主要取决于 PDF 页数与所选分辨率。',
      },
    ],
  },
  {
    id: 'pdf-merge',
    categoryId: 'document',
    title: 'PDF 合并拆分',
    shortTitle: 'PDF 合并',
    href: '/tools/document/pdf-merge',
    description: '合并多个 PDF 为一个，或按页码范围将一个 PDF 拆分成多个 PDF。',
    longDescription:
      '在线 PDF 合并与拆分工具：合并模式把多个 PDF 按顺序合并为一个；拆分模式按你指定的页码范围（如 1-3, 5-8）将一个 PDF 拆成多个 PDF 并打包 ZIP 下载，支持多个区间与单个页码。全部在浏览器内完成，文件不上传。',
    icon: <PictureAsPdfIcon />,
    available: true,
    keywords: ['PDF合并', 'PDF拆分', '合并PDF', '拆分PDF', 'PDF按页拆分', 'PDF区间拆分', 'PDF提取指定页', 'PDF拼接'],
    faq: [
      {
        q: 'PDF 会上传到服务器吗？',
        a: '不会，合并与拆分都在浏览器内使用 pdf-lib 完成，文件不会离开你的设备。',
      },
      {
        q: '合并顺序怎么定？',
        a: '按你添加文件的顺序合并，先添加的在前。',
      },
      {
        q: '拆分时怎么指定页码范围？',
        a: '输入如 1-3, 5-8 的格式，每个区间会拆成一个独立的 PDF；输入单个页码（如 3）只拆这一页；输入 1-N 可将整本合并为一个 PDF。',
      },
      {
        q: '支持加密的 PDF 吗？',
        a: '支持常见的 PDF 加密，打开时自动忽略密码。',
      },
    ],
  },
  {
    id: 'image-watermark',
    categoryId: 'image',
    title: '图片加水印',
    shortTitle: '加水印',
    href: '/tools/image/watermark',
    description: '批量给图片加文字或图片水印，可调透明度、大小与位置。',
    longDescription:
      '在线图片加水印工具：批量上传图片，添加文字或图片水印，支持透明度、大小与位置设置，调整即时生效。保持原格式与原尺寸，全部在浏览器内完成，文件不上传。',
    icon: <ImageIcon />,
    available: true,
    keywords: ['图片加水印', '水印', '文字水印', '图片水印', '批量水印', '版权水印'],
    faq: [
      {
        q: '图片会上传到服务器吗？',
        a: '不会，水印处理全部在浏览器内使用 Canvas 完成，文件不会离开你的设备。',
      },
      {
        q: '会改变原图吗？',
        a: '不会，输出保持原尺寸与格式，原文件保持不变。',
      },
    ],
  },
  {
    id: 'image-remove-watermark',
    categoryId: 'image',
    title: '图片去水印',
    shortTitle: '去水印',
    href: '/tools/image/remove-watermark',
    description: '画笔涂抹水印区域，AI 在浏览器内重建被遮挡的像素，纯浏览器处理。',
    longDescription:
      '在线图片去水印工具：上传图片后用画笔涂抹水印区域，AI 会根据周围内容重建被遮挡的部分。支持拖动分割线对比处理前后效果，也可继续涂抹补充修复，一键下载 PNG。所有处理在浏览器内完成，文件不上传。',
    icon: <ImageIcon />,
    available: true,
    keywords: [
      '图片去水印',
      '去水印',
      '去水印工具',
      '去除水印',
      'AI去水印',
      '半透明水印去除',
      '文字水印去除',
      'logo水印去除',
    ],
    faq: [
      {
        q: '图片会上传到服务器吗？',
        a: '不会，所有处理都在浏览器内完成，文件不会离开你的设备。',
      },
      {
        q: '能去除所有水印吗？',
        a: '适合半透明文字或 logo 水印：用画笔涂抹水印区域后，AI 会用周围的内容把它重建掉。对大面积、与背景深度融合的水印效果有限。',
      },
      {
        q: '为什么第一次使用要等一会儿？',
        a: '首次使用需要下载并准备修复能力，加载完成后会保留在本地，之后使用会快很多。',
      },
    ],
  },
  {
    id: 'image-background-replace',
    categoryId: 'image',
    title: '图片去背景',
    shortTitle: '去背景',
    href: '/tools/image/background-replace',
    description: 'AI 自动识别主体并生成透明背景 PNG，下载后可叠到任意背景图上。',
    longDescription:
      '在线图片去背景工具：上传图片后 AI 自动识别主体并生成带透明通道的 PNG 抠图。常见人像、商品、物体均可精准抠图，毛发和半透明边缘也是处理重点。下载 PNG 后可到「图片合成」工具叠加到任意背景图上。所有处理在浏览器内完成，文件不上传。',
    icon: <AutoFixHighIcon />,
    available: true,
    keywords: [
      '图片去背景',
      '去背景',
      '抠图',
      'AI抠图',
      '背景移除',
      '透明背景',
      '图片背景',
      '主体识别',
    ],
    faq: [
      {
        q: '图片会上传到服务器吗？',
        a: '不会，所有处理都在浏览器内完成，文件不会离开你的设备。',
      },
      {
        q: '抠图后怎么换背景？',
        a: '下载带透明通道的 PNG 后，到「图片合成」工具把它叠加到任意背景图上即可，纯色、模糊、上传图片都可以。',
      },
      {
        q: '主体识别准确吗？',
        a: '对常见的商品、人像、物体效果都不错。毛发和半透明边缘也是处理重点。复杂背景或主体与背景颜色相近时可能需要手动调整。',
      },
      {
        q: '首次使用为什么慢？',
        a: '首次需要下载识别模型（约 40MB），下载完后会保留在本地，之后使用会秒开。',
      },
    ],
  },
];

export const TOOLS_BY_CATEGORY: ReadonlyArray<{
  category: ToolCategory;
  tools: ReadonlyArray<Tool>;
}> = CATEGORIES.map((category) => ({
  category,
  tools: TOOLS.filter((t) => t.categoryId === category.id),
}));

export function getToolByHref(href: string): Tool | undefined {
  return TOOLS.find((t) => t.href === href);
}

export function getCategoryByHref(href: string): ToolCategory | undefined {
  return CATEGORIES.find((c) => c.href === href);
}