import type { CourseReminderAPI } from '../shared/types';

declare global {
  interface Window {
    courseReminder: CourseReminderAPI;
  }
}

export {};
