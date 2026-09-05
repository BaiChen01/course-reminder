import { promises as fs } from 'node:fs';
import path from 'node:path';

interface LedgerFile { version: 1; entries: Record<string, string>; }

export class DeliveryLedger {
  private data: LedgerFile = { version: 1, entries: {} };
  private readonly filePath: string;

  constructor(userDataPath: string, private readonly retentionDays = 7) {
    this.filePath = path.join(userDataPath, 'delivery-history.json');
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as LedgerFile;
      this.data = parsed?.version === 1 && parsed.entries ? parsed : { version: 1, entries: {} };
    } catch {
      this.data = { version: 1, entries: {} };
    }
    await this.prune();
  }

  has(channel: 'local' | 'wechat', key: string): boolean {
    return Boolean(this.data.entries[`${channel}:${key}`]);
  }

  keys(channel: 'local' | 'wechat'): Set<string> {
    const prefix = `${channel}:`;
    return new Set(Object.keys(this.data.entries).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)));
  }

  async mark(channel: 'local' | 'wechat', key: string, at = new Date()): Promise<void> {
    this.data.entries[`${channel}:${key}`] = at.toISOString();
    await this.persist();
  }

  async prune(now = new Date()): Promise<void> {
    const threshold = now.getTime() - this.retentionDays * 86_400_000;
    this.data.entries = Object.fromEntries(Object.entries(this.data.entries).filter(([, value]) => {
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) && timestamp >= threshold;
    }));
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }
}
