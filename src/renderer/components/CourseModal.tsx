import { useMemo, useState } from 'react';
import type { AppSettings, Course, CourseInput } from '../../shared/types';
import { coursesOverlap, normalizeWeeks, weeksFromRange } from '../../shared/schedule';

const COLORS = ['#dceef8', '#e4e4fb', '#dff3e6', '#fff0cf', '#f9dfdf', '#e8e8e8', '#d9f1ef', '#f2e1f7'];
type WeekMode = 'all' | 'odd' | 'even' | 'custom';

interface Props {
  course?: Course;
  settings: AppSettings;
  courses: Course[];
  onClose(): void;
  onSave(course: CourseInput | Course): void;
  onDelete(course: Course): void;
}

export default function CourseModal({ course, settings, courses, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(course?.name ?? '');
  const [code, setCode] = useState(course?.code ?? '');
  const [className, setClassName] = useState(course?.className ?? '');
  const [teacher, setTeacher] = useState(course?.teacher ?? '');
  const [location, setLocation] = useState(course?.location ?? '');
  const [weekday, setWeekday] = useState(course?.weekday ?? 1);
  const [startPeriod, setStartPeriod] = useState(course?.startPeriod ?? 1);
  const [endPeriod, setEndPeriod] = useState(course?.endPeriod ?? 2);
  const [weekMode, setWeekMode] = useState<WeekMode>(course ? 'custom' : 'all');
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(settings.totalWeeks);
  const [customWeeks, setCustomWeeks] = useState(course?.weeks.join(',') ?? '');
  const [color, setColor] = useState(course?.color ?? COLORS[0]);
  const [reminderMode, setReminderMode] = useState<'inherit' | 'custom' | 'off'>(
    course?.reminderEnabled === false ? 'off' : course?.reminderMinutes !== undefined ? 'custom' : 'inherit',
  );
  const [reminderMinutes, setReminderMinutes] = useState(course?.reminderMinutes ?? settings.defaultReminderMinutes);
  const [localError, setLocalError] = useState<string>();

  const weeks = useMemo(() => {
    if (weekMode === 'custom') {
      return normalizeWeeks(customWeeks.split(/[，,、\s]+/).map(Number), settings.totalWeeks);
    }
    return normalizeWeeks(weeksFromRange(weekStart, weekEnd, weekMode), settings.totalWeeks);
  }, [weekMode, weekStart, weekEnd, customWeeks, settings.totalWeeks]);

  const draft: Course = {
    id: course?.id ?? 'draft', code, name, className, teacher, location, weekday, startPeriod, endPeriod,
    weeks, color, reminderEnabled: reminderMode !== 'off',
    reminderMinutes: reminderMode === 'custom' ? reminderMinutes : undefined,
  };
  const conflicts = courses.filter((other) => other.id !== course?.id && coursesOverlap(draft, other));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setLocalError('请填写课程名称');
    if (endPeriod < startPeriod) return setLocalError('结束节次不能早于开始节次');
    if (!weeks.length) return setLocalError('请至少选择一个有效周数');
    if (reminderMode === 'custom' && (reminderMinutes < 0 || reminderMinutes > 1440)) {
      return setLocalError('提醒时间应为 0—1440 分钟');
    }
    const input: CourseInput = {
      code, name, className, teacher, location, weekday, startPeriod, endPeriod, weeks, color,
      reminderEnabled: reminderMode !== 'off',
      reminderMinutes: reminderMode === 'custom' ? reminderMinutes : undefined,
    };
    onSave(course ? { ...input, id: course.id } : input);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal course-modal" onSubmit={submit}>
        <div className="modal-header"><div><h2>{course ? '编辑课程' : '添加课程'}</h2><p>设置课程信息、上课周次与提醒</p></div><button type="button" className="close-button" onClick={onClose}>×</button></div>
        <div className="form-grid">
          <label className="full"><span>课程名称 *</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：高等数学" /></label>
          <label><span>课程编号</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如：MATH101" /></label>
          <label><span>班级</span><input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="例如：计算机一班" /></label>
          <label><span>教师</span><input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="教师姓名" /></label>
          <label><span>上课地点</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="教学楼与教室" /></label>
          <label><span>星期</span><select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>{['一','二','三','四','五','六','日'].map((day, i) => <option key={day} value={i + 1}>星期{day}</option>)}</select></label>
          <div className="field-pair">
            <label><span>开始节次</span><select value={startPeriod} onChange={(e) => { const value = Number(e.target.value); setStartPeriod(value); if (endPeriod < value) setEndPeriod(value); }}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>第 {i + 1} 节</option>)}</select></label>
            <label><span>结束节次</span><select value={endPeriod} onChange={(e) => setEndPeriod(Number(e.target.value))}>{Array.from({ length: 12 - startPeriod + 1 }, (_, i) => <option key={i} value={startPeriod + i}>第 {startPeriod + i} 节</option>)}</select></label>
          </div>
          <fieldset className="full"><legend>上课周数</legend>
            <div className="segmented">{([['all','连续周'],['odd','单周'],['even','双周'],['custom','自定义']] as const).map(([value,label]) => <button key={value} type="button" className={weekMode === value ? 'active' : ''} onClick={() => setWeekMode(value)}>{label}</button>)}</div>
            {weekMode === 'custom' ? <input value={customWeeks} onChange={(e) => setCustomWeeks(e.target.value)} placeholder="例如：1, 2, 5, 8" /> : <div className="week-range"><input type="number" min="1" max={settings.totalWeeks} value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))} /><span>至</span><input type="number" min="1" max={settings.totalWeeks} value={weekEnd} onChange={(e) => setWeekEnd(Number(e.target.value))} /><span>周</span></div>}
            <small>已选择：{weeks.length ? `第 ${weeks.join('、')} 周` : '无有效周次'}</small>
          </fieldset>
          <fieldset className="full"><legend>课程颜色</legend><div className="color-picker">{COLORS.map((item) => <button type="button" key={item} aria-label={`选择颜色 ${item}`} className={color === item ? 'active' : ''} style={{ backgroundColor: item }} onClick={() => setColor(item)} />)}</div></fieldset>
          <label className="full"><span>课前提醒</span><select value={reminderMode} onChange={(e) => setReminderMode(e.target.value as typeof reminderMode)}><option value="inherit">使用全局设置（提前 {settings.defaultReminderMinutes} 分钟）</option><option value="custom">为本课程单独设置</option><option value="off">关闭本课程提醒</option></select></label>
          {reminderMode === 'custom' && <label className="full"><span>提前分钟数</span><input type="number" min="0" max="1440" value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} /></label>}
        </div>
        {conflicts.length > 0 && <div className="warning">⚠ 与 {conflicts.map((item) => item.name).join('、')} 的上课时间冲突，保存后会并列显示。</div>}
        {localError && <div className="form-error">{localError}</div>}
        <div className="modal-footer">{course && <button type="button" className="danger-button" onClick={() => onDelete(course)}>删除课程</button>}<span /><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">保存课程</button></div>
      </form>
    </div>
  );
}
