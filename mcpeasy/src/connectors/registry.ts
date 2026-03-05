import type { Connector } from './types.js';
import { postgresConnector } from './postgres/index.js';
import { mysqlConnector } from './mysql/index.js';
import { sqliteConnector } from './sqlite/index.js';
import { slackConnector } from './slack/index.js';
import { stripeConnector } from './stripe/index.js';

export const connectorRegistry: Record<string, Connector> = {
  postgres: postgresConnector,
  mysql: mysqlConnector,
  sqlite: sqliteConnector,
  slack: slackConnector,
  stripe: stripeConnector,
};

// Coming soon placeholders (shown in `list` command)
export const comingSoon: Record<string, { name: string; description: string }> = {
  mongodb: { name: 'MongoDB', description: 'MongoDB document database' },
  jira: { name: 'Jira', description: 'Atlassian Jira (issues, projects)' },
  hubspot: { name: 'HubSpot', description: 'HubSpot CRM (contacts, deals)' },
  github: { name: 'GitHub', description: 'GitHub (repos, issues, PRs)' },
  linear: { name: 'Linear', description: 'Linear (issues, projects, cycles)' },
  airtable: { name: 'Airtable', description: 'Airtable bases and tables' },
  sheets: { name: 'Google Sheets', description: 'Google Sheets spreadsheets' },
};

export function getConnector(source: string): Connector | undefined {
  return connectorRegistry[source.toLowerCase()];
}
