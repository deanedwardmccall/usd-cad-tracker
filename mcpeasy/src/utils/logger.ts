const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';

export const log = {
  header(msg: string) {
    console.log(`\n${BOLD}${CYAN}${msg}${RESET}\n`);
  },
  step(msg: string) {
    console.log(`${BLUE}→${RESET} ${msg}`);
  },
  success(msg: string) {
    console.log(`${GREEN}✓${RESET} ${msg}`);
  },
  warn(msg: string) {
    console.log(`${YELLOW}⚠${RESET} ${msg}`);
  },
  error(msg: string) {
    console.log(`${RED}✗${RESET} ${msg}`);
  },
  info(msg: string) {
    console.log(`  ${msg}`);
  },
  dim(msg: string) {
    console.log(`${DIM}${msg}${RESET}`);
  },
  divider() {
    console.log(`${DIM}${'─'.repeat(50)}${RESET}`);
  },
};
