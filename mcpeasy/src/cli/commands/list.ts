import { connectorRegistry, comingSoon } from '../../connectors/registry.js';
import { log } from '../../utils/logger.js';

export async function listCommand(): Promise<void> {
  log.header('MCPeasy — Available Connectors');
  log.info('');

  for (const [key, connector] of Object.entries(connectorRegistry)) {
    const icon = connector.status === 'stable' ? '✅' :
                 connector.status === 'beta' ? '⚠️ ' : '🔜';
    const label = connector.status === 'stable' ? 'Stable' :
                  connector.status === 'beta' ? 'Beta' : 'Coming Soon';

    log.info(`  ${icon} ${connector.name.padEnd(15)} ${label.padEnd(12)} mcpeasy generate --source ${key}`);
  }

  log.info('');
  log.dim('  Coming soon:');
  for (const [key, info] of Object.entries(comingSoon)) {
    log.info(`  🔜 ${info.name.padEnd(15)} ${'Planned'.padEnd(12)} ${info.description}`);
  }

  log.info('');
  log.divider();
}
