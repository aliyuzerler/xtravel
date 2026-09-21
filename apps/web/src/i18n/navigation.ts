import { createSharedPathnamesNavigation } from 'next-intl/navigation';

export const locales = ['tr', 'en'] as const;
export const localePrefix = 'as-needed';
export const defaultLocale = 'tr';

export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation({ locales, localePrefix });
