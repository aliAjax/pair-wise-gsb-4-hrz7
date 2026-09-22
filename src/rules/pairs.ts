import type { LabState } from '../data/types';
import { RuleError } from '../data/types';
import { pairOf } from './common';

/**
 * 配对规则：
 * - 互评两人一组；
 * - 一名学生最多属于一组；
 * - 组内两人互为伙伴，同组不得互评。
 */
export function addPair(s: LabState, a: string, b: string): LabState {
  if (a === b) throw new RuleError('不能与自己编组', '一个互评小组必须由两名不同学生组成。');
  if (!s.students.some(x => x.id === a) || !s.students.some(x => x.id === b))
    throw new RuleError('学生不存在', '请选择两名在校学生。');
  if (pairOf(s, a)) throw new RuleError('学生已有小组', `${nameOf(s, a)}已在一个互评小组中，不能重复编组。`);
  if (pairOf(s, b)) throw new RuleError('学生已有小组', `${nameOf(s, b)}已在一个互评小组中，不能重复编组。`);
  return { ...s, pairs: s.pairs.concat({ id: `p-${Date.now().toString(36)}`, a, b }) };
}

export function removePair(s: LabState, pairId: string): LabState {
  // 已产生的评审记录保留；仅解除编组（之后两人仍不可评审对方，直到重新编组也不影响历史）
  return { ...s, pairs: s.pairs.filter(p => p.id !== pairId) };
}

const nameOf = (s: LabState, id: string) => s.students.find(x => x.id === id)?.name ?? id;
