const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/provider', '/profile', '/checkout'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
