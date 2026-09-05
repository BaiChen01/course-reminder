import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppData, AppSettings, Course, CourseInput } from '../shared/types';
import { coursesForWeek, formatLocalDate, mondayOf, normalizeWeeks, parseLocalDate } from '../shared/schedule';

const DEFAULT_PERIODS = [
  ['08:00', '08:45'], ['08:55', '09:40'], ['10:00', '10:45'], ['10:55', '11:40'],
  ['14:00', '14:45'], ['14:55', '15:40'], ['16:00', '16:45'], ['16:55', '17:40'],
  ['19:00', '19:45'], ['19:55', '20:40'], ['20:50', '21:35'], ['21:45', '22:30'],
];

export function createDefaultSettings(): AppSettings {
  return {
    firstWeekMonday: formatLocalDate(mondayOf(new Date())),
    totalWeeks: 20,
    defaultReminderMinutes: 15,
    periods: DEFAULT_PERIODS.map(([start, end], index) => ({ period: index + 1, start, end })),
    wechat: { enabled: false },
  };
}

function emptyData(): AppData {
  return { version: 2, settings: createDefaultSettings(), courses: [] };
}

function assertTime(value: string, label: string): void {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${label}格式无效`);
}

export function validateSettings(settings: AppSettings): AppSettings {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.firstWeekMonday)) throw new Error('请选择第一周周一日期');
  const first = parseLocalDate(settings.firstWeekMonday);
  if (Number.isNaN(first.getTime()) || first.getDay() !== 1) throw new Error('第一周日期必须是星期一');
  if (!Number.isInteger(settings.totalWeeks) || settings.totalWeeks < 1 || settings.totalWeeks > 30) {
    throw new Error('学期总周数应为 1—30');
  }
  if (!Number.isInteger(settings.defaultReminderMinutes) || settings.defaultReminderMinutes < 0 || settings.defaultReminderMinutes > 1440) {
    throw new Error('默认提醒时间应为 0—1440 分钟');
  }
  if (!Array.isArray(settings.periods) || settings.periods.length !== 12) throw new Error('必须配置 12 节课时间');
  const periods = settings.periods.map((period, index) => {
    if (period.period !== index + 1) throw new Error('节次顺序无效');
    assertTime(period.start, `第 ${period.period} 节开始时间`);
    assertTime(period.end, `第 ${period.period} 节结束时间`);
    if (period.start >= period.end) throw new Error(`第 ${period.period} 节结束时间必须晚于开始时间`);
    return { ...period };
  });
  return { ...settings, periods, wechat: { enabled: Boolean(settings.wechat?.enabled) } };
}

export function validateCourse(input: CourseInput | Course, totalWeeks: number): CourseInput | Course {
  if (!input.name.trim()) throw new Error('课程名称不能为空');
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) throw new Error('星期无效');
  if (!Number.isInteger(input.startPeriod) || !Number.isInteger(input.endPeriod)
    || input.startPeriod < 1 || input.endPeriod > 12 || input.startPeriod > input.endPeriod) {
    throw new Error('上课节次应在 1—12 节之间');
  }
  const weeks = normalizeWeeks(input.weeks, totalWeeks);
  if (!weeks.length) throw new Error('请至少选择一个有效周数');
  if (input.reminderMinutes !== undefined
    && (!Number.isInteger(input.reminderMinutes) || input.reminderMinutes < 0 || input.reminderMinutes > 1440)) {
    throw new Error('课程提醒时间应为 0—1440 分钟');
  }
  return {
    ...input,
    name: input.name.trim(),
    code: input.code.trim(),
    className: input.className.trim(),
    teacher: input.teacher.trim(),
    location: input.location.trim(),
    weeks,
    color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#dceef8',
  };
}

export class DataStore {
  private data: AppData = emptyData();
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'schedule.json');
  }

  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.data = emptyData();
      await this.persist();
      return;
    }

    let isV1 = false;
    try {
      const parsed = JSON.parse(raw) as { version?: number; settings?: Partial<AppSettings>; courses?: Course[] };
      isV1 = parsed.version === 1 || parsed.settings?.wechat === undefined;
      const settings = validateSettings({ ...createDefaultSettings(), ...parsed.settings } as AppSettings);
      const courses = Array.isArray(parsed.courses)
        ? parsed.courses.map((course) => validateCourse(course, settings.totalWeeks) as Course)
        : [];
      this.data = { version: 2, settings, courses };
    } catch {
      const backupPath = `${this.filePath}.invalid-${Date.now()}`;
      await fs.rename(this.filePath, backupPath).catch(() => undefined);
      this.data = emptyData();
      await this.persist();
      return;
    }

    if (isV1) {
      try {
        const backupPath = path.join(path.dirname(this.filePath), 'schedule.v1.backup.json');
        await fs.copyFile(this.filePath, backupPath, fsConstants.COPYFILE_EXCL).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') throw error;
        });
        await this.persist();
      } catch {
        // 原始 v1 文件保持不变；本次会话仍使用已解析的数据，避免以空课表覆盖。
      }
    }
  }

  getData(): AppData {
    return structuredClone(this.data);
  }

  getSettings(): AppSettings {
    return structuredClone(this.data.settings);
  }

  listCourses(): Course[] {
    return structuredClone(this.data.courses);
  }

  getWeekSchedule(week: number): Course[] {
    return structuredClone(coursesForWeek(this.data.courses, week));
  }

  async saveSettings(settings: AppSettings): Promise<AppData> {
    const validated = validateSettings(settings);
    const courses = this.data.courses.flatMap((course) => {
      const weeks = normalizeWeeks(course.weeks, validated.totalWeeks);
      return weeks.length ? [{ ...course, weeks }] : [];
    });
    this.data = { ...this.data, settings: validated, courses };
    await this.persist();
    return this.getData();
  }

  async setWechatEnabled(enabled: boolean): Promise<AppSettings> {
    this.data.settings.wechat = { enabled };
    await this.persist();
    return this.getSettings();
  }

  async addCourse(input: CourseInput): Promise<Course> {
    const clean = validateCourse(input, this.data.settings.totalWeeks) as CourseInput;
    const course: Course = { ...clean, id: randomUUID() };
    this.data.courses.push(course);
    await this.persist();
    return structuredClone(course);
  }

  async updateCourse(input: Course): Promise<Course> {
    const index = this.data.courses.findIndex((course) => course.id === input.id);
    if (index < 0) throw new Error('课程不存在或已被删除');
    const clean = validateCourse(input, this.data.settings.totalWeeks) as Course;
    this.data.courses[index] = clean;
    await this.persist();
    return structuredClone(clean);
  }

  async deleteCourse(id: string): Promise<void> {
    const next = this.data.courses.filter((course) => course.id !== id);
    if (next.length === this.data.courses.length) throw new Error('课程不存在或已被删除');
    this.data.courses = next;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }
}
