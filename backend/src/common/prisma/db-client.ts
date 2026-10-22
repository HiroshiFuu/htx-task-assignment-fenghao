import type { Prisma } from '../../generated/prisma/client';

/** Repositories accept either the root client or an interactive transaction client. */
export type DbClient = Prisma.TransactionClient;
