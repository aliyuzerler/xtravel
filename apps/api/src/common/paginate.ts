import { Prisma } from '@prisma/client';
import { PaginatedData } from '@turizm-pazaryeri/shared';

/**
 * Standart pagination helper.
 * Tüm listeleme endpoint'leri bunu kullanır; client tarafı beklenen format:
 *   { items, meta:{ page, limit, totalItems, totalPages, hasNextPage, hasPrevPage } }
 */
export interface PaginateOptions {
  page?: number;
  limit?: number;
}

export interface PaginateConfig {
  page: number;
  limit: number;
}

export function parsePagination(opts: PaginateOptions): PaginateConfig {
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
  return { page, limit };
}

export function buildPaginatedResponse<T>(
  items: T[],
  totalItems: number,
  config: PaginateConfig,
): PaginatedData<T> {
  const totalPages = Math.ceil(totalItems / config.limit) || 1;
  return {
    items,
    meta: {
      page: config.page,
      limit: config.limit,
      totalItems,
      totalPages,
      hasNextPage: config.page < totalPages,
      hasPrevPage: config.page > 1,
    },
  };
}

/**
 * Prisma findMany + count'u tek bir paginate çağrısında yapar.
 * Kullanım:
 *   const result = await paginate(prisma.user, { where: {...} }, { page, limit });
 */
export async function paginate<
  Delegate extends {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  T,
>(
  delegate: Delegate,
  findArgs: { where?: any; orderBy?: any; include?: any; select?: any },
  opts: PaginateOptions,
): Promise<PaginatedData<T>> {
  const { page, limit } = parsePagination(opts);
  const [items, totalItems] = await Promise.all([
    delegate.findMany({
      ...findArgs,
      skip: (page - 1) * limit,
      take: limit,
    }),
    delegate.count({ where: findArgs.where }),
  ]);
  return buildPaginatedResponse(items as T[], totalItems, { page, limit });
}
