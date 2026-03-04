import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

export const sqliteConnector: Connector = {
  name: 'SQLite',
  type: 'database',
  description: 'SQLite file-based database',
  status: 'beta',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.file) {
      errors.push('Provide --file <path> to your SQLite database file');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    throw new Error('SQLite introspection coming in Day 6 sprint. Use postgres for now.');
  },
};
