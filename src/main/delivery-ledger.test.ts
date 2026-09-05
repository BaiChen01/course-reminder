import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DeliveryLedger } from './delivery-ledger';

const tempDirs: string[] = [];
afterEach(async () => Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))));

describe('提醒投递记录', () => {
  it('重启后保持渠道去重状态', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-ledger-'));
    tempDirs.push(dir);
    const ledger = new DeliveryLedger(dir);
    await ledger.load();
    await ledger.mark('local', 'course:date:time');
    await ledger.mark('wechat', 'date:time');
    const restored = new DeliveryLedger(dir);
    await restored.load();
    expect(restored.has('local', 'course:date:time')).toBe(true);
    expect(restored.has('wechat', 'date:time')).toBe(true);
  });

  it('清理超过保留期的记录', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-ledger-'));
    tempDirs.push(dir);
    const ledger = new DeliveryLedger(dir, 7);
    await ledger.load();
    await ledger.mark('wechat', 'old', new Date('2026-01-01T00:00:00Z'));
    await ledger.prune(new Date('2026-01-10T00:00:00Z'));
    expect(ledger.has('wechat', 'old')).toBe(false);
  });
});
