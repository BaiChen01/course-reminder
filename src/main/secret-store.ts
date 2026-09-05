import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WechatDeliveryResult, WechatStatus } from '../shared/types';

export interface SecretProtector {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface SecretFile {
  version: 1;
  wechat?: {
    encryptedSendKey: string;
    maskedKey: string;
    fingerprint: string;
    testedFingerprint?: string;
    lastResult?: WechatDeliveryResult;
  };
}

export function validateSendKey(sendKey: string): string {
  const clean = sendKey.trim();
  if (!/^SCT[A-Za-z0-9_-]{8,}$/.test(clean)) {
    throw new Error('请输入有效的 Server酱 Turbo SendKey（必须以 SCT 开头）');
  }
  return clean;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function mask(value: string): string {
  return `SCT••••${value.slice(-4)}`;
}

export class SecretStore {
  private data: SecretFile = { version: 1 };
  private readonly filePath: string;

  constructor(userDataPath: string, private readonly protector: SecretProtector) {
    this.filePath = path.join(userDataPath, 'secrets.json');
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as SecretFile;
      this.data = parsed?.version === 1 ? parsed : { version: 1 };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        await fs.rename(this.filePath, `${this.filePath}.invalid-${Date.now()}`).catch(() => undefined);
      }
      this.data = { version: 1 };
    }
  }

  getStatus(enabled: boolean): WechatStatus {
    const item = this.data.wechat;
    return {
      enabled,
      configured: Boolean(item),
      maskedKey: item?.maskedKey,
      testPassed: Boolean(item && item.testedFingerprint === item.fingerprint),
      lastResult: item?.lastResult,
    };
  }

  async saveKey(sendKey: string): Promise<void> {
    const clean = validateSendKey(sendKey);
    if (!this.protector.isEncryptionAvailable()) throw new Error('当前系统无法安全加密 SendKey，已拒绝明文保存');
    this.data.wechat = {
      encryptedSendKey: this.protector.encryptString(clean).toString('base64'),
      maskedKey: mask(clean),
      fingerprint: fingerprint(clean),
      lastResult: { ok: false, message: '新密钥尚未发送测试消息', at: new Date().toISOString() },
    };
    await this.persist();
  }

  getKey(): string | undefined {
    const item = this.data.wechat;
    if (!item || !this.protector.isEncryptionAvailable()) return undefined;
    try {
      return this.protector.decryptString(Buffer.from(item.encryptedSendKey, 'base64'));
    } catch {
      return undefined;
    }
  }

  async setLastResult(result: WechatDeliveryResult, markTestPassed = false): Promise<void> {
    if (!this.data.wechat) return;
    this.data.wechat.lastResult = result;
    if (markTestPassed && result.ok) this.data.wechat.testedFingerprint = this.data.wechat.fingerprint;
    await this.persist();
  }

  async clear(): Promise<void> {
    delete this.data.wechat;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }
}
