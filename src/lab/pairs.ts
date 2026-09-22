// 规则层（配对规则）：两人一组、同组不得互评、评审资格判定
// 纯函数，不读 store，不渲染页面 —— 与作业数据和 UI 完全分开。

import type { Id, RecordingVersion, Student } from './types';

export type PairGroup = { group: number; members: Student[] };

/** 按组号聚合学生，返回互评小组清单 */
export function buildGroups(students: Student[]): PairGroup[] {
  const map = new Map<number, Student[]>();
  for (const s of students) {
    const list = map.get(s.group) ?? [];
    list.push(s);
    map.set(s.group, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([group, members]) => ({ group, members }));
}

/** 学生所在组的全部成员 */
export function groupOf(students: Student[], studentId: Id): Student[] {
  const me = students.find((s) => s.id === studentId);
  return me ? students.filter((s) => s.group === me.group) : [];
}

/** 同组判定：两人同组（含本人）则不得互评 */
export function isSameGroup(students: Student[], a: Id, b: Id): boolean {
  const ga = students.find((s) => s.id === a)?.group;
  const gb = students.find((s) => s.id === b)?.group;
  return ga !== undefined && ga === gb;
}

/**
 * 评审资格：评审人可以评审某份录音，当且仅当
 *  1. 录音仍处于有效待评审状态（pending）；
 *  2. 不是自己的录音（不得自评）；
 *  3. 与录音作者不同组（同组不得互评）；
 *  4. 该录音尚未被任何评审人认领（一份录音只接一位评审人）。
 * 返回不可评审时附带原因，供页面直接提示并列受阻记录。
 */
export function reviewEligibility(
  students: Student[],
  v: RecordingVersion,
  reviewerId: Id,
): { eligible: true } | { eligible: false; reason: 'status' | 'own' | 'same-group' | 'taken' } {
  if (v.status !== 'pending') return { eligible: false, reason: 'taken' };
  if (v.claimedBy !== undefined) return { eligible: false, reason: 'taken' };
  if (v.studentId === reviewerId) return { eligible: false, reason: 'own' };
  if (isSameGroup(students, v.studentId, reviewerId)) return { eligible: false, reason: 'same-group' };
  return { eligible: true };
}
