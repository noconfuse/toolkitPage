import { SITE_URL } from '@/lib/site-config';

export type Crumb = { name: string; href: string };

/** 生成 BreadcrumbList 结构化数据（首页 > 分类 > 工具），用于 SEO / GEO。 */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.href}`,
    })),
  };
}
