import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { log } from '../../utils/logger.js';

export async function doctorCommand(): Promise<void> {
  log.header('MCPeasy — Environment Check');
  let allGood = true;

  // Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (major >= 18) {
    log.success(`Node.js ${nodeVersion} ✓`);
  } else {
    log.error(`Node.js ${nodeVersion} — MCPeasy requires Node 18+`);
    allGood = false;
  }

  // npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    log.success(`npm ${npmVersion} ✓`);
  } catch {
    log.error('npm not found');
    allGood = false;
  }

  // TypeScript
  try {
    const tsVersion = execSync('npx tsc --version', { encoding: 'utf-8' }).trim();
    log.success(`${tsVersion} ✓`);
  } catch {
    log.warn('TypeScript not found globally (will use local)');
  }

  // Claude Desktop config
  const os = platform();
  let configPath: string;
  if (os === 'darwin') {
    configPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (os === 'win32') {
    configPath = join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else {
    configPath = join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
  }

  if (existsSync(configPath)) {
    log.success(`Claude Desktop config found at ${configPath} ✓`);
  } else {
    log.warn(`Claude Desktop config not found at ${configPath}`);
    log.info('  This is fine — mcpeasy install will create it.');
  }

  // Summary
  log.divider();
  if (allGood) {
    log.success("All checks passed! You're ready to generate MCP servers.");
  } else {
    log.warn('Some checks failed. Fix the issues above before proceeding.');
  }
}
