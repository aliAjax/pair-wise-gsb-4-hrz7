// 数据层：作业平台的数据模型定义（与规则、页面分离）

export type Id = number;

export type Student = {
  id: Id;
  name: string;
  initials: string;
  /** 互评组号；同组学生不得互相评审，同组恰为两人 */
  group: number;
};

export type AssignmentStatus = 'open' | 'closed';

export type Assignment = {
  id: Id;
  title: string;
  /** 朗读句子清单 */
  sentences: string[];
  /** 及格线（低于此分退回重录），0–100 */
  passScore: number;
  /** 截止时刻，epoch 毫秒；逾期一律不接收提交/撤回 */
  deadline: number;
  createdAt: number;
};

/** 一条录音版本的生命周期 */
export type VersionStatus =
  | 'pending'      // 有效稿 · 待评审（学生当前有效录音）
  | 'claimed'      // 已被某位评审人认领，评审独占
  | 'reviewed'     // 已评审 · 达到及格线
  | 'returned'     // 低于及格线退回重录（旧稿另存、仍可查）
  | 'withdrawn';   // 重录前被撤回（旧稿另存、仍可查）

export type Review = {
  score: number;
  comment: string;
  reviewerId: Id;
  reviewedAt: number;
};

export type RecordingVersion = {
  id: Id;
  assignmentId: Id;
  studentId: Id;
  /** 句子在作业句子清单中的下标 */
  sentenceIndex: number;
  /** 版本号，从 1 递增 */
  version: number;
  durationSec: number;
  /** 模拟波形，仅作展示 */
  wave: number[];
  createdAt: number;
  status: VersionStatus;
  /** 评审人认领时刻（status === 'claimed' 或已评审时有值） */
  claimedBy?: Id;
  claimedAt?: number;
  review?: Review;
  /** 被哪个新版本替换（退回/撤回后重录时回填） */
  replacedBy?: Id;
};

/** 规则编号：每次受阻都对应一条可解释的规则 */
export type RuleCode =
  | 'DEADLINE_PASSED'   // 规则1：逾期不接收
  | 'ACTIVE_EXISTS'     // 规则2：每句只留一条有效录音
  | 'NOT_ACTIVE'        // 旧稿不可撤回
  | 'CLAIM_LOCKED'      // 已被评审认领，锁定不可撤回
  | 'REVIEW_OWN'        // 规则3：不得评审本人录音
  | 'SAME_GROUP'        // 规则4：同组不得互评
  | 'ALREADY_CLAIMED'   // 规则5：一份录音只接一位评审人
  | 'NOT_CLAIMED'       // 未认领，无法提交评审
  | 'CLAIMED_BY_OTHER'; // 认领归属他人，无法提交

export type BlockEvent = {
  id: Id;
  at: number;
  /** 受阻时扮演的角色 */
  actorId: Id;
  action: string;
  rule: RuleCode;
  detail: string;
  assignmentId?: Id;
  studentId?: Id;
  sentenceIndex?: number;
  versionId?: Id;
};

export type LabState = {
  students: Student[];
  assignments: Assignment[];
  versions: RecordingVersion[];
  blocks: BlockEvent[];
  seq: Id;
};

export type GateResult = { ok: true } | { ok: false; rule: RuleCode; message: string };
