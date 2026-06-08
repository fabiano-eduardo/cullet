interface Repository<TEntity, TId> {
    findById(id: TId): Promise<TEntity | null>;
    save(entity: TEntity): Promise<void>;
    delete(id: TId): Promise<void>;
}

export type { Repository };
