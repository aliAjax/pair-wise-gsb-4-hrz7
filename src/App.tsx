import { useState } from 'react';
import { AlertTriangle, ChevronRight, GraduationCap, RotateCcw, UserCircle2, Volume2 } from 'lucide-react';
import { useLabStore } from './data/store';
import StudentPage from './pages/StudentPage';
import TeacherPage from './pages/TeacherPage';
import { fmtDeadline } from './rules/common';

type Role = 'student' | 'teacher';

export default function App() {
  const store = useLabStore();
  const [role, setRole] = useState<Role>('student');
  const [studentId, setStudentId] = useState(store.state.students[0].id);
  const [clockOpen, setClockOpen] = useState(false);
  const [clockInput, setClockInput] = useState(() => toLocalInputValue(store.now));

  const me = store.state.students.find(s => s.id === studentId)!;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Volume2 size={19} /></div>
          <div><strong>声线朗读台</strong><span>READING · PEER REVIEW</span></div>
        </div>

        <div className="side-label">身份切换（演示）</div>
        <nav>
          <button className={role === 'student' ? 'side-link active' : 'side-link'} onClick={() => setRole('student')}>
            <UserCircle2 size={17} /> 学生端
          </button>
          <button className={role === 'teacher' ? 'side-link active' : 'side-link'} onClick={() => setRole('teacher')}>
            <GraduationCap size={17} /> 教师端
          </button>
        </nav>

        {role === 'student' && (
          <>
            <div className="side-label" style={{ marginTop: 18 }}>当前学生</div>
            <div className="student-switch">
              {store.state.students.map(s => (
                <button key={s.id} className={s.id === studentId ? 'student-pick active' : 'student-pick'} onClick={() => setStudentId(s.id)}>
                  <span className="avatar small">{s.initials}</span>{s.name}
                  {s.id === studentId && <ChevronRight size={13} />}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sidebar-foot">
          <div className="streak">
            <span>系统时间（可调，用于演示截止）</span>
            <strong style={{ fontSize: 14 }}>{fmtDeadline(store.now)}</strong>
            <button className="ghost" style={{ padding: '2px 0' }} onClick={() => { setClockInput(toLocalInputValue(store.now)); setClockOpen(v => !v); }}>
              <RotateCcw size={12} /> 调整时钟
            </button>
            {clockOpen && (
              <div className="clock-box">
                <input type="datetime-local" value={clockInput} onChange={e => setClockInput(e.target.value)} />
                <button className="secondary" onClick={() => { store.setNow(new Date(clockInput).getTime()); setClockOpen(false); }}>设定</button>
                <button className="ghost" onClick={() => { store.setNow(Date.now()); setClockOpen(false); }}>回到现在</button>
              </div>
            )}
          </div>
          <button className="ghost reset-demo" onClick={store.resetDemo}>重置演示数据</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{role === 'teacher' ? 'TEACHER CONSOLE' : `${me.name} 的工作台`}</p>
            <h1>{role === 'teacher' ? '朗读作业 · 提交与互评管理' : '朗读作业与同伴互评'}</h1>
          </div>
        </header>

        {store.error && (
          <div className="toast" onClick={() => store.setError(null)}>
            <AlertTriangle size={15} /> <span>{store.error}</span>
          </div>
        )}

        {role === 'student'
          ? <StudentPage store={store} studentId={studentId} />
          : <TeacherPage store={store} />}
      </main>
    </div>
  );
}

function toLocalInputValue(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
