import type { LabState, Sentence } from '../data/types';
import { RuleError } from '../data/types';

export type NewAssignment = {
  title: string;
  deadline: number;
  passScore: number;
  sentences: string[]; // 原文行
};

/** 教师布置句子作业并设截止时刻：至少一句；截止时刻必须晚于当前；及格线 1-99 */
export function createAssignment(s: LabState, input: NewAssignment, now: number): LabState {
  const title = input.title.trim();
  if (!title) throw new RuleError('标题必填', '请填写作业标题。');
  const lines = input.sentences.map(x => x.trim()).filter(Boolean);
  if (lines.length === 0) throw new RuleError('至少一句', '请至少布置一个朗读句子。');
  if (!Number.isFinite(input.deadline) || input.deadline <= now)
    throw new RuleError('截止时刻无效', '截止时刻必须晚于当前时间。');
  if (!Number.isFinite(input.passScore) || input.passScore < 1 || input.passScore > 99)
    throw new RuleError('及格线无效', '及格线应在 1–99 分之间。');

  const id = `a-${Date.now().toString(36)}`;
  const sentences: Sentence[] = lines.map((text, i) => ({ id: `${id}s${i + 1}`, text }));
  return {
    ...s,
    assignments: s.assignments.concat({ id, title, deadline: input.deadline, passScore: input.passScore, createdAt: now, sentences }),
  };
}
