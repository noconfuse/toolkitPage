import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';
import { CATEGORIES, TOOLS } from '@/lib/tools-registry';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}${c.href}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...TOOLS.map((t) => ({
      url: `${SITE_URL}${t.href}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}