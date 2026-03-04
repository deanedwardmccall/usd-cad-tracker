import https from 'https';
import type { Connector, DataSourceSchema, ValidationResult } from '../types.js';

function slackGet(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'slack.com',
        path: `/api/${path}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.ok) reject(new Error(`Slack API error: ${parsed.error}`));
            else resolve(parsed);
          } catch {
            reject(new Error('Failed to parse Slack API response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

export const slackConnector: Connector = {
  name: 'Slack',
  type: 'api',
  description: 'Slack workspace (channels, messages, users)',
  status: 'stable',

  validateOptions(options: any): ValidationResult {
    const errors: string[] = [];
    if (!options.token) {
      errors.push('Provide --token <xoxb-your-bot-token>');
    }
    return { valid: errors.length === 0, errors };
  },

  async introspect(options: any): Promise<DataSourceSchema> {
    const token: string = options.token;

    // Fetch workspace info, channels, and users in parallel
    const [authInfo, channelsResp, usersResp] = await Promise.all([
      slackGet('auth.test', token),
      slackGet('conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true', token),
      slackGet('users.list?limit=200', token),
    ]);

    const workspace: string = authInfo.team;
    const channels: any[] = channelsResp.channels ?? [];
    const users: any[] = (usersResp.members ?? []).filter((u: any) => !u.deleted && !u.is_bot);

    // Model Slack as tables: channels, users, messages (virtual)
    const tables = [
      {
        name: 'channels',
        schema: workspace,
        rowCountEstimate: channels.length,
        columns: [
          { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'is_private', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'num_members', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'topic', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'purpose', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'created', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
      },
      {
        name: 'users',
        schema: workspace,
        rowCountEstimate: users.length,
        columns: [
          { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'real_name', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'email', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'is_admin', type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'tz', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
        ],
      },
      {
        name: 'messages',
        schema: workspace,
        rowCountEstimate: 0,
        columns: [
          { name: 'ts', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'channel_id', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: true,
            references: { table: 'channels', column: 'id' } },
          { name: 'user_id', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: true,
            references: { table: 'users', column: 'id' } },
          { name: 'text', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'thread_ts', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'reply_count', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false },
        ],
      },
    ];

    return {
      sourceType: 'slack',
      sourceName: workspace,
      tables,
      metadata: {
        workspace,
        teamId: authInfo.team_id,
        channelCount: channels.length,
        userCount: users.length,
        botUserId: authInfo.user_id,
        channels: channels.slice(0, 20).map((c: any) => ({
          id: c.id,
          name: c.name,
          members: c.num_members,
          private: c.is_private,
        })),
      },
    };
  },
};
