import type { LabState } from '../data/types';
import { RuleError } from '../data/types';
import { getAssignment, isSamePair, pairOf, versionIn } from './common';

const rid = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * 规则 3 · 互评资格：
 * - 互评两人一组；评审人与被评人都必须已编组，且同组不得互评；
 * - 不能评审自己的录音；
 * - 一份录音（版本）只接一位评审人：草稿即占用，他人不能再认领；
 * - 只有当前有效稿（active）可被评审；撤回稿、退回稿、已评稿不可再认领。
 */
export function claimReview(s: LabState, versionId: string, reviewerId: string, now: number): LabState {
  const found = versionIn(s, versionId);
  if (!found) throw new RuleError('录音不存在', '该录音版本不存在。');
  const { sub, version } = found;
  if (version.status !== 'active') throw new RuleError('非有效稿', '只有当前有效录音可以被评审；旧版本仅供查阅。');
  if (sub.studentId === reviewerId) throw new RuleError('不能自评', '不能评审自己的录音。');
  if (!pairOf(s, reviewerId)) throw new RuleError('评审人未编组', '你还没有加入互评小组，无法参与互评，请联系教师编组。');
  if (!pairOf(s, sub.studentId)) throw new RuleError('被评人未编组', '该同学尚未加入互评小组，其录音暂不进入互评。');
  if (isSamePair(s, reviewerId, sub.studentId)) throw new RuleError('同组不得互评', '这是你同组伙伴的录音，互评必须跨组进行。');
  if (s.reviews.some(r => r.versionId === versionId)) throw new RuleError('该录音已有评审人', '这份录音已被另一位评审人认领（草稿或已交），一份录音只接一位评审人。');

  const review = {
    id: rid(),
    versionId,
    assignmentId: sub.assignmentId,
    sentenceId: sub.sentenceId,
    revieweeId: sub.studentId,
    reviewerId,
    claimedAt: now,
    score: null,
    comment: '',
  };
  return { ...s, reviews: s.reviews.concat(review) };
}

/** 放弃评审草稿（仅认领人本人、草稿状态）；一旦提交不可撤回 */
export function discardDraft(s: LabState, reviewId: string, reviewerId: string): LabState {
  const r = s.reviews.find(x => x.id === reviewId);
  if (!r) throw new RuleError('评审不存在', '评审记录不存在。');
  if (r.reviewerId !== reviewerId) throw new RuleError('无权操作', '只有评审人本人可以放弃草稿。');
  if (r.submittedAt) throw new RuleError('评审已提交', '评审结果已提交，不能撤回。');
  return { ...s, reviews: s.reviews.filter(x => x.id !== reviewId) };
}

export type ReviewResult = { score: number; comment: string };

/**
 * 提交评审：
 * - 分数必填（0-100），评语必填；
 * - 低于作业及格线 → 录音退回重录（版本置 rejected），学生可另存新版本，旧稿仍可查；
 * - 达到及格线 → 通过，评审定稿。
 */
export function submitReview(s: LabState, reviewId: string, reviewerId: string, result: ReviewResult, now: number): LabState {
  const r = s.reviews.find(x => x.id === reviewId);
  if (!r) throw new RuleError('评审不存在', '评审记录不存在。');
  if (r.reviewerId !== reviewerId) throw new RuleError('无权操作', '只有评审人本人可以提交评审。');
  if (r.submittedAt) throw new RuleError('评审已提交', '评审结果已提交，不能修改。');
  if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100)
    throw new RuleError('分数无效', '请给出 0–100 的分数。');
  if (!result.comment.trim()) throw new RuleError('评语必填', '请填写评语后再提交。');

  const a = getAssignment(s, r.assignmentId);
  const pass = a ? result.score >= a.passScore : true;

  const reviews = s.reviews.map(x =>
    x.id === reviewId ? { ...x, score: result.score, comment: result.comment.trim(), submittedAt: now } : x,
  );
  const submissions = pass
    ? s.submissions
    : s.submissions.map(sub =>
        sub.id === `${r.assignmentId}|${r.sentenceId}|${r.revieweeId}`
          ? { ...sub, versions: sub.versions.map(v => (v.id === r.versionId ? { ...v, status: 'rejected' as const } : v)) }
          : sub,
      );
  return { ...s, reviews, submissions };
}
