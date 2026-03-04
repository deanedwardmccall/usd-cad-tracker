import { resolve } from 'path';
import { existsSync } from 'fs';
import { getConnector } from '../../connectors/registry.js';
import { generateServer } from '../../generators/server-generator.js';
import { log } from '../../utils/logger.js';

interface GenerateOptions {
  source: string;
  connectionString?: string;
  host?: string;
  port?: string;
  db?: string;
  user?: string;
  password?: string;
  file?: string;
  token?: string;
  apiKey?: string;
  output?: string;
  readOnly?: boolean;
  tables?: string;
  name?: string;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const source = options.source.toLowerCase();

  log.header(`MCPeasy — Generating ${source} MCP Server`);

  // 1. Find connector
  const connector = getConnector(source);
  if (!connector) {
    log.error(`Unknown source: ${source}`);
    log.info('Run `mcpeasy list` to see available connectors.');
    process.exit(1);
  }

  // 2. Validate options
  const validation = connector.validateOptions(options);
  if (!validation.valid) {
    log.error('Invalid options:');
    validation.errors.forEach(e => log.info(`  ${e}`));
    process.exit(1);
  }

  // 3. Set up output
  const serverName = options.name || `mcp-${source}-server`;
  const outputDir = resolve(options.output || `./${serverName}`);

  if (existsSync(outputDir)) {
    log.warn(`Output directory already exists: ${outputDir}`);
    log.info('Use --output to specify a different location, or delete the existing directory.');
    process.exit(1);
  }

  // 4. Introspect
  log.step(`Connecting to ${connector.name}...`);
  let schema;
  try {
    schema = await connector.introspect(options);
    log.success(`Found ${schema.tables.length} tables in ${schema.sourceName}`);
    schema.tables.forEach(t => {
      log.info(`  ${t.name} (${t.columns.length} columns, ~${t.rowCountEstimate} rows)`);
    });
  } catch (err: any) {
    log.error(`Failed to introspect: ${err.message}`);
    process.exit(1);
  }

  // 5. Filter tables if requested
  if (options.tables) {
    const include = options.tables.split(',').map(t => t.trim().toLowerCase());
    schema.tables = schema.tables.filter(t => include.includes(t.name.toLowerCase()));
    log.info(`Filtered to ${schema.tables.length} tables`);
  }

  // 6. Generate
  log.step('Generating MCP server...');
  try {
    await generateServer({
      outputDir,
      serverName,
      source,
      schema,
      readOnly: options.readOnly || false,
      connectorType: connector.type,
    });
    log.success('Server generated successfully!');
  } catch (err: any) {
    log.error(`Failed to generate server: ${err.message}`);
    process.exit(1);
  }

  // 7. Next steps
  log.divider();
  log.header('Your MCP server is ready!');
  log.info('');
  log.info(`  cd ${serverName}`);
  log.info('  npm install');
  log.info('  npm run build');
  log.info('');
  log.info('Then connect to Claude Desktop:');
  log.info(`  mcpeasy install ./${serverName}`);
  log.info('');
  log.info('Or test locally:');
  log.info(`  mcpeasy test ./${serverName}`);
  log.divider();
}
