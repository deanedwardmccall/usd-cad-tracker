import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

export const stripeConnector: Connector = {
  name: 'Stripe',
  type: 'api',
  description: 'Stripe payments (customers, charges, subscriptions)',
  status: 'beta',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.apiKey) {
      errors.push('Provide --api-key <sk_test_your-key>');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    throw new Error('Stripe connector coming in Week 2 sprint.');
  },
};
