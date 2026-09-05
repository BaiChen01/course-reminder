import { describe, expect, it } from 'vitest';
import type { Course } from './types';
import { coursesForWeek, coursesOverlap, getWeekNumber, layoutCourses, normalizeWeeks, weeksFromRange } from './schedule';

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'a', code: '', name: '测试课程', className: '', teacher: '', location: '', weekday: 1,
    startPeriod: 1, endPeriod: 2, weeks: [1, 2, 3], color: '#dceef8', reminderEnabled: true,
    ...overrides,
  };
}

describe('周数计算', () => {
  it('识别开学前、第一周、跨月和学期结束', () => {
    expect(getWeekNumber(new Date(2026, 8, 6), '2026-09-07', 20)).toBe(0);
    expect(getWeekNumber(new Date(2026, 8, 7), '2026-09-07', 20)).toBe(1);
    expect(getWeekNumber(new Date(2026, 9, 5), '2026-09-07', 20)).toBe(5);
    expect(getWeekNumber(new Date(2027, 1, 1), '2026-09-07', 20)).toBe(21);
  });
});

describe('课程周次', () => {
  it('生成连续周、单周和双周', () => {
    expect(weeksFromRange(1, 6, 'all')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(weeksFromRange(1, 6, 'odd')).toEqual([1, 3, 5]);
    expect(weeksFromRange(1, 6, 'even')).toEqual([2, 4, 6]);
  });

  it('清理重复和越界周数并筛选周课表', () => {
    expect(normalizeWeeks([3, 1, 3, 0, 21], 20)).toEqual([1, 3]);
    expect(coursesForWeek([course(), course({ id: 'b', weeks: [4] })], 2).map((item) => item.id)).toEqual(['a']);
  });
});

describe('冲突与布局', () => {
  it('仅将同星期、同周且节次重叠的课程判为冲突', () => {
    expect(coursesOverlap(course(), course({ id: 'b', startPeriod: 2, endPeriod: 3 }))).toBe(true);
    expect(coursesOverlap(course(), course({ id: 'b', weekday: 2 }))).toBe(false);
    expect(coursesOverlap(course(), course({ id: 'b', weeks: [4] }))).toBe(false);
  });

  it('为重叠卡片分配并列通道', () => {
    const result = layoutCourses([course(), course({ id: 'b', startPeriod: 2, endPeriod: 3 })]);
    expect(result.map((item) => item.lane)).toEqual([0, 1]);
    expect(result.every((item) => item.laneCount === 2 && item.conflicting)).toBe(true);
  });
});
