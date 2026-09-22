import type { RuleCode, VersionStatus } from '../lab/types';

export const STATUS_META: Record<VersionStatus, { label: string; cls: string }> = {
  pending: { label: '待评审 · 有效稿', cls: 'pending' },
  claimed: { label: '评审中 · 有效稿', cls: 'claimed' },
  reviewed: { label: '已通过', cls: 'reviewed' },
  returned: { label: '退回重录 · 旧稿留档', cls: 'returned' },
  withdrawn: { label: '已撤回 · 旧稿留档', cls: 'withdrawn' },
};

export const RULE_META: Record<RuleCode, { label: string; text: string }> = {
  DEADLINE_PASSED: { label: '规则1 · 逾期不接收', text: '超过截止时刻后，作业不再接收提交或撤回' },
  ACTIVE_EXISTS: { label: '规则2 · 每句一条有效稿', text: '每名学生每句只保留一条有效录音；重录须先撤回旧稿' },
  NOT_ACTIVE: { label: '旧稿保护', text: '仅当前有效稿可撤回；退回/撤回的旧稿永久留档' },
  CLAIM_LOCKED: { label: '评审锁定', text: '录音被评审人认领后即锁定，撤回通道关闭' },
  REVIEW_OWN: { label: '规则3 · 不得自评', text: '评审人不能评审本人的录音' },
  SAME_GROUP: { label: '规则4 · 同组不互评', text: '两人一组，同组成员之间不得互相评审' },
  ALREADY_CLAIMED: { label: '规则5 · 一份录音一位评审', text: '一份录音只接受一位评审人，认领即独占' },
  NOT_CLAIMED: { label: '认领前置', text: '需先认领录音才能提交评审结果' },
  CLAIMED_BY_OTHER: { label: '独占评审', text: '只有认领该录音的评审人才能提交结果' },
};

export function StatusBadge({ status }: { status: VersionStatus }) {
  const m = STATUS_META[status];
  return <span className={`rl-badge ${m.cls}`}>{m.label}</span>;
}

export function RuleTag({ rule }: { rule: RuleCode }) {
  return <span className="rl-rule-tag">{RULE_META[rule].label}</span>;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDeadline(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function toLocalInputValue(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
