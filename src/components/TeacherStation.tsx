import { useMemo, useState } from 'react';
import { BarChart3, Plus, RotateCcw, Users } from 'lucide-react';
import { useLab } from '../lab/store';
import { buildGroups } from '../lab/pairs';
import { deadlineLabel, isOpen } from '../lab/policy';
import { fmtDeadline, StatusBadge, toLocalInputValue } from './ui';

export function TeacherStation({ onToast }: { onToast: (ok: boolean, msg: string) => void }) {
  const { state, now, addAssignment, resetDemo } = useLab();
  const [tab, setTab] = useState<'board' | 'pairs'>('board');

  return (
    <div>
      <div className="rl-tabs">
        <button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}><BarChart3 size={14} /> 作业与提交总览</button>
        <button className={tab === 'pairs' ? 'active' : ''} onClick={() => setTab('pairs')}><Users size={14} /> 互评配对规则</button>
        <button className="rl-mini" style={{ marginLeft: 'auto' }} onClick={() => { resetDemo(); onToast(true, '已重置为示例数据'); }}>
          <RotateCcw size={13} /> 重置示例
        </button>
      </div>
      {tab === 'board' ? <Board /> : <PairsBoard />}

      <CreateAssignment
        onCreate={(input) => {
          const err = addAssignment(input);
          if (err) onToast(false, err);
          else onToast(true, `作业已布置，截止 ${fmtDeadline(input.deadline)}`);
        }}
      />
    </div>
  );
}

