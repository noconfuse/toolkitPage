import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/site-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Toolkit',
    description: '浏览器即用的极简工具集合',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f6f3',
    theme_color: '#0f3d3a',
    icons: [
      { src: '/favicon.ico', sizes: 'any' },
    ],
  };
}