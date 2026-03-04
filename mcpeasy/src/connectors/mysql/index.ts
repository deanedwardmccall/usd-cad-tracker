import mysql from 'mysql2/promise';
import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

function buildConnectionConfig(options: any): mysql.ConnectionOptions {
  if (options.connectionString) {
    return { uri: options.connectionString };
  }
  return {
    host: options.host || 'localhost',
    port: parseInt(options.port || '3306'),
    database: options.db,
    user: options.user,
    password: options.password,
  };
}

export const mysqlConnector: Connector = {
  name: 'MySQL',
  type: 'database',
  description: 'MySQL relational database',
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
    const conn = await mysql.createConnection(config);

    try {
      const [dbRows] = await conn.query<mysql.RowDataPacket[]>('SELECT DATABASE() AS db');
      const dbName: string = dbRows[0].db;

      const [tableRows] = await conn.query<mysql.RowDataPacket[]>(`
        SELECT TABLE_NAME AS table_name
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);

      const tables = [];

      for (const tableRow of tableRows) {
        const tableName: string = tableRow.table_name;

        const [colRows] = await conn.query<mysql.RowDataPacket[]>(`
          SELECT
            c.COLUMN_NAME                   AS column_name,
            c.DATA_TYPE                     AS data_type,
            c.IS_NULLABLE                   AS is_nullable,
            c.COLUMN_DEFAULT                AS column_default,
            c.COLUMN_KEY                    AS column_key,
            kcu.REFERENCED_TABLE_NAME       AS foreign_table_name,
            kcu.REFERENCED_COLUMN_NAME      AS foreign_column_name
          FROM information_schema.COLUMNS c
          LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
            ON  kcu.TABLE_SCHEMA            = c.TABLE_SCHEMA
            AND kcu.TABLE_NAME              = c.TABLE_NAME
            AND kcu.COLUMN_NAME             = c.COLUMN_NAME
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
          WHERE c.TABLE_SCHEMA = DATABASE()
            AND c.TABLE_NAME   = ?
          ORDER BY c.ORDINAL_POSITION
        `, [tableName]);

        const columns = colRows.map((col) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          isPrimaryKey: col.column_key === 'PRI',
          isForeignKey: !!col.foreign_table_name,
          references: col.foreign_table_name ? {
            table: col.foreign_table_name,
            column: col.foreign_column_name,
          } : undefined,
          defaultValue: col.column_default ?? undefined,
        }));

        const [countRows] = await conn.query<mysql.RowDataPacket[]>(`
          SELECT TABLE_ROWS AS estimate
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [tableName]);

        tables.push({
          name: tableName,
          schema: dbName,
          columns,
          rowCountEstimate: parseInt(countRows[0]?.estimate ?? '0'),
        });
      }

      const [versionRows] = await conn.query<mysql.RowDataPacket[]>('SELECT VERSION() AS v');

      return {
        sourceType: 'mysql',
        sourceName: dbName,
        tables,
        metadata: {
          version: versionRows[0].v,
          tableCount: tables.length,
        },
      };
    } finally {
      await conn.end();
    }
  },
};
