import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Clock3, Mic, Send, Undo2, X } from 'lucide-react';
import type { Assignment, RecordingVersion, Review } from '../data/types';
import type { LabStore } from '../data/store';
import { activeVersion, fmtDeadline, fmtDuration, fmtTime, getAssignment, getSentence, getSubmission, isSamePair, pairOf, partnerOf, remaining } from '../rules/common';
import { blockersForStudent } from '../rules/blockers';
import { Recorder, VersionPlayer } from '../components/Audio';

const versionStatusBadge = (v: RecordingVersion): { text: string; cls: string } => {
  if (v.status === 'active') return { text: '当前有效稿', cls: 'ok' };
  if (v.status === 'withdrawn') return { text: '已撤回 · 旧稿可查', cls: 'muted-badge' };
  return { text: '已退回 · 需重录', cls: 'bad' };
};

const countDown = (ms: number) => {
  if (ms <= 0) return '已截止';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h > 0 ? `${h} 小时 ` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2)}`;
};

export default function StudentPage({ store, studentId }: { store: LabStore; studentId: string }) {
  const { state, now } = store;
  const [assignmentId, setAssignmentId] = useState(state.assignments[0]?.id ?? '');
  const [sentenceId, setSentenceId] = useState<string>('');
  const [tab, setTab] = useState<'work' | 'review' | 'blocked'>('work');
  const [reRecording, setReRecording] = useState(false);

  const assignment = getAssignment(state, assignmentId);
  const effectiveSentenceId = sentenceId && assignment?.sentences.some(s => s.id === sentenceId)
    ? sentenceId
    : assignment?.sentences[0]?.id ?? '';

  const partner = partnerOf(state, studentId);
  const myBlockers = useMemo(() => blockersForStudent(store.blockers, studentId), [store.blockers, studentId]);

  return (
    <div className="page-grid">
      <aside className="card assign-list">
        <div className="card-head">
          <h2>朗读作业</h2>
          <p>教师布置的句子作业与截止时刻</p>
        </div>
        {state.assignments.map(a => {
          const closed = now > a.deadline;
          const done = a.sentences.every(sent => activeVersion(getSubmission(state, a.id, sent.id, studentId)));
          return (
            <button
              key={a.id}
              className={a.id === assignmentId ? 'assign-row selected' : 'assign-row'}
              onClick={() => { setAssignmentId(a.id); setSentenceId(''); setReRecording(false); }}
            >
              <div className={`assign-dot ${closed ? 'closed' : done ? 'done' : ''}`} />
              <div className="assign-copy">
                <strong>{a.title}</strong>
                <span><Clock3 size={11} /> 截止 {fmtDeadline(a.deadline)} · {closed ? '已截止' : `剩余 ${countDown(remaining(a, now))}`}</span>
              </div>
              <ChevronRight size={15} />
            </button>
          );
        })}
        <div className="pair-hint">
          <span className="label">我的互评小组</span>
          {partner ? <p>与 <b>{state.students.find(x => x.id === partner)?.name}</b> 同组（同组不得互评）</p> : <p className="warn-text">尚未编组 — 无法参与互评，请联系老师</p>}
        </div>
      </aside>

      <section className="card work-panel">
        <div className="tabs">
          <button className={tab === 'work' ? 'tab active' : 'tab'} onClick={() => setTab('work')}><Mic size={14} /> 我的录音</button>
          <button className={tab === 'review' ? 'tab active' : 'tab'} onClick={() => setTab('review')}><Send size={14} /> 同伴互评</button>
          <button className={tab === 'blocked' ? 'tab active' : 'tab'} onClick={() => setTab('blocked')}>
            <AlertTriangle size={14} /> 受阻提示 {myBlockers.length > 0 && <b className="tab-count">{myBlockers.length}</b>}
          </button>
        </div>

        {tab === 'work' && assignment && (
          <WorkTab
            store={store} studentId={studentId} assignment={assignment}
            sentenceId={effectiveSentenceId} onSelectSentence={(id) => { setSentenceId(id); setReRecording(false); }}
            reRecording={reRecording} setReRecording={setReRecording}
          />
        )}
        {tab === 'review' && <ReviewTab store={store} studentId={studentId} />}
        {tab === 'blocked' && <BlockedTab store={store} studentId={studentId} blockers={myBlockers} />}
      </section>
    </div>
  );
}

/* ---------------- 我的录音 ---------------- */

function WorkTab({ store, studentId, assignment, sentenceId, onSelectSentence, reRecording, setReRecording }: {
  store: LabStore; studentId: string; assignment: Assignment; sentenceId: string;
  onSelectSentence: (id: string) => void; reRecording: boolean; setReRecording: (v: boolean) => void;
}) {
  const { state, now } = store;
  const closed = now > assignment.deadline;
  const sentence = getSentence(assignment, sentenceId);
  const sub = getSubmission(state, assignment.id, sentenceId, studentId);
  const cur = activeVersion(sub);
  const occupied = cur ? state.reviews.find(r => r.versionId === cur.id) : undefined;
  const feedback = state.reviews.filter(r => r.revieweeId === studentId && r.assignmentId === assignment.id && r.sentenceId === sentenceId && r.submittedAt);

  return (
    <div className="work-tab">
      <div className="sentence-strip">
        {assignment.sentences.map((sent, i) => {
          const s = getSubmission(state, assignment.id, sent.id, studentId);
          const v = activeVersion(s);
          return (
            <button key={sent.id} className={sent.id === sentenceId ? 'sent-chip active' : 'sent-chip'} onClick={() => onSelectSentence(sent.id)}>
              <span className="sent-no">第 {i + 1} 句</span>
              {v ? <Check size={12} className="sent-ok" /> : <Mic size={12} className="sent-todo" />}
            </button>
          );
        })}
      </div>

      {sentence && (
        <>
          <div className="focus-card">
            <div className="focus-tag">及格线 {assignment.passScore} 分 · {closed ? '已截止，逾期不接收' : <>距截止 <b>{countDown(remaining(assignment, now))}</b></>}</div>
            <p className="focus-text">{sentence.text}</p>
            {sentence.translation && <p className="focus-translation">{sentence.translation}</p>}
          </div>

          {/* 规则反馈：被退回 */}
          {sub?.versions.some(v => v.status === 'rejected') && (() => {
            const rejected = sub.versions.filter(v => v.status === 'rejected').slice(-1)[0];
            const rv = state.reviews.find(r => r.versionId === rejected.id && r.submittedAt);
            return (
              <div className="alert bad">
                <AlertTriangle size={15} />
                <div>
                  <b>第 {rejected.seq} 版低于及格线，已退回重录{closed && '（但作业已截止，无法复录）'}</b>
                  {rv && <span>评审 {state.students.find(x => x.id === rv.reviewerId)?.name}：{rv.score} 分 — {rv.comment}</span>}
                </div>
              </div>
            );
          })()}

          {/* 有效稿 */}
          {cur && !reRecording && (
            <div className="record-card">
              <div className="record-top">
                <div>
                  <span className="label">当前有效稿 · 第 {cur.seq} 版 · {cur.trigger}</span>
                  <h3>每句只保留一条有效录音{occupied ? '，该稿已被评审占用' : ''}</h3>
                </div>
                <span className={`badge ${versionStatusBadge(cur).cls}`}>{versionStatusBadge(cur).text}</span>
              </div>
              <VersionPlayer version={cur} />
              <p className="recorded-meta">录于 {fmtTime(cur.recordedAt)} · 时长 {fmtDuration(cur.durationSec)}</p>
              {!closed && (
                <div className="record-actions">
                  <button className="record-button" disabled={!!occupied} onClick={() => setReRecording(true)}
                    title={occupied ? '评审占用中，不能重录' : '重录将先撤回当前有效稿，旧稿仍可查'}>
                    <Undo2 size={15} /> 重录（先撤回旧稿）
                  </button>
                  <button className="secondary" disabled={!!occupied} onClick={() => store.withdraw(assignment.id, sentenceId, studentId)}>
                    撤回此稿
                  </button>
                  {occupied && <span className="hint-text warn-text">被 {state.students.find(x => x.id === occupied.reviewerId)?.name} {occupied.submittedAt ? '评审中（已交）' : '认领（草稿中）'}，暂不能撤回</span>}
                </div>
              )}
            </div>
          )}

          {/* 录音器：无有效稿 或 进入重录 */}
          {!cur || reRecording ? (
            closed ? (
              <div className="record-card"><div className="alert bad"><AlertTriangle size={15} /><div><b>作业已截止</b><span>逾期不接收录音，{cur ? '当前稿为最终提交' : '该句没有有效录音' }。</span></div></div></div>
            ) : (
              <div className="record-card">
                <div className="record-top">
                  <div><span className="label">{reRecording ? `撤回第 ${cur?.seq} 版后重录` : 'YOUR RECORDING'}</span>
                  <h3>{reRecording ? '旧稿将被标记为「已撤回」并保留可查' : '准备好后开始录音'}</h3></div>
                </div>
                <Recorder
                  onSave={(dur) => { store.record(assignment.id, sentenceId, studentId, dur); setReRecording(false); }}
                />
                {reRecording && <div className="record-actions"><button className="ghost" onClick={() => setReRecording(false)}><X size={14} /> 取消重录</button></div>}
              </div>
            )
          ) : null}

          {/* 版本历史：旧稿仍可查 */}
          {sub && sub.versions.length > 0 && (
            <div className="history">
              <div className="history-head"><span className="label">VERSION HISTORY</span><span>共 {sub.versions.length} 个版本，旧稿仍可查</span></div>
              {[...sub.versions].reverse().map(v => {
                const badge = versionStatusBadge(v);
                const rv = state.reviews.find(r => r.versionId === v.id && r.submittedAt);
                return (
                  <details key={v.id} className="version-row" open={v.status === 'active'}>
                    <summary>
                      <span className={`badge ${badge.cls}`}>第 {v.seq} 版 · {badge.text}</span>
                      <span className="version-meta">{v.trigger} · {fmtTime(v.recordedAt)} · {fmtDuration(v.durationSec)}</span>
                      {rv && <span className={`score-chip ${rv.score! >= assignment.passScore ? 'pass' : 'fail'}`}>{rv.score} 分</span>}
                      <ChevronRight size={14} className="caret" />
                    </summary>
                    <VersionPlayer version={v} compact />
                    {rv ? (
                      <div className={`review-note ${rv.score! >= assignment.passScore ? 'pass' : 'fail'}`}>
                        <b>{state.students.find(x => x.id === rv.reviewerId)?.name} 的评审 · {rv.score} 分</b>
                        <p>{rv.comment}</p>
                      </div>
                    ) : (
                      <p className="version-meta">该版本暂无评审{state.reviews.find(r => r.versionId === v.id) ? '（评审草稿中）' : ''}</p>
                    )}
                  </details>
                );
              })}
            </div>
          )}
          {feedback.length === 0 && cur && !sub?.versions.some(v => v.status === 'rejected') && (
            <p className="hint-text">提交后等待跨组同学认领评审；一份录音只接一位评审人。</p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- 同伴互评 ---------------- */

function ReviewTab({ store, studentId }: { store: LabStore; studentId: string }) {
  const { state } = store;
  const myDrafts = state.reviews.filter(r => r.reviewerId === studentId && !r.submittedAt);
  const myDone = state.reviews.filter(r => r.reviewerId === studentId && r.submittedAt);

  // 可认领：active、非自己、双方编组、跨组、尚无评审
  const claimable: { assignment: Assignment; versionId: string; sentenceId: string; revieweeId: string }[] = [];
  for (const sub of state.submissions) {
    const v = activeVersion(sub);
    if (!v) continue;
    if (sub.studentId === studentId) continue;
    if (!pairOf(state, studentId) || !pairOf(state, sub.studentId)) continue;
    if (isSamePair(state, studentId, sub.studentId)) continue;
    if (state.reviews.some(r => r.versionId === v.id)) continue;
    const a = getAssignment(state, sub.assignmentId);
    if (a) claimable.push({ assignment: a, versionId: v.id, sentenceId: sub.sentenceId, revieweeId: sub.studentId });
  }

  return (
    <div className="review-tab">
      <section className="review-col">
        <h3>待认领录音 <small>跨组 · 一份录音只接一位评审人</small></h3>
        {claimable.length === 0 && <div className="empty">暂无可评审的录音（被认领、同组或未编组的不在其列，见「受阻提示」）</div>}
        {claimable.map(c => {
          const sent = getSentence(c.assignment, c.sentenceId)!;
          const sub = getSubmission(state, c.assignment.id, c.sentenceId, c.revieweeId)!;
          const v = activeVersion(sub)!;
          return (
            <div key={c.versionId} className="claim-card">
              <div className="claim-head">
                <span className="avatar small">{state.students.find(x => x.id === c.revieweeId)?.initials}</span>
                <div><strong>{state.students.find(x => x.id === c.revieweeId)?.name}</strong><span>{c.assignment.title} · 第 {v.seq} 版</span></div>
              </div>
              <p className="claim-text">“{sent.text}”</p>
              <VersionPlayer version={v} compact />
              <button className="primary full" onClick={() => store.claim(c.versionId, studentId)}>认领并评审</button>
            </div>
          );
        })}
      </section>

      <section className="review-col">
        <h3>我的评审 <small>草稿即占用，提交后不可撤回</small></h3>
        {myDrafts.length === 0 && myDone.length === 0 && <div className="empty">还没有评审记录</div>}
        {myDrafts.map(r => <DraftReview key={r.id} store={store} review={r} studentId={studentId} />)}
        {myDone.map(r => <DoneReview key={r.id} store={store} review={r} />)}
      </section>
    </div>
  );
}

function DraftReview({ store, review, studentId }: { store: LabStore; review: Review; studentId: string }) {
  const [score, setScore] = useState(70);
  const [comment, setComment] = useState('');
  const { state } = store;
  const a = getAssignment(state, review.assignmentId);
  const sent = a ? getSentence(a, review.sentenceId) : undefined;
  const found = state.submissions.flatMap(s => s.versions).find(v => v.id === review.versionId);
  const failPreview = a && score < a.passScore;

  return (
    <div className="draft-card">
      <div className="claim-head">
        <span className="avatar small">{state.students.find(x => x.id === review.revieweeId)?.initials}</span>
        <div><strong>{state.students.find(x => x.id === review.revieweeId)?.name} 的录音</strong><span>{sent?.text}</span></div>
        <span className="badge review-badge">草稿占用中</span>
      </div>
      {found && <VersionPlayer version={found} compact />}
      <label className="score-row">
        分数 <input type="range" min={0} max={100} value={score} onChange={e => setScore(Number(e.target.value))} />
        <b className={failPreview ? 'fail-text' : 'pass-text'}>{score}</b>
        <span className="hint-text">及格线 {a?.passScore}</span>
      </label>
      {failPreview && <p className="warn-text small-warn">低于及格线，提交后该录音将退回给同学重录（另存新版本，旧稿仍可查）。</p>}
      <textarea placeholder="写下你的评语：发音、节奏、语调、重音…" value={comment} onChange={e => setComment(e.target.value)} />
      <div className="record-actions">
        <button className="primary" onClick={() => store.submitReview(review.id, studentId, { score, comment })}><Send size={14} /> 提交评审</button>
        <button className="secondary" onClick={() => store.discard(review.id, studentId)}>放弃草稿（释放录音）</button>
      </div>
    </div>
  );
}

function DoneReview({ store, review }: { store: LabStore; review: Review }) {
  const { state } = store;
  const a = getAssignment(state, review.assignmentId);
  const pass = a ? review.score! >= a.passScore : true;
  return (
    <div className="claim-card done">
      <div className="claim-head">
        <span className="avatar small">{state.students.find(x => x.id === review.revieweeId)?.initials}</span>
        <div><strong>{state.students.find(x => x.id === review.revieweeId)?.name}</strong><span>{fmtTime(review.submittedAt!)} 提交 · 已定稿</span></div>
        <span className={`score-chip ${pass ? 'pass' : 'fail'}`}>{review.score} 分 · {pass ? '通过' : '已退回'}</span>
      </div>
      <div className={`review-note ${pass ? 'pass' : 'fail'}`}><p>{review.comment}</p></div>
    </div>
  );
}

/* ---------------- 受阻提示 ---------------- */

function BlockedTab({ store, studentId, blockers }: { store: LabStore; studentId: string; blockers: ReturnType<typeof blockersForStudent> }) {
  const { state } = store;
  void studentId;
  return (
    <div className="blocked-tab">
      <p className="blocked-intro">以下是你目前「想做做不成」的操作，每条列出学生、句子、录音版本与命中的规则。</p>
      {blockers.length === 0 && <div className="empty"><Check size={16} /> 没有受阻项，一切顺畅。</div>}
      {blockers.map(b => {
        const a = getAssignment(state, b.assignmentId);
        const sent = a ? getSentence(a, b.sentenceId) : undefined;
        return (
          <div key={b.id} className={`blocker-row ${b.scene === '提交' ? 'scene-submit' : 'scene-review'}`}>
            <div className="blocker-icons">
              <span className={`scene-tag ${b.scene === '提交' ? 'submit' : 'review'}`}>{b.scene}</span>
              <span className="kind-tag">{b.kind}</span>
            </div>
            <div className="blocker-body">
              <p><b>{state.students.find(x => x.id === b.studentId)?.name}</b>
                {b.scene === '评审' && <> → 评审 <b>{state.students.find(x => x.id === b.revieweeId)?.name}</b></>}
                {b.versionSeq ? ` 的第 ${b.versionSeq} 版录音` : ' 的录音'}
              </p>
              <p className="blocker-sentence">句子：{sent?.text ?? b.sentenceId}（{a?.title}）</p>
              <p className="blocker-detail">{b.detail}</p>
              <p className="blocker-rule">规则：{b.rule}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
