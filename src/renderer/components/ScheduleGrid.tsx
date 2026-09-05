import type { AppSettings, Course } from '../../shared/types';
import { dateForWeekday, layoutCourses } from '../../shared/schedule';

const DAYS = [
  ['星期一', 'Monday'], ['星期二', 'Tuesday'], ['星期三', 'Wednesday'], ['星期四', 'Thursday'],
  ['星期五', 'Friday'], ['星期六', 'Saturday'], ['星期日', 'Sunday'],
];

interface Props {
  settings: AppSettings;
  courses: Course[];
  week: number;
  isCurrentWeek: boolean;
  highlightedId?: string;
  onCourseClick(course: Course): void;
}

export default function ScheduleGrid({ settings, courses, week, isCurrentWeek, highlightedId, onCourseClick }: Props) {
  const today = new Date().getDay() || 7;
  return (
    <main className="schedule-scroll">
      <div className="schedule" style={{ '--period-count': 12 } as React.CSSProperties}>
        <div className="corner-cell">节次</div>
        {DAYS.map(([cn, en], index) => {
          const weekday = index + 1;
          const date = dateForWeekday(settings.firstWeekMonday, week, weekday);
          const active = isCurrentWeek && today === weekday;
          return (
            <div className={`day-header ${active ? 'today' : ''}`} key={cn}>
              <strong>{cn}</strong><small>{en}</small><span>{date.getMonth() + 1}/{date.getDate()}</span>
            </div>
          );
        })}
        <div className="period-gutter">
          {settings.periods.map((period) => (
            <div className="period-label" key={period.period}>
              <strong>{period.period}</strong><span>{period.start}<br />{period.end}</span>
            </div>
          ))}
        </div>
        {DAYS.map((_, index) => {
          const weekday = index + 1;
          const active = isCurrentWeek && today === weekday;
          const dayCourses = courses.filter((course) => course.weekday === weekday);
          const layouts = layoutCourses(dayCourses);
          return (
            <div className={`day-column ${active ? 'today' : ''}`} key={weekday}>
              {settings.periods.map((period) => <div className="period-slot" key={period.period} style={{ gridRow: period.period }} />)}
              {layouts.map(({ course, lane, laneCount, conflicting }) => (
                <button
                  key={course.id}
                  className={`course-card ${highlightedId === course.id ? 'highlighted' : ''}`}
                  style={{
                    gridRow: `${course.startPeriod} / ${course.endPeriod + 1}`,
                    backgroundColor: course.color,
                    width: `calc(${100 / laneCount}% - 5px)`,
                    marginLeft: `calc(${lane * 100 / laneCount}% + 2px)`,
                  }}
                  title={`${course.name}，点击编辑`}
                  onClick={() => onCourseClick(course)}
                >
                  <strong>{course.name}</strong>
                  {course.code && <span>课程编号：{course.code}</span>}
                  {course.className && <span>班级：{course.className}</span>}
                  {course.teacher && <span>教师：{course.teacher}</span>}
                  <span>第 {course.startPeriod}-{course.endPeriod} 节 · {formatWeeks(course.weeks)}</span>
                  {course.location && <span className="location">⌖ {course.location}</span>}
                  {conflicting && <em>时间冲突</em>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function formatWeeks(weeks: number[]): string {
  if (!weeks.length) return '无有效周次';
  const consecutive = weeks.every((week, index) => index === 0 || week === weeks[index - 1] + 1);
  if (consecutive && weeks.length > 2) return `${weeks[0]}-${weeks.at(-1)}周`;
  return `${weeks.join('、')}周`;
}
