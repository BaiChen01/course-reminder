import type { AppSettings, Course, WechatDeliveryResult } from '../shared/types';
import { validateSendKey } from './secret-store';

interface ServerChanResponse { code?: number; message?: string; }
type FetchLike = typeof fetch;

function result(ok: boolean, message: string): WechatDeliveryResult {
  return { ok, message, at: new Date().toISOString() };
}

export function buildCourseMessage(courses: Course[], settings: AppSettings, week: number): { title: string; desp: string } {
  const first = courses[0];
  const start = settings.periods.find((item) => item.period === first.startPeriod)?.start ?? '时间未设置';
  const title = courses.length === 1 ? `课程提醒｜${first.name}` : `课程提醒｜${courses.length} 门课程时间冲突`;
  const sections = courses.map((course) => {
    const end = settings.periods.find((item) => item.period === course.endPeriod)?.end ?? '';
    return [
      `### ${course.name}`,
      `- 时间：${start}${end ? `—${end}` : ''}（第 ${course.startPeriod}-${course.endPeriod} 节）`,
      `- 地点：${course.location || '未填写'}`,
      `- 教师：${course.teacher || '未填写'}`,
    ].join('\n');
  });
  return { title, desp: [`第 ${week} 周课程即将开始。`, ...sections].join('\n\n') };
}

export class WechatPushService {
  constructor(private readonly fetchImpl: FetchLike = fetch, private readonly timeoutMs = 8_000) {}

  async send(sendKey: string, title: string, desp: string): Promise<WechatDeliveryResult> {
    const key = validateSendKey(sendKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify({ title: title.replace(/[\r\n]+/g, ' ').slice(0, 100), desp, noip: 1 }),
        signal: controller.signal,
      });
      if (!response.ok) return result(false, `Server酱服务请求失败（HTTP ${response.status}）`);
      let body: ServerChanResponse;
      try {
        body = await response.json() as ServerChanResponse;
      } catch {
        return result(false, 'Server酱返回了无法识别的数据');
      }
      if (body.code !== 0) return result(false, `Server酱返回错误（code ${body.code ?? '未知'}）`);
      return result(true, '微信消息已发送');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return result(false, '发送超时，请检查网络后使用测试按钮重试');
      return result(false, '无法连接 Server酱，请检查网络后使用测试按钮重试');
    } finally {
      clearTimeout(timeout);
    }
  }

  sendTest(sendKey: string): Promise<WechatDeliveryResult> {
    return this.send(sendKey, '课程提示器测试', '如果你收到这条消息，说明微信提醒已经配置成功。');
  }
}
