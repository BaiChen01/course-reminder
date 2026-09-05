import { describe, expect, it, vi } from 'vitest';
import type { AppSettings, Course } from '../shared/types';
import { buildCourseMessage, WechatPushService } from './wechat-push-service';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Server酱发送服务', () => {
  it('成功请求使用 JSON 且不泄露到消息正文', async () => {
    const mockFetch = vi.fn(async () => jsonResponse({ code: 0, message: 'ok' }));
    const service = new WechatPushService(mockFetch as typeof fetch);
    const result = await service.send('SCTabcdefgh1234', '标题\n换行', '正文');
    expect(result.ok).toBe(true);
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({ title: '标题 换行', desp: '正文', noip: 1 });
  });

  it('处理业务错误、HTTP 错误和异常 JSON', async () => {
    await expect(new WechatPushService((async () => jsonResponse({ code: 1 })) as typeof fetch).send('SCTabcdefgh1234', 'a', 'b')).resolves.toMatchObject({ ok: false, message: expect.stringContaining('code 1') });
    await expect(new WechatPushService((async () => jsonResponse({}, 503)) as typeof fetch).send('SCTabcdefgh1234', 'a', 'b')).resolves.toMatchObject({ ok: false, message: expect.stringContaining('503') });
    await expect(new WechatPushService((async () => new Response('not-json')) as typeof fetch).send('SCTabcdefgh1234', 'a', 'b')).resolves.toMatchObject({ ok: false, message: expect.stringContaining('无法识别') });
  });

  it('处理超时和断网', async () => {
    const aborting = ((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
    await expect(new WechatPushService(aborting, 5).send('SCTabcdefgh1234', 'a', 'b')).resolves.toMatchObject({ ok: false, message: expect.stringContaining('超时') });
    await expect(new WechatPushService((async () => { throw new Error('offline'); }) as typeof fetch).send('SCTabcdefgh1234', 'a', 'b')).resolves.toMatchObject({ ok: false, message: expect.stringContaining('无法连接') });
  });

  it('构建单课程和冲突课程消息', () => {
    const settings = { periods: [{ period: 1, start: '08:00', end: '08:45' }], wechat: { enabled: true } } as AppSettings;
    const course = { name: '高数', startPeriod: 1, endPeriod: 1, location: 'A101', teacher: '王老师' } as Course;
    expect(buildCourseMessage([course], settings, 3).desp).toContain('第 3 周');
    expect(buildCourseMessage([course, { ...course, name: '线代' }], settings, 3).title).toContain('2 门课程');
  });
});
