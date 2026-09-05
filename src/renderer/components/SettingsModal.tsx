import { useState } from 'react';
import type { AppSettings, WechatStatus } from '../../shared/types';

interface Props {
  settings: AppSettings;
  wechatStatus: WechatStatus;
  onClose(): void;
  onSave(settings: AppSettings): void;
  onSaveWechatKey(sendKey: string): Promise<WechatStatus>;
  onClearWechatKey(): Promise<WechatStatus>;
  onTestWechat(): Promise<WechatStatus>;
  onToggleWechat(enabled: boolean): Promise<WechatStatus>;
}

export default function SettingsModal({ settings, wechatStatus: initialWechatStatus, onClose, onSave, onSaveWechatKey, onClearWechatKey, onTestWechat, onToggleWechat }: Props) {
  const [draft, setDraft] = useState<AppSettings>(() => structuredClone(settings));
  const [wechatStatus, setWechatStatus] = useState(initialWechatStatus);
  const [sendKey, setSendKey] = useState('');
  const [wechatBusy, setWechatBusy] = useState(false);
  const [error, setError] = useState<string>();

  function updatePeriod(index: number, field: 'start' | 'end', value: string) {
    setDraft((current) => ({ ...current, periods: current.periods.map((period, i) => i === index ? { ...period, [field]: value } : period) }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const date = new Date(`${draft.firstWeekMonday}T00:00:00`);
    if (date.getDay() !== 1) return setError('第一周日期必须选择星期一');
    if (draft.totalWeeks < 1 || draft.totalWeeks > 30) return setError('学期总周数应为 1—30');
    if (draft.defaultReminderMinutes < 0 || draft.defaultReminderMinutes > 1440) return setError('提醒时间应为 0—1440 分钟');
    const invalid = draft.periods.find((period) => !period.start || !period.end || period.start >= period.end);
    if (invalid) return setError(`第 ${invalid.period} 节的时间设置无效`);
    onSave(draft);
  }

  async function runWechatAction(action: () => Promise<WechatStatus>) {
    setWechatBusy(true);
    setError(undefined);
    try {
      const status = await action();
      setWechatStatus(status);
      setDraft((current) => ({ ...current, wechat: { enabled: status.enabled } }));
      return status;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '微信设置操作失败';
      setError(message);
      return undefined;
    } finally {
      setWechatBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal settings-modal" onSubmit={submit}>
        <div className="modal-header"><div><h2>学期设置</h2><p>用于计算当前周与每节课的提醒时间</p></div><button type="button" className="close-button" onClick={onClose}>×</button></div>
        <div className="settings-general">
          <label><span>第一周的星期一</span><input type="date" value={draft.firstWeekMonday} onChange={(e) => setDraft({ ...draft, firstWeekMonday: e.target.value })} /></label>
          <label><span>学期总周数</span><input type="number" min="1" max="30" value={draft.totalWeeks} onChange={(e) => setDraft({ ...draft, totalWeeks: Number(e.target.value) })} /></label>
          <label><span>默认提前提醒（分钟）</span><input type="number" min="0" max="1440" value={draft.defaultReminderMinutes} onChange={(e) => setDraft({ ...draft, defaultReminderMinutes: Number(e.target.value) })} /></label>
        </div>
        <div className="period-settings"><div className="period-settings-head"><strong>节次时间表</strong><span>课程将按开始节次触发提醒</span></div>
          {draft.periods.map((period, index) => <div className="period-setting" key={period.period}><strong>第 {period.period} 节</strong><input aria-label={`第${period.period}节开始时间`} type="time" value={period.start} onChange={(e) => updatePeriod(index, 'start', e.target.value)} /><span>至</span><input aria-label={`第${period.period}节结束时间`} type="time" value={period.end} onChange={(e) => updatePeriod(index, 'end', e.target.value)} /></div>)}
        </div>
        <section className="wechat-settings">
          <div className="wechat-title">
            <div><strong>微信提醒</strong><span>通过 Server酱 Turbo 推送</span></div>
            <label className="switch-row"><input type="checkbox" checked={wechatStatus.enabled} disabled={wechatBusy || !wechatStatus.testPassed} onChange={(e) => void runWechatAction(() => onToggleWechat(e.target.checked))} /><span>{wechatStatus.enabled ? '已启用' : '未启用'}</span></label>
          </div>
          <p className="privacy-note">启用后，课程名称、上课时间、教师和地点会发送给 Server酱。程序退出、电脑关机或断网时无法推送。免费账户通常每天最多 5 条。</p>
          <div className="sendkey-row">
            <label><span>Server酱 Turbo SendKey</span><input type="password" autoComplete="off" value={sendKey} onChange={(e) => setSendKey(e.target.value)} placeholder={wechatStatus.maskedKey ?? '粘贴 SCT 开头的 SendKey'} /></label>
            <button type="button" className="ghost-button" disabled={wechatBusy || !sendKey.trim()} onClick={() => void runWechatAction(async () => { const status = await onSaveWechatKey(sendKey); setSendKey(''); return status; })}>保存密钥</button>
          </div>
          <div className="wechat-actions">
            <span className={`connection-state ${wechatStatus.testPassed ? 'success' : ''}`}>{wechatStatus.configured ? `${wechatStatus.maskedKey} · ${wechatStatus.testPassed ? '测试通过' : '等待测试'}` : '尚未配置 SendKey'}</span>
            <a href="https://sct.ftqq.com/sendkey/" target="_blank" rel="noreferrer">获取 SendKey</a>
            <button type="button" className="ghost-button" disabled={wechatBusy || !wechatStatus.configured} onClick={() => void runWechatAction(onTestWechat)}>发送测试</button>
            <button type="button" className="danger-link" disabled={wechatBusy || !wechatStatus.configured} onClick={() => { if (window.confirm('确定清除本机保存的微信 SendKey 吗？')) void runWechatAction(onClearWechatKey); }}>清除</button>
          </div>
          {wechatStatus.lastResult && <div className={`delivery-result ${wechatStatus.lastResult.ok ? 'success' : 'failure'}`}><strong>{wechatStatus.lastResult.ok ? '✓' : '!'}</strong><span>{wechatStatus.lastResult.message}<small>{new Date(wechatStatus.lastResult.at).toLocaleString('zh-CN')}</small></span></div>}
        </section>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-footer"><span /><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">保存设置</button></div>
      </form>
    </div>
  );
}
