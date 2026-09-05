import type { Course } from './types';

const DAY_MS = 86_400_000;

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mondayOf(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  return result;
}

export function getWeekNumber(date: Date, firstWeekMonday: string, totalWeeks: number): number {
  const first = parseLocalDate(firstWeekMonday);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((current.getTime() - first.getTime()) / DAY_MS);
  const week = Math.floor(difference / 7) + 1;
  if (week < 1) return 0;
  if (week > totalWeeks) return totalWeeks + 1;
  return week;
}

export function dateForWeekday(firstWeekMonday: string, week: number, weekday: number): Date {
  const date = parseLocalDate(firstWeekMonday);
  date.setDate(date.getDate() + (week - 1) * 7 + weekday - 1);
  return date;
}

export function coursesForWeek(courses: Course[], week: number): Course[] {
  return courses.filter((course) => course.weeks.includes(week));
}

export function normalizeWeeks(weeks: number[], totalWeeks: number): number[] {
  return [...new Set(weeks.filter((week) => Number.isInteger(week) && week >= 1 && week <= totalWeeks))]
    .sort((a, b) => a - b);
}

export function weeksFromRange(start: number, end: number, mode: 'all' | 'odd' | 'even'): number[] {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const weeks: number[] = [];
  for (let week = low; week <= high; week += 1) {
    if (mode === 'all' || (mode === 'odd' && week % 2 === 1) || (mode === 'even' && week % 2 === 0)) {
      weeks.push(week);
    }
  }
  return weeks;
}

export function coursesOverlap(a: Course, b: Course): boolean {
  if (a.weekday !== b.weekday) return false;
  const periodsOverlap = a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod;
  const weeksOverlap = a.weeks.some((week) => b.weeks.includes(week));
  return periodsOverlap && weeksOverlap;
}

export interface CourseLayout {
  course: Course;
  lane: number;
  laneCount: number;
  conflicting: boolean;
}

export function layoutCourses(courses: Course[]): CourseLayout[] {
  const sorted = [...courses].sort((a, b) => a.startPeriod - b.startPeriod || a.endPeriod - b.endPeriod);
  const groups: Course[][] = [];
  let group: Course[] = [];
  let groupEnd = 0;
  for (const course of sorted) {
    if (group.length === 0 || course.startPeriod <= groupEnd) {
      group.push(course);
      groupEnd = Math.max(groupEnd, course.endPeriod);
    } else {
      groups.push(group);
      group = [course];
      groupEnd = course.endPeriod;
    }
  }
  if (group.length) groups.push(group);

  return groups.flatMap((items) => {
    const laneEnds: number[] = [];
    const assigned = items.map((course) => {
      let lane = laneEnds.findIndex((end) => end < course.startPeriod);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = course.endPeriod;
      return { course, lane };
    });
    const laneCount = laneEnds.length;
    return assigned.map(({ course, lane }) => ({
      course,
      lane,
      laneCount,
      conflicting: laneCount > 1,
    }));
  });
}
