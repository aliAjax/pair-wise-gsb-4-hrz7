import { useMemo, useState } from 'react';
import { Clock3, History, Mic, Undo2 } from 'lucide-react';
import { useLab } from '../lab/store';
import { deadlineLabel, isOpen, statusLabel } from '../lab/policy';
import type { Assignment, Id, RecordingVersion } from '../lab/types';
import { Player, Recorder } from './Audio';
import { fmtTime, StatusBadge } from './ui';

export function StudentDesk({ onToast }: { onToast: (ok: boolean, msg: string) => void }) {
  const { state, student, now, submitRecording, withdrawVersion } = useLab();
  const [selAssignment, setSelAssignment] = useState<Id>(state.assignments[0]?.id ?? 0);
  const [selSentence, setSelSentence] = useState(0);

  const assignment = state.assignments.find((a) => a.id === selAssignment) ?? state.assignments[0];
  const mine = useMemo(
    () =>
      state.versions.filter(
        (v) => v.assignmentId === assignment?.id && v.studentId === student.id,
      ),
    [state.versions, assignment?.id, student.id],
  );

  if (!assignment) return <div className="rl-empty">还没有作业。</div>;

  const selectAssignment = (id: Id) => {
    setSelAssignment(id);
    setSelSentence(0);
  };

  return (
    <div className="rl-grid">
      {/* 左：作业与句子清单 */}
      <aside className="rl-panel rl-assign-list">
        <div className="rl-panel-label">教师布置的朗读作业</div>
        {state.assignments.map((a) => {
          const list = state.versions.filter((v) => v.assignmentId === a.id && v.studentId === student.id);
          const open = isOpen(a, now);
          return (
            <div key={a.id} className={`rl-assign-card ${a.id === assignment.id ? 'active' : ''} ${open ? '' : 'closed'}`}>
              <button className="rl-assign-head" onClick={() => selectAssignment(a.id)}>
                <strong>{a.title}</strong>
                <span className={open ? 'rl-live' : 'rl-dead'}>
                  <Clock3 size={12} /> {deadlineLabel(a, now)}
                </span>
              </button>
              {a.id === assignment.id && (
                <div className="rl-sentence-nav">
                  {a.sentences.map((s, i) => {
                    const v = activeVersion(list, i);
                    return (
                      <button key={i} className={i === selSentence ? 'active' : ''} onClick={() => setSelSentence(i)}>
                        <i>{i + 1}</i>
                        <span>{s}</span>
                        {v ? <b className={`dot ${v.status}`} /> : <b className="dot none" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* 右：句子工作台 */}
      <section className="rl-panel rl-work">
        <SentenceWork
          key={`${assignment.id}-${selSentence}`}
          assignment={assignment}
          sentenceIndex={selSentence}
          versions={mine.filter((v) => v.sentenceIndex === selSentence).sort((a, b) => b.version - a.version)}
          onSubmit={(sec, wave) => {
            const r = submitRecording(assignment.id, selSentence, sec, wave);
            if (r.ok) onToast(true, '录音已保存为当前有效稿，等待同伴评审');
            else onToast(false, r.message);
          }}
          onWithdraw={(id) => {
            const r = withdrawVersion(id);
            if (r.ok) onToast(true, '旧稿已撤回并留档，可以重新录音');
            else onToast(false, r.message);
          }}
        />
      </section>
    </div>
  );
}

function activeVersion(list: RecordingVersion[], sentenceIndex: number): RecordingVersion | undefined {
  return list
    .filter((v) => v.sentenceIndex === sentenceIndex && (v.status === 'pending' || v.status === 'claimed'))
    .sort((a, b) => b.version - a.version)[0];
}

function SentenceWork({
  assignment,
  sentenceIndex,
  versions,
  onSubmit,
  onWithdraw,
}: {
  assignment: Assignment;
  sentenceIndex: number;
  versions: RecordingVersion[];
  onSubmit: (sec: number, wave: number[]) => void;
  onWithdraw: (id: Id) => void;
}) {
  const { now, state } = useLab();
  const open = isOpen(assignment, now);
  const current = versions.find((v) => v.status === 'pending' || v.status === 'claimed');
  const archive = versions.filter((v) => v.status !== 'pending' && v.status !== 'claimed');
  const reviewerName = (id?: Id) => state.students.find((s) => s.id === id)?.name;

  return (
    <div>
      <div className="rl-focus">
        <div className="rl-focus-meta">
          <span>第 {sentenceIndex + 1} / {assignment.sentences.length} 句</span>
          <span>及格线 {assignment.passScore} 分</span>
          <span className={open ? 'rl-live' : 'rl-dead'}><Clock3 size={12} /> {deadlineLabel(assignment, now)}</span>
        </div>
        <p className="rl-focus-text">{assignment.sentences[sentenceIndex]}</p>
      </div>

      {!open && (
        <div className="rl-notice dead">作业已截止：不再接收新录音，也不能撤回旧稿。历史版本仍可在下方回放。</div>
      )}

      {/* 当前有效稿 */}
      {current ? (
        <div className="rl-current">
          <div className="rl-current-head">
            <StatusBadge status={current.status} />
            <span className="rl-ver">v{current.version} · {fmtTime(current.createdAt)}</span>
          </div>
          <Player bars={current.wave} durationSec={current.durationSec} />
          {current.status === 'claimed' && (
            <div className="rl-lock-note">已由 <b>{reviewerName(current.claimedBy)}</b> 认领评审，录音锁定：不能撤回或覆盖。</div>
          )}
          {current.review && (
            <ReviewCard v={current} />
          )}
          <div className="rl-current-actions">
            <button
              className="rl-btn warn"
              disabled={!open || current.status === 'claimed'}
              title={!open ? '已截止' : current.status === 'claimed' ? '评审中，锁定不可撤回' : '撤回后才能重录'}
              onClick={() => onWithdraw(current.id)}
            >
              <Undo2 size={14} /> 撤回旧稿并重录
            </button>
            <span className="rl-hint">每句只保留一条有效稿；撤回仅在截止前、且未被评审认领时允许。</span>
          </div>
        </div>
      ) : (
        <div className="rl-current">
          <div className="rl-current-head">
            <h4><Mic size={15} /> 录制有效稿</h4>
            {versions.some((v) => v.status === 'returned') && (
              <span className="rl-return-flag">上一版未达及格线被退回，本条通过后即成为新有效稿</span>
            )}
          </div>
          <Recorder
            disabled={!open}
            disabledReason={!open ? '作业已截止，无法提交录音' : undefined}
            onDone={onSubmit}
          />
        </div>
      )}

      {/* 版本历史：旧稿全部可查 */}
      {archive.length > 0 && (
        <div className="rl-history">
          <div className="rl-history-head"><History size={14} /> 版本记录（退回 / 撤回旧稿永久留档）</div>
          {archive.map((v) => (
            <div key={v.id} className="rl-archive-row">
              <div className="rl-archive-main">
                <div className="rl-archive-title">
                  <b>v{v.version}</b>
                  <StatusBadge status={v.status} />
                  <span>{fmtTime(v.createdAt)}</span>
                  {v.replacedBy !== undefined && <span className="rl-replaced">→ 已由 v{versions.find((x) => x.id === v.replacedBy)?.version ?? '?'} 替换</span>}
                </div>
                <Player bars={v.wave} durationSec={v.durationSec} compact />
                {v.review && <ReviewCard v={v} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ v }: { v: RecordingVersion }) {
  const { state } = useLab();
  if (!v.review) return null;
  const passed = v.status === 'reviewed';
  const reviewer = state.students.find((s) => s.id === v.review?.reviewerId);
  return (
    <div className={`rl-review-card ${passed ? 'pass' : 'fail'}`}>
      <div className="rl-score">
        <b>{v.review.score}</b>
        <span>{passed ? '达到及格线 · 通过' : `低于及格线 · ${statusLabel(v.status)}`}</span>
      </div>
      <div className="rl-review-body">
        <p>“{v.review.comment}”</p>
        <small>评审人：{reviewer?.name ?? '—'} · {fmtTime(v.review.reviewedAt)}</small>
      </div>
    </div>
  );
}
