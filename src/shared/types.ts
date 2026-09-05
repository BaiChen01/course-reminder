export interface PeriodTime {
  period: number;
  start: string;
  end: string;
}

export interface AppSettings {
  firstWeekMonday: string;
  totalWeeks: number;
  defaultReminderMinutes: number;
  periods: PeriodTime[];
  wechat: {
    enabled: boolean;
  };
}

export interface Course {
  id: string;
  code: string;
  name: string;
  className: string;
  teacher: string;
  location: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  weeks: number[];
  color: string;
  reminderEnabled: boolean;
  reminderMinutes?: number;
}

export type CourseInput = Omit<Course, 'id'>;

export interface AppData {
  version: 2;
  settings: AppSettings;
  courses: Course[];
}

export interface WechatDeliveryResult {
  ok: boolean;
  message: string;
  at: string;
}

export interface WechatStatus {
  enabled: boolean;
  configured: boolean;
  maskedKey?: string;
  testPassed: boolean;
  lastResult?: WechatDeliveryResult;
}

export interface ReminderCandidate {
  key: string;
  course: Course;
  startAt: Date;
  reminderAt: Date;
  leadMinutes: number;
}

export interface CourseReminderAPI {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppData>;
  listCourses(): Promise<Course[]>;
  getWeekSchedule(week: number): Promise<Course[]>;
  addCourse(course: CourseInput): Promise<Course>;
  updateCourse(course: Course): Promise<Course>;
  deleteCourse(id: string): Promise<void>;
  getWechatStatus(): Promise<WechatStatus>;
  saveWechatSendKey(sendKey: string): Promise<WechatStatus>;
  clearWechatSendKey(): Promise<WechatStatus>;
  testWechat(): Promise<WechatStatus>;
  setWechatEnabled(enabled: boolean): Promise<WechatStatus>;
  onOpenCourse(callback: (payload: { courseId: string; week: number }) => void): () => void;
}
