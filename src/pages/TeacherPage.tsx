import { useState } from 'react';
import { AlertTriangle, Check, Clock3, ListChecks, Plus, Users } from 'lucide-react';
import type { LabStore } from '../data/store';
import { activeVersion, fmtDeadline, fmtDuration, fmtTime, getAssignment, getSentence, getStudent, getSubmission, pairOf } from '../rules/common';

type Tab = 'assignments' | 'pairs' | 'blockers';

export default function TeacherPage({ store }: { store: LabStore }) {
  const [tab, setTab] = useState<Tab>('assignments');
  return (
    <div className="teacher-page">
      <div className="tabs teacher-tabs">
        <button className={tab === 'assignments' ? 'tab active' : 'tab'} onClick={() => setTab('assignments')}><ListChecks size={14} /> 作业与提交</button>
        <button className={tab === 'pairs' ? 'tab active' : 'tab'} onClick={() => setTab('pairs')}><Users size={14} /> 互评配对</button>
        <button className={tab === 'blockers' ? 'tab active' : 'tab'} onClick={() => setTab('blockers')}>
          <AlertTriangle size={14} /> 受阻总表 {store.blockers.length > 0 && <b className="tab-count">{store.blockers.length}</b>}
        </button>
      </div>
      {tab === 'assignments' && <AssignmentsTab store={store} />}
      {tab === 'pairs' && <PairsTab store={store} />}
      {tab === 'blockers' && <BlockersTab store={store} />}
    </div>
  );
}

/* ---------------- 作业与提交 ---------------- */

