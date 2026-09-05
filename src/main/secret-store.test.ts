import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SecretStore, validateSendKey, type SecretProtector } from './secret-store';

const tempDirs: string[] = [];
afterEach(async () => Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))));

const protector: SecretProtector = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`),
  decryptString: (value) => value.toString().replace(/^encrypted:/, ''),
};

describe('微信密钥安全存储', () => {
  it('仅接受 SCT 开头的 Turbo SendKey', () => {
    expect(validateSendKey('SCTabcdefgh1234')).toBe('SCTabcdefgh1234');
    expect(() => validateSendKey('sctp123tabcdefgh')).toThrow(/SCT/);
    expect(() => validateSendKey('invalid')).toThrow(/SCT/);
  });

  it('只落盘密文并在更换密钥后重置测试状态', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-secret-'));
    tempDirs.push(dir);
    const store = new SecretStore(dir, protector);
    await store.load();
    await store.saveKey('SCTabcdefgh1234');
    const raw = await fs.readFile(path.join(dir, 'secrets.json'), 'utf8');
    expect(raw).not.toContain('SCTabcdefgh1234');
    expect(store.getStatus(false)).toMatchObject({ configured: true, testPassed: false, maskedKey: 'SCT••••1234' });
    await store.setLastResult({ ok: true, message: '测试成功', at: new Date().toISOString() }, true);
    expect(store.getStatus(false).testPassed).toBe(true);
    await store.saveKey('SCTnewvalue5678');
    expect(store.getStatus(false).testPassed).toBe(false);
    await store.clear();
    expect(store.getStatus(false).configured).toBe(false);
  });

  it('加密不可用时拒绝保存', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-secret-'));
    tempDirs.push(dir);
    const store = new SecretStore(dir, { ...protector, isEncryptionAvailable: () => false });
    await expect(store.saveKey('SCTabcdefgh1234')).rejects.toThrow(/拒绝明文保存/);
  });
});
