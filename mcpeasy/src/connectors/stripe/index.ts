import https from 'https';
import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

function stripeGet(path: string, apiKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        path: `/v1/${path}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(`Stripe API error: ${parsed.error.message}`));
            else resolve(parsed);
          } catch {
            reject(new Error('Failed to parse Stripe API response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Well-known Stripe object schemas
const STRIPE_OBJECTS = [
  {
    name: 'customers',
    endpoint: 'customers?limit=0',
    columns: [
      { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'email', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'name', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'phone', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'currency', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'balance', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'created', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'livemode', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'metadata', type: 'json', nullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
  },
  {
    name: 'charges',
    endpoint: 'charges?limit=0',
    columns: [
      { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'customer', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: true,
        references: { table: 'customers', column: 'id' } },
      { name: 'amount', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'currency', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'status', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'description', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'paid', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'refunded', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'created', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
    ],
  },
  {
    name: 'subscriptions',
    endpoint: 'subscriptions?limit=0',
    columns: [
      { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'customer', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: true,
        references: { table: 'customers', column: 'id' } },
      { name: 'status', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'current_period_start', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'current_period_end', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'cancel_at_period_end', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'created', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
    ],
  },
  {
    name: 'invoices',
    endpoint: 'invoices?limit=0',
    columns: [
      { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'customer', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: true,
        references: { table: 'customers', column: 'id' } },
      { name: 'subscription', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: true,
        references: { table: 'subscriptions', column: 'id' } },
      { name: 'amount_due', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'amount_paid', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'currency', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'status', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'paid', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'created', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
    ],
  },
  {
    name: 'products',
    endpoint: 'products?limit=0',
    columns: [
      { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'description', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'active', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'created', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'metadata', type: 'json', nullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
  },
];

export const stripeConnector: Connector = {
  name: 'Stripe',
  type: 'api',
  description: 'Stripe payments (customers, charges, subscriptions)',
  status: 'stable',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.apiKey) {
      errors.push('Provide --api-key <sk_test_your-key>');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    const apiKey: string = options.apiKey;

    // Verify key and fetch account + all object counts in parallel
    const [account, ...countResults] = await Promise.all([
      stripeGet('account', apiKey),
      ...STRIPE_OBJECTS.map((obj) =>
        stripeGet(obj.endpoint, apiKey)
          .then((r) => r.total_count ?? 0)
          .catch(() => 0)
      ),
    ]);

    const tables = STRIPE_OBJECTS.map((obj, i) => ({
      name: obj.name,
      schema: account.id,
      columns: obj.columns,
      rowCountEstimate: countResults[i] as number,
    }));

    return {
      sourceType: 'stripe',
      sourceName: account.business_profile?.name ?? account.id,
      tables,
      metadata: {
        accountId: account.id,
        country: account.country,
        currency: account.default_currency,
        livemode: account.charges_enabled,
      },
    };
  },
};
