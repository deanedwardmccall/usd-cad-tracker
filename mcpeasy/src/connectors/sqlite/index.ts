import Database from 'better-sqlite3';
import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

export const sqliteConnector: Connector = {
  name: 'SQLite',
  type: 'database',
  description: 'SQLite file-based database',
  status: 'stable',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.file) {
      errors.push('Provide --file <path> to your SQLite database file');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    const db = new Database(options.file, { readonly: true });

    try {
      // Get all user tables (exclude sqlite internal tables)
      const tableRows = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const tables = [];

      for (const { name: tableName } of tableRows) {
        // PRAGMA table_info gives columns with PK flag
        const pragmaRows = db.prepare(`PRAGMA table_info(${JSON.stringify(tableName)})`).all() as Array<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }>;

        // PRAGMA foreign_key_list gives FK info
        const fkRows = db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(tableName)})`).all() as Array<{
          from: string;
          table: string;
          to: string;
        }>;

        const fkMap = new Map<string, { table: string; column: string }>();
        for (const fk of fkRows) {
          fkMap.set(fk.from, { table: fk.table, column: fk.to });
        }

        const columns = pragmaRows.map((col) => {
          const fk = fkMap.get(col.name);
          return {
            name: col.name,
            type: col.type || 'TEXT',
            nullable: col.notnull === 0 && col.pk === 0,
            isPrimaryKey: col.pk > 0,
            isForeignKey: !!fk,
            references: fk,
            defaultValue: col.dflt_value ?? undefined,
          };
        });

        // Row count (exact — SQLite is fast)
        const countRow = db.prepare(`SELECT COUNT(*) AS cnt FROM ${JSON.stringify(tableName)}`).get() as { cnt: number };

        tables.push({
          name: tableName,
          schema: 'main',
          columns,
          rowCountEstimate: countRow.cnt,
        });
      }

      // SQLite version
      const versionRow = db.prepare('SELECT sqlite_version() AS v').get() as { v: string };

      // Database file name as source name
      const sourceName = options.file.split('/').pop()?.replace(/\.sqlite3?$/, '') ?? options.file;

      return {
        sourceType: 'sqlite',
        sourceName,
        tables,
        metadata: {
          version: versionRow.v,
          tableCount: tables.length,
          file: options.file,
        },
      };
    } finally {
      db.close();
    }
  },
};
