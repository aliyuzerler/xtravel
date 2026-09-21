import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'as-needed',
});

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Next.js internals (/_next, /_vercel)
  // - Static files (images, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
