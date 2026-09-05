import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataStore } from './store';

const tempDirs: string[] = [];
afterEach(async () => Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))));

describe('本地数据存储', () => {
  it('新增、更新、删除并可在重启后恢复', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-reminder-'));
    tempDirs.push(dir);
    const store = new DataStore(dir);
    await store.load();
    const added = await store.addCourse({
      code: 'C01', name: '思政课', className: '一班', teacher: '张老师', location: 'D208', weekday: 1,
      startPeriod: 1, endPeriod: 2, weeks: [1, 2], color: '#dceef8', reminderEnabled: true,
    });
    await store.updateCourse({ ...added, location: 'D209' });
    const restored = new DataStore(dir);
    await restored.load();
    expect(restored.listCourses()[0].location).toBe('D209');
    await restored.deleteCourse(added.id);
    expect(restored.listCourses()).toHaveLength(0);
  });

  it('缩短学期时裁剪周次并删除无剩余周次的课程', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-reminder-'));
    tempDirs.push(dir);
    const store = new DataStore(dir);
    await store.load();
    const input = { code: '', className: '', teacher: '', location: '', weekday: 1, startPeriod: 1, endPeriod: 1, color: '#dceef8', reminderEnabled: true };
    await store.addCourse({ ...input, name: '保留', weeks: [2, 12] });
    await store.addCourse({ ...input, name: '删除', weeks: [15] });
    await store.saveSettings({ ...store.getSettings(), totalWeeks: 10 });
    expect(store.listCourses()).toEqual([expect.objectContaining({ name: '保留', weeks: [2] })]);
  });

  it('升级版本 1 数据并保留课程和原始备份', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-reminder-'));
    tempDirs.push(dir);
    const seed = new DataStore(dir);
    await seed.load();
    const legacySettings = structuredClone(seed.getSettings()) as unknown as Record<string, unknown>;
    delete legacySettings.wechat;
    const legacy = {
      version: 1,
      settings: legacySettings,
      courses: [{ id: 'legacy', code: '', name: '旧课程', className: '', teacher: '', location: '', weekday: 1, startPeriod: 1, endPeriod: 2, weeks: [1], color: '#dceef8', reminderEnabled: true }],
    };
    await fs.writeFile(path.join(dir, 'schedule.json'), JSON.stringify(legacy), 'utf8');
    const upgraded = new DataStore(dir);
    await upgraded.load();
    expect(upgraded.getData().version).toBe(2);
    expect(upgraded.listCourses()[0].name).toBe('旧课程');
    expect(upgraded.getSettings().wechat.enabled).toBe(false);
    expect(JSON.parse(await fs.readFile(path.join(dir, 'schedule.v1.backup.json'), 'utf8')).version).toBe(1);
  });
});
