import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir, platform } from 'os';
import { log } from '../../utils/logger.js';

function getClaudeConfigPath(): string {
  const os = platform();
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (os === 'win32') {
    return join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else {
    return join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
  }
}

export async function installCommand(dir: string, options: { config?: string }): Promise<void> {
  const serverDir = resolve(dir);
  const manifestPath = join(serverDir, 'mcpeasy.json');

  if (!existsSync(manifestPath)) {
    log.error(`No mcpeasy.json found in ${serverDir}. Is this a MCPeasy-generated server?`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const configPath = options.config || getClaudeConfigPath();

  log.header('MCPeasy — Installing to Claude Desktop');
  log.step(`Server: ${manifest.name}`);
  log.step(`Config: ${configPath}`);

  // Read or create config
  let config: any = { mcpServers: {} };
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.mcpServers) config.mcpServers = {};
  } else {
    const configDir = join(configPath, '..');
    mkdirSync(configDir, { recursive: true });
  }

  // Add server entry
  config.mcpServers[manifest.name] = {
    command: 'node',
    args: [join(serverDir, 'dist', 'index.js')],
    env: {
      DATABASE_URL: 'YOUR_CONNECTION_STRING_HERE',
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  log.success(`Added "${manifest.name}" to Claude Desktop config`);
  log.info('');
  log.warn('IMPORTANT: Edit the DATABASE_URL in your Claude Desktop config:');
  log.info(`  ${configPath}`);
  log.info('');
  log.info('Then restart Claude Desktop to activate the server.');
}
