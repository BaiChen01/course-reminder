import { Notification, powerMonitor } from 'electron';
import type { BrowserWindow } from 'electron';
import type { DataStore } from './store';
import { findDueReminders, findUpcomingReminders, groupRemindersByStart } from '../shared/reminders';
import { getWeekNumber } from '../shared/schedule';
import type { SecretStore } from './secret-store';
import type { DeliveryLedger } from './delivery-ledger';
import type { WechatPushService } from './wechat-push-service';
import { buildCourseMessage } from './wechat-push-service';

export class ReminderService {
  private timer?: NodeJS.Timeout;
  private checking = false;
  private resumeHandler = () => this.check();

  constructor(
    private readonly store: DataStore,
    private readonly showWindow: () => BrowserWindow | null,
    private readonly secrets: SecretStore,
    private readonly ledger: DeliveryLedger,
    private readonly wechat: WechatPushService,
  ) {}

  start(): void {
    this.stop();
    void this.check();
    this.timer = setInterval(() => void this.check(), 30_000);
    powerMonitor.on('resume', this.resumeHandler);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    powerMonitor.removeListener('resume', this.resumeHandler);
  }

  refresh(): void {
    void this.check();
  }

  private async check(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = new Date();
      const settings = this.store.getSettings();
      const courses = this.store.listCourses();
      const due = findDueReminders(now, courses, settings, new Set());
      const week = getWeekNumber(now, settings.firstWeekMonday, settings.totalWeeks);

      for (const item of due) {
        if (this.ledger.has('local', item.key)) continue;
        const notification = new Notification({
          title: `即将上课：${item.course.name}`,
          body: `${item.leadMinutes === 0 ? '现在开始' : `${item.leadMinutes} 分钟后开始`} · ${item.course.location || '地点未填写'}\n第 ${item.course.startPeriod}-${item.course.endPeriod} 节`,
          silent: false,
        });
        notification.on('click', () => {
          const window = this.showWindow();
          if (!window) return;
          window.webContents.send('navigation:open-course', { courseId: item.course.id, week });
        });
        notification.show();
        await this.ledger.mark('local', item.key, now);
      }

      const status = this.secrets.getStatus(settings.wechat.enabled);
      const sendKey = status.enabled && status.configured && status.testPassed ? this.secrets.getKey() : undefined;
      if (!sendKey) return;

      const groups = groupRemindersByStart(due, findUpcomingReminders(now, courses, settings));
      for (const [key, items] of groups) {
        if (this.ledger.has('wechat', key)) continue;
        await this.ledger.mark('wechat', key, now);
        const message = buildCourseMessage(items.map((item) => item.course), settings, week);
        const result = await this.wechat.send(sendKey, message.title, message.desp);
        await this.secrets.setLastResult({
          ...result,
          message: result.ok ? `已发送：${items.map((item) => item.course.name).join('、')}` : result.message,
        });
      }
    } finally {
      this.checking = false;
    }
  }
}
