import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, Course, CourseInput, CourseReminderAPI } from '../shared/types';

const api: CourseReminderAPI = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  listCourses: () => ipcRenderer.invoke('courses:list'),
  getWeekSchedule: (week: number) => ipcRenderer.invoke('courses:week', week),
  addCourse: (course: CourseInput) => ipcRenderer.invoke('courses:add', course),
  updateCourse: (course: Course) => ipcRenderer.invoke('courses:update', course),
  deleteCourse: (id: string) => ipcRenderer.invoke('courses:delete', id),
  getWechatStatus: () => ipcRenderer.invoke('wechat:status'),
  saveWechatSendKey: (sendKey: string) => ipcRenderer.invoke('wechat:save-key', sendKey),
  clearWechatSendKey: () => ipcRenderer.invoke('wechat:clear-key'),
  testWechat: () => ipcRenderer.invoke('wechat:test'),
  setWechatEnabled: (enabled: boolean) => ipcRenderer.invoke('wechat:set-enabled', enabled),
  onOpenCourse: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { courseId: string; week: number }) => callback(payload);
    ipcRenderer.on('navigation:open-course', listener);
    return () => ipcRenderer.removeListener('navigation:open-course', listener);
  },
};

contextBridge.exposeInMainWorld('courseReminder', api);
