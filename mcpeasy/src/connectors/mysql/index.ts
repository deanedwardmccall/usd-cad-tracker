import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

export const mysqlConnector: Connector = {
  name: 'MySQL',
  type: 'database',
  description: 'MySQL relational database',
  status: 'beta',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.connectionString && !options.db) {
      errors.push('Provide --connection-string or --db (with optional --host, --port, --user, --password)');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    throw new Error('MySQL introspection coming in Day 6 sprint. Use postgres for now.');
  },
};
