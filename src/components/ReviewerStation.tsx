import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Lock, Send, UserX } from 'lucide-react';
import { useLab } from '../lab/store';
import { reviewEligibility } from '../lab/pairs';
import { RULE_META } from './ui';
import type { Id, RecordingVersion, RuleCode } from '../lab/types';
import { Player } from './Audio';
import { fmtTime, StatusBadge } from './ui';

type Tab = 'pool' | 'mine' | 'done';

export function ReviewerStation({ onToast }: { onToast: (ok: boolean, msg: string) => void }) {
  const { state, reviewer, claimVersion, releaseClaim, submitReview } = useLab();
  const [tab, setTab] = useState<Tab>('pool');
  const [showIneligible, setShowIneligible] = useState(false);

  const pendingPool = useMemo(
    () =>
      state.versions
        .filter((v) => v.status === 'pending')
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.versions],
  );
  const mineClaimed = useMemo(
    () => state.versions.filter((v) => v.status === 'claimed' && v.claimedBy === reviewer.id),
    [state.versions, reviewer.id],
  );
  const mineDone = useMemo(
    () =>
      state.versions
        .filter((v) => (v.status === 'reviewed' || v.status === 'returned') && v.review?.reviewerId === reviewer.id)
        .sort((a, b) => (b.review?.reviewedAt ?? 0) - (a.review?.reviewedAt ?? 0)),
    [state.versions, reviewer.id],
  );

  const assignmentOf = (id: Id) => state.assignments.find((a) => a.id === id);
  const studentOf = (id: Id) => state.students.find((s) => s.id === id);

  return (
    <div className="rl-review-wrap">
      <div className="rl-tabs">
        <button className={tab === 'pool' ? 'active' : ''} onClick={() => setTab('pool')}>评审池 <b>{pendingPool.length}</b></button>
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>我认领的 <b>{mineClaimed.length}</b></button>
        <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>我已评审 <b>{mineDone.length}</b></button>
        {tab === 'pool' && (
          <label className="rl-check">
            <input type="checkbox" checked={showIneligible} onChange={(e) => setShowIneligible(e.target.checked)} />
            <Eye size={13} /> 显示我不能评审的录音（可尝试操作以查看受阻原因）
          </label>
        )}
      </div>

      {tab === 'pool' && (
        <div className="rl-pool">
          {pendingPool.length === 0 && <div className="rl-empty">评审池暂时是空的。</div>}
          {pendingPool.map((v) => {
            const elig = reviewEligibility(state.students, v, reviewer.id);
            if (!showIneligible && !elig.eligible) return null;
            return (
              <PoolRow
                key={v.id}
                v={v}
                eligible={elig.eligible}
                reason={elig.eligible ? undefined : elig.reason}
                onClaim={() => {
                  const r = claimVersion(v.id);
                  if (r.ok) {
                    onToast(true, `已独占认领 ${studentOf(v.studentId)?.name} 的录音，请尽快给出评审`);
                    setTab('mine');
                  } else onToast(false, r.message);
                }}
              />
            );
          })}
          {!showIneligible && pendingPool.every((v) => !reviewEligibility(state.students, v, reviewer.id).eligible) && pendingPool.length > 0 && (
            <div className="rl-notice">
              池中录音都不满足评审资格（本人 / 同组 / 已被认领）。勾选“显示我不能评审的录音”可查看规则判定。
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="rl-pool">
          {mineClaimed.length === 0 && <div className="rl-empty">还没有认领的录音；去评审池认领一份（一人一份，认领即独占）。</div>}
          {mineClaimed.map((v) => (
            <ReviewForm
              key={v.id}
              v={v}
              passScore={assignmentOf(v.assignmentId)?.passScore ?? 60}
              onRelease={() => { releaseClaim(v.id); onToast(true, '已解除认领，录音归还评审池'); }}
              onSubmit={(score, comment) => {
                const r = submitReview(v.id, score, comment);
                if (r.ok)
                  onToast(
                    true,
                    score >= (assignmentOf(v.assignmentId)?.passScore ?? 60)
                      ? '评审已提交，录音通过'
                      : '分数低于及格线，已退回作者重录；本版作为旧稿留档',
                  );
                else onToast(false, r.message);
              }}
            />
          ))}
        </div>
      )}

      {tab === 'done' && (
        <div className="rl-pool">
          {mineDone.length === 0 && <div className="rl-empty">尚未完成评审。</div>}
          {mineDone.map((v) => (
            <div key={v.id} className="rl-pool-row done">
              <VersionMeta v={v} />
              <div className="rl-done-score">
                <b className={v.status === 'reviewed' ? 'pass' : 'fail'}>{v.review!.score}</b>
                <StatusBadge status={v.status} />
              </div>
              <p className="rl-done-comment">“{v.review!.comment}”</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  function PoolRow({
    v,
    eligible,
    reason,
    onClaim,
  }: {
    v: RecordingVersion;
    eligible: boolean;
    reason?: 'own' | 'same-group' | 'status' | 'taken';
    onClaim: () => void;
  }) {
    const a = assignmentOf(v.assignmentId);
    const author = studentOf(v.studentId);
    const reasonText: Record<string, { rule: RuleCode; text: string; icon: React.ReactNode }> = {
      own: { rule: 'REVIEW_OWN', text: RULE_META.REVIEW_OWN.text, icon: <UserX size={13} /> },
      'same-group': { rule: 'SAME_GROUP', text: RULE_META.SAME_GROUP.text, icon: <Lock size={13} /> },
      status: { rule: 'ALREADY_CLAIMED', text: RULE_META.ALREADY_CLAIMED.text, icon: <Lock size={13} /> },
      taken: { rule: 'ALREADY_CLAIMED', text: RULE_META.ALREADY_CLAIMED.text, icon: <Lock size={13} /> },
    };
    return (
      <div className={`rl-pool-row ${eligible ? '' : 'ineligible'}`}>
        <VersionMeta v={v} />
        <div className="rl-pool-action">
          {eligible ? (
            <button className="rl-btn primary" onClick={onClaim}><CheckCircle2 size={14} /> 认领评审（独占）</button>
          ) : (
            <>
              <span className="rl-blocked-reason">{reasonText[reason ?? 'taken'].icon} {reasonText[reason ?? 'taken'].text}</span>
              <button className="rl-btn ghost" onClick={onClaim} title="强行尝试将被规则拦截并记录">尝试认领</button>
            </>
          )}
          <small>{a?.title} · 第 {v.sentenceIndex + 1} 句 · 作者 {author?.name}（第 {author?.group} 组）</small>
        </div>
      </div>
    );
  }

  function VersionMeta({ v }: { v: RecordingVersion }) {
    const a = assignmentOf(v.assignmentId);
    const author = studentOf(v.studentId);
    return (
      <div className="rl-version-meta">
        <div className="rl-version-sentence">{a?.sentences[v.sentenceIndex]}</div>
        <Player bars={v.wave} durationSec={v.durationSec} compact />
        <small>{author?.name} · 第 {author?.group} 组 · v{v.version} · {fmtTime(v.createdAt)}</small>
      </div>
    );
  }
}

function ReviewForm({
  v,
  passScore,
  onRelease,
  onSubmit,
}: {
  v: RecordingVersion;
  passScore: number;
  onRelease: () => void;
  onSubmit: (score: number, comment: string) => void;
}) {
  const [score, setScore] = useState<number>(80);
  const [comment, setComment] = useState('');
  const below = score < passScore;
  return (
    <div className="rl-review-form">
      <div className="rl-review-form-top">
        <div>
          <div className="rl-version-sentence">待评审录音 v{v.version}</div>
          <small>认领于 {v.claimedAt ? fmtTime(v.claimedAt) : '—'} · 及格线 {passScore} 分</small>
        </div>
        <button className="rl-mini" onClick={onRelease}>解除认领，归还评审池</button>
      </div>
      <Player bars={v.wave} durationSec={v.durationSec} />
      <label className="rl-score-input">
        评分（0–100）
        <input type="range" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} />
        <b className={below ? 'fail' : 'pass'}>{score}</b>
      </label>
      {below && <div className="rl-notice warn">低于及格线 {passScore} 分：提交后该版本退回作者重录并另存为旧稿（仍可查），该句重新开放提交。</div>}
      <textarea
        placeholder="给出评语：发音、节奏、语调……"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="rl-form-actions">
        <button className="rl-btn primary" onClick={() => onSubmit(score, comment)} disabled={!comment.trim()}>
          <Send size={14} /> 提交评审
        </button>
        {!comment.trim() && <span className="rl-hint">评语为必填项</span>}
      </div>
    </div>
  );
}
