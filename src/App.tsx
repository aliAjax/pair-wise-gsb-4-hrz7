import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, GraduationCap, Mic, ShieldAlert, Sliders, Users } from 'lucide-react';
import { LabProvider, useLab } from './lab/store';
import { StudentDesk } from './components/StudentDesk';
import { ReviewerStation } from './components/ReviewerStation';
import { TeacherStation } from './components/TeacherStation';
import { BlockLog } from './components/BlockLog';

type View = 'work' | 'review' | 'teacher' | 'blocks';

function Shell() {
  const { state, prefs, setPrefs, student, reviewer } = useLab();
  const [view, setView] = useState<View>(() => (prefs.mode === 'teacher' ? 'teacher' : 'work'));
  const [toast, setToast] = useState<{ ok: boolean; msg: string; key: number } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const onToast = useCallback((ok: boolean, msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ok, msg, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const nav: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'work', label: '学生录音台', icon: <Mic size={16} /> },
    { id: 'review', label: '同伴评审台', icon: <Users size={16} /> },
    { id: 'blocks', label: '受阻记录', icon: <ShieldAlert size={16} /> },
    { id: 'teacher', label: '教师台', icon: <GraduationCap size={16} /> },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Mic size={18} /></div>
          <div>
            <strong>朗读互评台</strong>
            <span>READING HOMEWORK · PEER REVIEW</span>
          </div>
        </div>

        <div className="side-label">身份切换</div>
        <div className="rl-mode-switch">
          <button className={prefs.mode === 'student' ? 'active' : ''} onClick={() => { setPrefs({ mode: 'student' }); setView('work'); }}>
            <Mic size={14} /> 学生
          </button>
          <button className={prefs.mode === 'teacher' ? 'active' : ''} onClick={() => { setPrefs({ mode: 'teacher' }); setView('teacher'); }}>
            <GraduationCap size={14} /> 教师
          </button>
        </div>

        {prefs.mode === 'student' && (
          <>
            <div className="side-label">扮演学生</div>
            <select
              className="rl-person-select"
              value={prefs.studentId}
              onChange={(e) => setPrefs({ studentId: Number(e.target.value) })}
            >
              {state.students.map((s) => <option key={s.id} value={s.id}>{s.name}（第 {s.group} 组）</option>)}
            </select>
            <div className="side-label" style={{ marginTop: 16 }}>扮演评审人</div>
            <select
              className="rl-person-select"
              value={prefs.reviewerId}
              onChange={(e) => setPrefs({ reviewerId: Number(e.target.value) })}
            >
              {state.students.map((s) => <option key={s.id} value={s.id}>{s.name}（第 {s.group} 组）</option>)}
            </select>
          </>
        )}

        <div className="side-label" style={{ marginTop: 22 }}>导航</div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={view === n.id ? 'side-link active' : 'side-link'} onClick={() => setView(n.id)}>
              {n.icon}{n.label}
              {n.id === 'blocks' && state.blocks.length > 0 && <b>{state.blocks.length}</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="streak">
            <span>当前规则</span>
            <strong style={{ fontSize: 12, lineHeight: 1.7 }}>
              逾期不接收 · 每句一条有效稿<br />
              同组不互评 · 一份录音一位评审
            </strong>
            <i>低于及格线退回重录，旧稿留档</i>
          </div>
          <div className="profile">
            <div className="avatar">{prefs.mode === 'teacher' ? '师' : student.initials}</div>
            <div>
              <strong>{prefs.mode === 'teacher' ? '教师视角' : `${student.name} · 评审 ${reviewer.name}`}</strong>
              <span><Sliders size={9} /> 数据 · 规则 · 页面分层</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">READING HOMEWORK · SUBMISSION &amp; PEER REVIEW</p>
            <h1>{titleOf(view)}</h1>
          </div>
          <div className="top-actions">
            {view === 'work' && <span className="rl-identity">学生：<b>{student.name}</b>（第 {student.group} 组）</span>}
            {view === 'review' && <span className="rl-identity">评审人：<b>{reviewer.name}</b>（第 {reviewer.group} 组）</span>}
          </div>
        </header>

        {view === 'work' && <StudentDesk onToast={onToast} />}
        {view === 'review' && <ReviewerStation onToast={onToast} />}
        {view === 'teacher' && <TeacherStation onToast={onToast} />}
        {view === 'blocks' && <BlockLog />}
      </main>

      {toast && (
        <div key={toast.key} className={`rl-toast ${toast.ok ? 'ok' : 'err'}`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function titleOf(v: View) {
  switch (v) {
    case 'work': return '朗读作业提交';
    case 'review': return '同伴互评';
    case 'teacher': return '教师工作台';
    case 'blocks': return '受阻与规则审计';
  }
}

export default function App() {
  return (
    <LabProvider>
      <Shell />
    </LabProvider>
  );
}
