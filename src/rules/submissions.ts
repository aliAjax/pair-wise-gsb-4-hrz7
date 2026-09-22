import type { LabState, RecordingVersion } from '../data/types';
import { RuleError } from '../data/types';
import { activeVersion, getAssignment, getSubmission, reviewOfVersion, sid } from './common';

const uid = () => `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const pseudoWave = (): number[] => Array.from({ length: 40 }, () => 16 + Math.round(Math.random() * 60));

export type RecordInput = {
  assignmentId: string;
  sentenceId: string;
  studentId: string;
  durationSec: number;
};

/**
 * 规则 1 · 截止时刻：逾期不接收（首次录音与重录一视同仁）。
 * 规则 2 · 每生每句只留一条有效稿：
 *   - 无稿 / 最新稿为 rejected（退回）/ withdrawn（撤回）→ 新增版本；
 *   - 最新稿为 active 且未被任何评审占用 → 先撤回旧稿（withdrawn）再新增版本（撤回重录）；
 *   - 最新稿为 active 且已有评审（草稿或已交）→ 拒绝重录，须先由评审人放弃草稿。
 */
export function record(s: LabState, input: RecordInput, now: number): LabState {
  const a = getAssignment(s, input.assignmentId);
  if (!a) throw new RuleError('作业不存在', '作业不存在或已被删除。');
  if (!a.sentences.some(x => x.id === input.sentenceId)) throw new RuleError('句子不属于本作业', '该句子不在本作业中。');
  if (!s.students.some(x => x.id === input.studentId)) throw new RuleError('学生不存在', '学生不存在。');

  if (now > a.deadline) throw new RuleError('逾期不接收', `已过截止时刻（${new Date(a.deadline).toLocaleString('zh-CN')}），作业通道关闭。`);

  const sub = getSubmission(s, input.assignmentId, input.sentenceId, input.studentId);
  const cur = activeVersion(sub);
  let trigger: RecordingVersion['trigger'] = '首次录音';
  if (cur) {
    const rv = reviewOfVersion(s, cur.id);
    if (rv) throw new RuleError('有效稿已被评审占用', `该稿已被评审人占用（${rv.submittedAt ? '评审已交' : '评审草稿中'}），无法撤回重录；请先请评审人放弃草稿，或等待评审结果。`);
    trigger = '撤回重录';
  } else if (sub && sub.versions.length > 0) {
    const last = sub.versions[sub.versions.length - 1];
    trigger = last.status === 'rejected' ? '退回复录' : '撤回重录';
  }

  const version: RecordingVersion = {
    id: uid(),
    seq: (sub?.versions.length ?? 0) + 1,
    durationSec: input.durationSec,
    wave: pseudoWave(),
    recordedAt: now,
    status: 'active',
    trigger,
  };

  let submissions = s.submissions;
  if (sub) {
    submissions = s.submissions.map(x =>
      x.id === sub.id
        ? {
            ...x,
            versions: x.versions.map(v => (v.id === cur?.id ? { ...v, status: 'withdrawn' as const } : v)).concat(version),
          }
        : x,
    );
  } else {
    submissions = s.submissions.concat({
      id: sid(input.assignmentId, input.sentenceId, input.studentId),
      assignmentId: input.assignmentId,
      sentenceId: input.sentenceId,
      studentId: input.studentId,
      versions: [version],
    });
  }
  return { ...s, submissions };
}

/** 撤回当前有效稿（重录的前置动作单独暴露）：撤回后该句暂时没有有效稿，旧稿仍可查 */
export function withdrawActive(s: LabState, input: RecordInput, now: number): LabState {
  const a = getAssignment(s, input.assignmentId);
  if (!a) throw new RuleError('作业不存在', '作业不存在或已被删除。');
  if (now > a.deadline) throw new RuleError('逾期不接收', '已过截止时刻，无法再撤回。');
  const sub = getSubmission(s, input.assignmentId, input.sentenceId, input.studentId);
  const cur = activeVersion(sub);
  if (!sub || !cur) throw new RuleError('没有有效稿', '当前没有可撤回的有效录音。');
  const rv = reviewOfVersion(s, cur.id);
  if (rv) throw new RuleError('有效稿已被评审占用', rv.submittedAt ? '该稿评审已提交，不能撤回。' : '评审人已占用该稿（草稿中），撤回需评审人先放弃草稿。');
  return {
    ...s,
    submissions: s.submissions.map(x =>
      x.id === sub.id ? { ...x, versions: x.versions.map(v => (v.id === cur.id ? { ...v, status: 'withdrawn' as const } : v)) } : x,
    ),
  };
}
