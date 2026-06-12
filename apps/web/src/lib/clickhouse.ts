import { createClient } from '@clickhouse/client';

export const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'grindup',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'grindup',
});

export async function initClickHouse() {
    await clickhouse.exec({
        query: `
            CREATE TABLE IF NOT EXISTS problems_vec (
                id String,
                title String,
                content String,
                difficulty String,
                embedding Array(Float32),
                created_at DateTime DEFAULT now()
            )
            ENGINE = MergeTree()
            ORDER BY id
        `
    });

    try {
        await clickhouse.exec({
            query: `ALTER TABLE problems_vec ADD INDEX IF NOT EXISTS vec_idx (embedding) TYPE hnsw() GRANULARITY 3`
        });
    } catch (e) {
        console.warn("HNSW Index creation failed:", e);
    }
}

export async function initImportSourcesTable() {
    await clickhouse.exec({
        query: `
            CREATE TABLE IF NOT EXISTS import_sources (
                id String,
                user_id String,
                subject_name String,
                source_type String,
                source_url String,
                created_at DateTime DEFAULT now()
            )
            ENGINE = MergeTree()
            ORDER BY id
        `
    });
}
