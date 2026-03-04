import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

export const slackConnector: Connector = {
  name: 'Slack',
  type: 'api',
  description: 'Slack workspace (channels, messages, users)',
  status: 'beta',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.token) {
      errors.push('Provide --token <xoxb-your-bot-token>');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    throw new Error('Slack connector coming in Week 2 sprint.');
  },
};
