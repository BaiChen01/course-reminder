import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppSettings, Course, CourseInput, WechatStatus } from '../shared/types';
import { dateForWeekday, formatLocalDate, getWeekNumber } from '../shared/schedule';
import ScheduleGrid from './components/ScheduleGrid';
import CourseModal from './components/CourseModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [wechatStatus, setWechatStatus] = useState<WechatStatus | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [courseModal, setCourseModal] = useState<Course | 'new' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [nextSettings, nextCourses, nextWechatStatus] = await Promise.all([
        window.courseReminder.getSettings(),
        window.courseReminder.listCourses(),
        window.courseReminder.getWechatStatus(),
      ]);
      setSettings(nextSettings);
      setCourses(nextCourses);
      setWechatStatus(nextWechatStatus);
      const week = getWeekNumber(new Date(), nextSettings.firstWeekMonday, nextSettings.totalWeeks);
      setSelectedWeek(week >= 1 && week <= nextSettings.totalWeeks ? week : 1);
    } catch (reason) {
      setError(readError(reason));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => window.courseReminder.onOpenCourse(({ courseId, week }) => {
    setSelectedWeek(week);
    setHighlightedId(courseId);
    window.setTimeout(() => setHighlightedId(undefined), 4500);
  }), []);

  useEffect(() => {
    if (!message && !error) return;
    const timer = window.setTimeout(() => { setMessage(undefined); setError(undefined); }, 3500);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  const currentWeek = settings ? getWeekNumber(new Date(), settings.firstWeekMonday, settings.totalWeeks) : 0;
  const weekRange = useMemo(() => {
    if (!settings) return '';
    const start = dateForWeekday(settings.firstWeekMonday, selectedWeek, 1);
    const end = dateForWeekday(settings.firstWeekMonday, selectedWeek, 7);
    return `${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日`;
  }, [settings, selectedWeek]);

  async function saveCourse(input: CourseInput | Course) {
    try {
      if ('id' in input) await window.courseReminder.updateCourse(input);
      else await window.courseReminder.addCourse(input);
      setCourses(await window.courseReminder.listCourses());
      setCourseModal(null);
      setMessage('课程已保存');
    } catch (reason) {
      setError(readError(reason));
    }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`确定删除“${course.name}”吗？`)) return;
    try {
      await window.courseReminder.deleteCourse(course.id);
      setCourses(await window.courseReminder.listCourses());
      setCourseModal(null);
      setMessage('课程已删除');
    } catch (reason) {
      setError(readError(reason));
    }
  }

  async function saveSettings(next: AppSettings) {
    const affected = courses.filter((course) => course.weeks.some((week) => week > next.totalWeeks));
    if (affected.length) {
      const names = affected.slice(0, 8).map((course) => `“${course.name}”`).join('、');
      const suffix = affected.length > 8 ? `等 ${affected.length} 门课程` : '';
      const confirmed = window.confirm(
        `缩短学期后，${names}${suffix}超出第 ${next.totalWeeks} 周的周次将被移除；没有剩余周次的课程也会被删除。是否继续？`,
      );
      if (!confirmed) return;
    }
    try {
      const data = await window.courseReminder.saveSettings(next);
      setSettings(data.settings);
      setCourses(data.courses);
      setSelectedWeek((week) => Math.min(week, data.settings.totalWeeks));
      setSettingsOpen(false);
      setMessage('学期设置已保存');
    } catch (reason) {
      setError(readError(reason));
    }
  }

  async function saveWechatKey(sendKey: string) {
    const status = await window.courseReminder.saveWechatSendKey(sendKey);
    setWechatStatus(status);
    setSettings((current) => current ? { ...current, wechat: { enabled: false } } : current);
    return status;
  }

  async function clearWechatKey() {
    const status = await window.courseReminder.clearWechatSendKey();
    setWechatStatus(status);
    setSettings((current) => current ? { ...current, wechat: { enabled: false } } : current);
    return status;
  }

  async function testWechat() {
    const status = await window.courseReminder.testWechat();
    setWechatStatus(status);
    return status;
  }

  async function toggleWechat(enabled: boolean) {
    const status = await window.courseReminder.setWechatEnabled(enabled);
    setWechatStatus(status);
    setSettings((current) => current ? { ...current, wechat: { enabled: status.enabled } } : current);
    return status;
  }

  if (!settings) {
    return <main className="loading"><div className="spinner" /><p>{error ?? '正在加载课表…'}</p></main>;
  }

  const weekCourses = courses.filter((course) => course.weeks.includes(selectedWeek));
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">课</div>
          <div><h1>课程提示器</h1><p>本地课表 · 准时提醒</p></div>
        </div>
        <div className="week-nav" aria-label="周数切换">
          <button className="icon-button" disabled={selectedWeek <= 1} onClick={() => setSelectedWeek((week) => week - 1)} aria-label="上一周">‹</button>
          <label className="week-picker">
            <select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))}>
              {Array.from({ length: settings.totalWeeks }, (_, index) => index + 1).map((week) => (
                <option key={week} value={week}>第 {week} 周</option>
              ))}
            </select>
            <span>{weekRange}</span>
          </label>
          <button className="icon-button" disabled={selectedWeek >= settings.totalWeeks} onClick={() => setSelectedWeek((week) => week + 1)} aria-label="下一周">›</button>
          <button className="ghost-button" disabled={currentWeek < 1 || currentWeek > settings.totalWeeks || selectedWeek === currentWeek} onClick={() => setSelectedWeek(currentWeek)}>回到本周</button>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={() => setSettingsOpen(true)}>学期设置</button>
          <button className="primary-button" onClick={() => setCourseModal('new')}><span>＋</span> 添加课程</button>
        </div>
      </header>

      <section className="summary-bar">
        <div><strong>第 {selectedWeek} 周</strong><span>{weekCourses.length ? `${weekCourses.length} 门课程` : '本周暂无课程'}</span></div>
        {currentWeek === 0 && <span className="term-badge">学期尚未开始</span>}
        {currentWeek === settings.totalWeeks + 1 && <span className="term-badge">学期已经结束</span>}
        <span className="tip">点击课程卡片可编辑 · 关闭窗口后仍在托盘提醒</span>
      </section>

      <ScheduleGrid
        settings={settings}
        courses={weekCourses}
        week={selectedWeek}
        isCurrentWeek={selectedWeek === currentWeek}
        highlightedId={highlightedId}
        onCourseClick={setCourseModal}
      />

      {courseModal && (
        <CourseModal
          course={courseModal === 'new' ? undefined : courseModal}
          settings={settings}
          courses={courses}
          onClose={() => setCourseModal(null)}
          onSave={saveCourse}
          onDelete={deleteCourse}
        />
      )}
      {settingsOpen && wechatStatus && (
        <SettingsModal
          settings={settings}
          wechatStatus={wechatStatus}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onSaveWechatKey={saveWechatKey}
          onClearWechatKey={clearWechatKey}
          onTestWechat={testWechat}
          onToggleWechat={toggleWechat}
        />
      )}
      {(message || error) && <div role="status" className={`toast ${error ? 'error' : ''}`}>{error ?? message}</div>}
    </div>
  );
}

function readError(reason: unknown): string {
  if (reason instanceof Error) return reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  return '操作失败，请重试';
}
