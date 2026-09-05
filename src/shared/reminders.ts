import type { AppSettings, Course, ReminderCandidate } from './types';
import { formatLocalDate, getWeekNumber } from './schedule';

export function findDueReminders(
  now: Date,
  courses: Course[],
  settings: AppSettings,
  notifiedKeys: ReadonlySet<string>,
): ReminderCandidate[] {
  return findUpcomingReminders(now, courses, settings)
    .filter((candidate) => !notifiedKeys.has(candidate.key) && now >= candidate.reminderAt);
}

export function findUpcomingReminders(
  now: Date,
  courses: Course[],
  settings: AppSettings,
): ReminderCandidate[] {
  const week = getWeekNumber(now, settings.firstWeekMonday, settings.totalWeeks);
  if (week < 1 || week > settings.totalWeeks) return [];
  const weekday = now.getDay() || 7;
  const dateKey = formatLocalDate(now);

  return courses.flatMap((course) => {
    if (!course.reminderEnabled || course.weekday !== weekday || !course.weeks.includes(week)) return [];
    const period = settings.periods.find((item) => item.period === course.startPeriod);
    if (!period) return [];
    const [hour, minute] = period.start.split(':').map(Number);
    const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
    const leadMinutes = course.reminderMinutes ?? settings.defaultReminderMinutes;
    const reminderAt = new Date(startAt.getTime() - leadMinutes * 60_000);
    const key = `${course.id}:${dateKey}:${period.start}`;
    if (now >= startAt) return [];
    return [{ key, course, startAt, reminderAt, leadMinutes }];
  });
}

export function groupRemindersByStart(
  dueCandidates: ReminderCandidate[],
  allUpcomingCandidates: ReminderCandidate[] = dueCandidates,
): Map<string, ReminderCandidate[]> {
  const groups = new Map<string, ReminderCandidate[]>();
  const dueKeys = new Set(dueCandidates.map(startGroupKey));
  for (const candidate of allUpcomingCandidates) {
    const key = startGroupKey(candidate);
    if (!dueKeys.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  return groups;
}

function startGroupKey(candidate: ReminderCandidate): string {
  const time = `${String(candidate.startAt.getHours()).padStart(2, '0')}:${String(candidate.startAt.getMinutes()).padStart(2, '0')}`;
  return `${formatLocalDate(candidate.startAt)}:${time}`;
}
