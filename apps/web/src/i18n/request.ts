import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

const locales = ['tr', 'en'] as const;
type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();
  return {
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