function Board() {
  const { state, now } = useLab();
  const groups = useMemo(() => buildGroups(state.students), [state.students]);

  return (
    <div className="rl-board">
      {state.assignments.map((a) => {
        const open = isOpen(a, now);
        const cells = state.students.map((stu) => {
          const perSentence = a.sentences.map((_, si) => {
            const list = state.versions
              .filter((v) => v.assignmentId === a.id && v.studentId === stu.id && v.sentenceIndex === si)
              .sort((x, y) => y.version - x.version);
            const active = list.find((v) => v.status === 'pending' || v.status === 'claimed');
            const last = list[0];
            return { active, last };
          });
          return { stu, perSentence };
        });
        const submitted = cells.filter((c) => c.perSentence.some((s) => s.active || s.last)).length;
        return (
          <section key={a.id} className="rl-panel rl-board-card">
            <header className="rl-board-head">
              <div>
                <h3>{a.title}</h3>
                <small>{a.sentences.length} 个句子 · 及格线 {a.passScore} 分 · 截止 {fmtDeadline(a.deadline)}</small>
              </div>
              <span className={open ? 'rl-badge claimed' : 'rl-badge withdrawn'}>{deadlineLabel(a, now)}</span>
            </header>

            <div className="rl-table-wrap">
              <table className="rl-table">
                <thead>
                  <tr>
                    <th>学生 / 组</th>
                    {a.sentences.map((s, i) => (
                      <th key={i} title={s}>第 {i + 1} 句</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.map(({ stu, perSentence }) => (
                    <tr key={stu.id}>
                      <td className="rl-cell-stu">
                        <span className="rl-avatar">{stu.initials}</span>
                        <b>{stu.name}</b>
                        <i>第 {stu.group} 组</i>
                      </td>
                      {perSentence.map((s, i) => (
                        <td key={i}>
                          {s.active ? (
                            <span className="rl-cell">
                              <StatusBadge status={s.active.status} />
                              <small>v{s.active.version}</small>
                            </span>
                          ) : s.last ? (
                            <span className="rl-cell">
                              <StatusBadge status={s.last.status} />
                              <small>v{s.last.version}{s.last.review ? ` · ${s.last.review.score} 分` : ''}</small>
                            </span>
                          ) : (
                            <span className="rl-cell none">未提交</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="rl-board-foot">{submitted}/{state.students.length} 名学生已有录音 · 逾期提交将被规则拦截</footer>
          </section>
        );
      })}
      <p className="rl-rule-line">
        配对：{groups.map((g) => `第${g.group}组 ${g.members.map((m) => m.name).join(' / ')}`).join('　·　')}
      </p>
    </div>
  );
}

function PairsBoard() {
  const { state } = useLab();
  const groups = useMemo(() => buildGroups(state.students), [state.students]);
  return (
    <section className="rl-panel rl-pairs">
      <h3>互评小组（两人一组）</h3>
      <ul className="rl-rule-list">
        <li>同组两人互为搭档，<b>同组之间不得互相评审</b>；评审对象必须来自其他组。</li>
        <li>评审前需在评审池<b>认领</b>录音：一份录音只接受一位评审人，认领后独占并锁定（作者不可撤回）。</li>
        <li>评审人可解除自己尚未完成的认领，把录音归还评审池。</li>
        <li>评审分数低于作业及格线时，录音退回作者重录：旧版本另存留档、仍可回放，新版本号递增。</li>
        <li>任何被拦截的操作都会写入「受阻记录」，含学生、句子、录音版本与命中规则。</li>
      </ul>
      <div className="rl-pair-cards">
        {groups.map((g) => (
          <div key={g.group} className="rl-pair-card">
            <span className="rl-pair-no">第 {g.group} 组</span>
            <div className="rl-pair-members">
              {g.members.map((m) => (
                <div key={m.id} className="rl-pair-member">
                  <span className="rl-avatar">{m.initials}</span>
                  <b>{m.name}</b>
                </div>
              ))}
            </div>
            <i className="rl-pair-ban">组内互评：禁止</i>
          </div>
        ))}
      </div>
      <CrossMatrix />
    </section>
  );
}

function CrossMatrix() {
  const { state } = useLab();
  return (
    <div className="rl-matrix-wrap">
      <h4>跨组可评审理查（行评审列作者）</h4>
      <table className="rl-table rl-matrix">
        <thead>
          <tr><th></th>{state.students.map((s) => <th key={s.id}>{s.name.slice(0, 1)}<small> 组{s.group}</small></th>)}</tr>
        </thead>
        <tbody>
          {state.students.map((r) => (
            <tr key={r.id}>
              <td className="rl-cell-stu"><b>{r.name}</b></td>
              {state.students.map((a) => {
                if (r.id === a.id) return <td key={a.id} className="m-self">本人</td>;
                const same = r.group === a.group;
                return <td key={a.id} className={same ? 'm-ban' : 'm-ok'}>{same ? '同组·禁' : '可评'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateAssignment({ onCreate }: { onCreate: (input: { title: string; sentences: string[]; passScore: number; deadline: number }) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState('');
  const [passScore, setPassScore] = useState(60);
  const [deadline, setDeadline] = useState(() => toLocalInputValue(Date.now() + 3 * 86400_000));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const list = sentences.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) return setError('请填写作业标题');
    if (list.length === 0) return setError('每行一个朗读句子，至少布置一句');
    const ts = new Date(deadline).getTime();
    if (!ts || ts <= Date.now()) return setError('截止时刻必须晚于当前时间');
    onCreate({ title, sentences: list, passScore, deadline: ts });
    setTitle(''); setSentences(''); setPassScore(60); setError(null); setOpen(false);
  };

  if (!open)
    return <button className="rl-btn dashed" onClick={() => setOpen(true)}><Plus size={15} /> 布置新的朗读作业</button>;

  return (
    <section className="rl-panel rl-create">
      <h3>布置朗读作业</h3>
      <label>作业标题<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：朗读作业 D · 情景对话" /></label>
      <label>朗读句子（每行一句）<textarea rows={4} value={sentences} onChange={(e) => setSentences(e.target.value)} placeholder={'The early bird catches the worm.\nSlow down and speak from your chest.'} /></label>
      <div className="rl-create-row">
        <label>及格线（低于即退回重录）
          <input type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} />
        </label>
        <label>截止时刻
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
      {error && <div className="rl-notice warn">{error}</div>}
      <div className="rl-form-actions">
        <button className="rl-btn primary" onClick={submit}><Plus size={14} /> 发布作业</button>
        <button className="rl-mini" onClick={() => setOpen(false)}>取消</button>
      </div>
    </section>
  );
}
