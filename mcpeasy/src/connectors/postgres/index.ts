import pg from 'pg';
import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

const { Client } = pg;

function buildConnectionConfig(options: any): pg.ClientConfig {
  if (options.connectionString) {
    return { connectionString: options.connectionString };
  }
  return {
    host: options.host || 'localhost',
    port: parseInt(options.port || '5432'),
    database: options.db,
    user: options.user,
    password: options.password,
  };
}

export const postgresConnector: Connector = {
  name: 'PostgreSQL',
  type: 'database',
  description: 'PostgreSQL relational database',
  status: 'stable',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.connectionString && !options.db) {
      errors.push('Provide --connection-string or --db (with optional --host, --port, --user, --password)');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    const config = buildConnectionConfig(options);
    const client = new Client(config);

    try {
      await client.connect();

      // Get all tables in public schema
      const tablesResult = await client.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables = [];

      for (const row of tablesResult.rows) {
        // Get columns with full metadata
        const colsResult = await client.query(`
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
            fk.foreign_table_name,
            fk.foreign_column_name
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.table_name = $1
              AND tc.constraint_type = 'PRIMARY KEY'
          ) pk ON c.column_name = pk.column_name
          LEFT JOIN (
            SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = $1
              AND tc.constraint_type = 'FOREIGN KEY'
          ) fk ON c.column_name = fk.column_name
          WHERE c.table_name = $1
            AND c.table_schema = 'public'
          ORDER BY c.ordinal_position
        `, [row.table_name]);

        const columns = colsResult.rows.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          isPrimaryKey: col.is_primary_key,
          isForeignKey: !!col.foreign_table_name,
          references: col.foreign_table_name ? {
            table: col.foreign_table_name,
            column: col.foreign_column_name,
          } : undefined,
          defaultValue: col.column_default || undefined,
        }));

        // Get row count estimate
        const countResult = await client.query(`
          SELECT reltuples::bigint AS estimate
          FROM pg_class
          WHERE relname = $1
        `, [row.table_name]);

        tables.push({
          name: row.table_name,
          schema: row.table_schema,
          columns,
          rowCountEstimate: parseInt(countResult.rows[0]?.estimate || '0'),
        });
      }

      // Get database name
      const dbResult = await client.query('SELECT current_database()');

      return {
        sourceType: 'postgres',
        sourceName: dbResult.rows[0].current_database,
        tables,
        metadata: {
          version: (await client.query('SELECT version()')).rows[0].version,
          tableCount: tables.length,
        },
      };
    } finally {
      await client.end();
    }
  },
};
