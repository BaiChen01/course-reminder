const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '..', 'dist-electron');
const root = path.resolve(__dirname, '..');
if (path.dirname(output) !== root || path.basename(output) !== 'dist-electron') {
  throw new Error('拒绝清理预期目录之外的路径');
}
fs.rmSync(output, { recursive: true, force: true });
