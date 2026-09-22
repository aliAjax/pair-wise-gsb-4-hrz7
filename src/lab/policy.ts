// 规则层（作业流转闸门）：提交 / 撤回 / 认领 / 评审四条操作的准入判定。
// 全部为纯函数，返回 {ok:true} 或 {ok:false, rule, message}，
// 由 store 统一执行并在受阻时落一条受阻记录。规则与数据、页面分开。

import { reviewEligibility } from './pairs';
import type { Assignment, GateResult, Id, RecordingVersion, RuleCode, Student } from './types';

const fail = (rule: RuleCode, message: string): GateResult => ({ ok: false, rule, message });

export const isOpen = (a: Assignment, now: number) => a.deadline > now;

export const deadlineLabel = (a: Assignment, now: number) =>
  isOpen(a, now) ? `距截止 ${formatRemaining(a.deadline - now)}` : '已截止 · 逾期不接收';

export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分 ${s % 60} 秒`;
}

const STATUS: Record<string, string> = {
  pending: '待评审',
  claimed: '评审中',
  reviewed: '已通过',
  returned: '已退回',
  withdrawn: '已撤回',
};
export const statusLabel = (s: RecordingVersion['status']) => STATUS[s];

/** 规则1+2：提交录音 —— 作业未截止，且该句当前没有有效稿 */
export function canSubmit(
  assignment: Assignment | undefined,
  versions: RecordingVersion[],
  studentId: Id,
  sentenceIndex: number,
  now: number,
): GateResult {
  if (!assignment) return fail('NOT_ACTIVE', '作业不存在');
  if (!isOpen(assignment, now))
    return fail('DEADLINE_PASSED', `《${assignment.title}》已截止，逾期不再接收任何提交`);
  const active = versions.find(
    (v) =>
      v.assignmentId === assignment.id &&
      v.studentId === studentId &&
      v.sentenceIndex === sentenceIndex &&
      (v.status === 'pending' || v.status === 'claimed'),
  );
  if (active)
    return fail('ACTIVE_EXISTS', `第 ${sentenceIndex + 1} 句已有一条有效录音（${STATUS[active.status]}），请先撤回旧稿再重录`);
  return { ok: true };
}

/** 规则1 + 有效稿：撤回旧稿 —— 未截止、撤回的是自己的有效稿、且未被评审人锁定 */
export function canWithdraw(
  assignment: Assignment | undefined,
  v: RecordingVersion | undefined,
  studentId: Id,
  now: number,
): GateResult {
  if (!assignment) return fail('NOT_ACTIVE', '作业不存在');
  if (!isOpen(assignment, now))
    return fail('DEADLINE_PASSED', `《${assignment.title}》已截止，无法撤回旧稿`);
  if (!v || v.studentId !== studentId) return fail('NOT_ACTIVE', '只能撤回本人的录音');
  if (v.status === 'claimed')
    return fail('CLAIM_LOCKED', '该录音已被评审人认领并锁定，撤回通道关闭');
  if (v.status !== 'pending')
    return fail('NOT_ACTIVE', `旧稿（${STATUS[v.status]}）不是有效稿，无需也不能撤回；它会永久留档`);
  return { ok: true };
}

/** 规则3+4+5：认领评审 —— 非本人、非同组、且录音尚未被认领 */
export function canClaim(
  students: Student[],
  v: RecordingVersion | undefined,
  reviewerId: Id,
): GateResult {
  if (!v) return fail('NOT_CLAIMED', '录音不存在');
  const r = reviewEligibility(students, v, reviewerId);
  if (r.eligible) return { ok: true };
  if (r.reason === 'own') return fail('REVIEW_OWN', '不得评审本人的录音');
  if (r.reason === 'same-group') return fail('SAME_GROUP', '同组搭档之间不得互评，请选择其他组的录音');
  return fail('ALREADY_CLAIMED', '该录音已有评审人（一份录音只接一位评审人）');
}

/** 提交评审结果 —— 必须是认领人本人；分数低于及格线由 store 退回重录 */
export function canSubmitReview(
  v: RecordingVersion | undefined,
  reviewerId: Id,
  score: number,
  comment: string,
): GateResult {
  if (!v) return fail('NOT_CLAIMED', '录音不存在');
  if (v.status !== 'claimed' || v.claimedBy !== reviewerId)
    return fail('CLAIMED_BY_OTHER', '只有认领该录音的评审人才能提交评审结果');
  if (!Number.isFinite(score) || score < 0 || score > 100)
    return fail('NOT_CLAIMED', '请给出 0–100 的分数');
  if (!comment.trim()) return fail('NOT_CLAIMED', '请填写评语后再提交评审');
  return { ok: true };
}