function toLocalInputValue(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AssignmentsTab({ store }: { store: LabStore }) {
  const { state, now } = store;
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState('');
  const [deadline, setDeadline] = useState(toLocalInputValue(now + 3 * 86_400_000));
  const [passScore, setPassScore] = useState(60);
  const [openId, setOpenId] = useState<string | undefined>(state.assignments[0]?.id);

  const submit = () => {
    store.createAssignment({
      title,
      sentences: sentences.split('\n'),
      deadline: new Date(deadline).getTime(),
      passScore: Number(passScore),
    });
    setShowCreate(false);
    setTitle(''); setSentences('');
  };

  return (
    <div className="teacher-grid">
      <div className="card">
        <div className="card-head row-head">
          <div><h2>句子作业</h2><p>布置句子并设截止时刻，逾期系统自动关闭提交通道</p></div>
          <button className="primary" onClick={() => setShowCreate(v => !v)}><Plus size={15} /> 布置新作业</button>
        </div>

        {showCreate && (
          <div className="create-form">
            <label>作业标题<input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：第四周朗读 · 情绪表达" /></label>
            <label>朗读句子（每行一句）
              <textarea rows={4} value={sentences} onChange={e => setSentences(e.target.value)} placeholder={'The morning light feels different today.\nCould you walk me through the next step?'} />
            </label>
            <div className="form-row">
              <label>截止时刻<input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
              <label>及格线（分）<input type="number" min={1} max={99} value={passScore} onChange={e => setPassScore(Number(e.target.value))} /></label>
            </div>
            <div className="record-actions"><button className="primary" onClick={submit}>发布作业</button><button className="ghost" onClick={() => setShowCreate(false)}>取消</button></div>
          </div>
        )}

        <div className="teacher-assigns">
          {state.assignments.map(a => {
            const closed = now > a.deadline;
            const cells = state.students.length * a.sentences.length;
            const submitted = state.submissions.filter(s => s.assignmentId === a.id && activeVersion(s)).length;
            const reviews = state.reviews.filter(r => r.assignmentId === a.id && r.submittedAt).length;
            return (
              <div key={a.id} className={openId === a.id ? 'teacher-assign open' : 'teacher-assign'}>
                <button className="assign-summary" onClick={() => setOpenId(openId === a.id ? undefined : a.id)}>
                  <div className="assign-copy">
                    <strong>{a.title}</strong>
                    <span><Clock3 size={11} /> 截止 {fmtDeadline(a.deadline)} · 及格线 {a.passScore} · {a.sentences.length} 句</span>
                  </div>
                  <div className="assign-stats">
                    <span><b>{submitted}</b>/{cells} 条有效稿</span>
                    <span><b>{reviews}</b> 份已评</span>
                    <span className={closed ? 'status-closed' : 'status-open'}>{closed ? '已截止' : '进行中'}</span>
                  </div>
                </button>
                {openId === a.id && <SubmissionMatrix store={store} assignmentId={a.id} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SubmissionMatrix({ store, assignmentId }: { store: LabStore; assignmentId: string }) {
  const { state } = store;
  const a = getAssignment(state, assignmentId)!;
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th>学生 ＼ 句子</th>
            {a.sentences.map((s, i) => <th key={s.id} title={s.text}>第 {i + 1} 句</th>)}
          </tr>
        </thead>
        <tbody>
          {state.students.map(st => (
            <tr key={st.id}>
              <th className="row-name">{st.name}{pairOf(state, st.id) ? '' : ' · 未编组'}</th>
              {a.sentences.map(sent => {
                const sub = getSubmission(state, a.id, sent.id, st.id);
                const v = activeVersion(sub);
                const rv = v ? state.reviews.find(r => r.versionId === v.id) : undefined;
                const rejected = sub?.versions.some(x => x.status === 'rejected');
                return (
                  <td key={sent.id}>
                    {v ? (
                      <span className={`cell ${rv?.submittedAt ? (rv.score! >= a.passScore ? 'pass' : 'fail') : rv ? 'draft' : 'submitted'}`}>
                        v{v.seq}{rv?.submittedAt ? ` · ${rv.score}` : rv ? ' · 评审中' : ''}
                      </span>
                    ) : rejected ? (
                      <span className="cell fail">退回待录</span>
                    ) : (
                      <span className="cell none">未交</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="matrix-versions">
        {state.submissions.filter(s => s.assignmentId === a.id).map(sub => (
          <details key={sub.id} className="version-row teacher">
            <summary>
              <b>{getStudent(state, sub.studentId)?.name}</b> · {getSentence(a, sub.sentenceId)?.text}
              <span className="version-meta">{sub.versions.length} 个版本</span>
            </summary>
            {[...sub.versions].reverse().map(v => {
              const rv = state.reviews.find(r => r.versionId === v.id);
              return (
                <div key={v.id} className="tv-line">
                  <span className={`badge ${v.status === 'active' ? 'ok' : v.status === 'rejected' ? 'bad' : 'muted-badge'}`}>第 {v.seq} 版 · {v.status === 'active' ? '有效' : v.status === 'rejected' ? '退回' : '撤回'}</span>
                  <span className="version-meta">{fmtTime(v.recordedAt)} · {fmtDuration(v.durationSec)}</span>
                  {rv?.submittedAt && <span className={`score-chip ${rv.score! >= a.passScore ? 'pass' : 'fail'}`}>{getStudent(state, rv.reviewerId)?.name} {rv.score} 分</span>}
                  {rv && !rv.submittedAt && <span className="score-chip draft">{getStudent(state, rv.reviewerId)?.name} 草稿中</span>}
                </div>
              );
            })}
          </details>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 互评配对 ---------------- */

function PairsTab({ store }: { store: LabStore }) {
  const { state } = store;
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const unpaired = state.students.filter(st => !pairOf(state, st.id));

  return (
    <div className="pairs-grid">
      <div className="card">
        <div className="card-head"><h2>互评小组</h2><p>两人一组；一名学生只能属于一组；同组不得互评</p></div>
        <div className="pair-list">
          {state.pairs.map(p => {
            const sa = getStudent(state, p.a)!;
            const sb = getStudent(state, p.b)!;
            return (
              <div key={p.id} className="pair-row">
                <span className="avatar">{sa.initials}</span><b>{sa.name}</b>
                <span className="pair-link">互评互避</span>
                <b>{sb.name}</b><span className="avatar">{sb.initials}</span>
                <button className="ghost danger" onClick={() => store.removePair(p.id)}>解散</button>
              </div>
            );
          })}
          {state.pairs.length === 0 && <div className="empty">还没有小组</div>}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>组建新小组</h2><p>未编组学生（{unpaired.length} 人）</p></div>
        <div className="create-pair">
          <select value={a} onChange={e => setA(e.target.value)}>
            <option value="">选择学生…</option>
            {unpaired.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="pair-link">＋</span>
          <select value={b} onChange={e => setB(e.target.value)}>
            <option value="">选择学生…</option>
            {unpaired.filter(s => s.id !== a).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="primary" disabled={!a || !b} onClick={() => { store.addPair(a, b); setA(''); setB(''); }}>编组</button>
        </div>
        <ul className="unpaired-list">
          {unpaired.map(s => <li key={s.id}><span className="avatar small">{s.initials}</span>{s.name}</li>)}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- 受阻总表 ---------------- */

function BlockersTab({ store }: { store: LabStore }) {
  const { state } = store;
  const [scene, setScene] = useState<'全部' | '提交' | '评审'>('全部');
  const [kind, setKind] = useState('全部');
  const kinds = ['全部', ...Array.from(new Set(store.blockers.map(b => b.kind)))];
  const rows = store.blockers.filter(b => (scene === '全部' || b.scene === scene) && (kind === '全部' || b.kind === kind));

  return (
    <div className="card blockers-card">
      <div className="card-head"><h2>受阻总表</h2><p>刷新后与作业、提交、配对、版本保持一致；每行含学生、句子、录音版本与规则</p></div>
      <div className="filters">
        {(['全部', '提交', '评审'] as const).map(x => (
          <button key={x} className={scene === x ? 'chip active' : 'chip'} onClick={() => setScene(x)}>{x}受阻</button>
        ))}
        <span className="filter-divider" />
        {kinds.map(k => <button key={k} className={kind === k ? 'chip active' : 'chip'} onClick={() => setKind(k)}>{k}</button>)}
      </div>
      <div className="table-scroll">
        <table className="blockers-table">
          <thead><tr><th>场景</th><th>受阻学生</th><th>被评/作业学生</th><th>句子（作业）</th><th>录音版本</th><th>命中规则</th><th>说明</th></tr></thead>
          <tbody>
            {rows.map(b => {
              const asg = getAssignment(state, b.assignmentId);
              const sent = asg ? getSentence(asg, b.sentenceId) : undefined;
              return (
                <tr key={b.id}>
                  <td><span className={`scene-tag ${b.scene === '提交' ? 'submit' : 'review'}`}>{b.scene}</span><br /><span className="kind-tag">{b.kind}</span></td>
                  <td>{getStudent(state, b.studentId)?.name}</td>
                  <td>{getStudent(state, b.revieweeId)?.name}</td>
                  <td className="sent-cell">{sent?.text}<br /><span className="version-meta">{asg?.title}</span></td>
                  <td>{b.versionSeq ? `第 ${b.versionSeq} 版` : '—'}</td>
                  <td className="rule-cell">{b.rule}</td>
                  <td className="detail-cell">{b.detail}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7}><div className="empty"><Check size={16} /> 当前没有受阻项</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
