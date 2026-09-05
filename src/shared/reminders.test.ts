import { describe, expect, it } from 'vitest';
import type { AppSettings, Course } from './types';
import { findDueReminders, findUpcomingReminders, groupRemindersByStart } from './reminders';

const settings: AppSettings = {
  firstWeekMonday: '2026-09-07', totalWeeks: 20, defaultReminderMinutes: 15,
  periods: Array.from({ length: 12 }, (_, index) => ({ period: index + 1, start: index === 0 ? '08:00' : '10:00', end: index === 0 ? '08:45' : '10:45' })),
  wechat: { enabled: false },
};
const baseCourse: Course = {
  id: 'course-1', code: '', name: '高等数学', className: '', teacher: '', location: 'A101',
  weekday: 1, startPeriod: 1, endPeriod: 2, weeks: [1], color: '#dceef8', reminderEnabled: true,
};

describe('提醒判断', () => {
  it('在提醒窗口内返回一次待提醒课程', () => {
    const now = new Date(2026, 8, 7, 7, 50);
    const due = findDueReminders(now, [baseCourse], settings, new Set());
    expect(due).toHaveLength(1);
    expect(due[0].leadMinutes).toBe(15);
    expect(findDueReminders(now, [baseCourse], settings, new Set([due[0].key]))).toHaveLength(0);
  });

  it('尚未到提醒时间或课程已开始时不提醒', () => {
    expect(findDueReminders(new Date(2026, 8, 7, 7, 40), [baseCourse], settings, new Set())).toHaveLength(0);
    expect(findDueReminders(new Date(2026, 8, 7, 8, 1), [baseCourse], settings, new Set())).toHaveLength(0);
  });

  it('支持课程覆盖提醒并忽略非上课周和关闭提醒', () => {
    const custom = { ...baseCourse, reminderMinutes: 30 };
    expect(findDueReminders(new Date(2026, 8, 7, 7, 35), [custom], settings, new Set())).toHaveLength(1);
    expect(findDueReminders(new Date(2026, 8, 14, 7, 50), [baseCourse], settings, new Set())).toHaveLength(0);
    expect(findDueReminders(new Date(2026, 8, 7, 7, 50), [{ ...baseCourse, reminderEnabled: false }], settings, new Set())).toHaveLength(0);
  });

  it('将同一开始时间的课程合并为一组', () => {
    const now = new Date(2026, 8, 7, 7, 50);
    const due = findDueReminders(now, [baseCourse, { ...baseCourse, id: 'course-2', name: '线性代数' }], settings, new Set());
    const groups = groupRemindersByStart(due);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0]).toHaveLength(2);
  });

  it('同一开始时间采用最早提醒并包含尚未到自身提醒时间的冲突课程', () => {
    const now = new Date(2026, 8, 7, 7, 35);
    const early = { ...baseCourse, reminderMinutes: 30 };
    const normal = { ...baseCourse, id: 'course-2', name: '线性代数' };
    const due = findDueReminders(now, [early, normal], settings, new Set());
    const upcoming = findUpcomingReminders(now, [early, normal], settings);
    expect(due).toHaveLength(1);
    expect([...groupRemindersByStart(due, upcoming).values()][0]).toHaveLength(2);
  });
});
