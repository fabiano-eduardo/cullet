import type { TemporalSnapshot } from '../../domain/temporal';

import type { Repository } from './repository.port';

type TemporalHistory<TEntity> = readonly TemporalSnapshot<TEntity>[];

interface TemporalRepository<TEntity, TId> extends Repository<TEntity, TId> {
	findAsOf(id: TId, asOf: Date): Promise<TEntity | null>;
	findAtTransaction(id: TId, txTime: Date): Promise<TEntity | null>;
	findHistory(id: TId): Promise<TemporalHistory<TEntity>>;
	save(entity: TEntity, validFrom?: Date): Promise<void>;
}

export type { TemporalHistory, TemporalRepository };
