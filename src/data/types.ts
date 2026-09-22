// 领域模型：作业数据的唯一事实来源（与页面、规则展示无关）

export type Student = {
  id: string;
  name: string;
  initials: string;
};

/** 互评小组：两人一组 */
export type Pair = {
  id: string;
  a: string; // student id
  b: string; // student id
};

export type Sentence = {
  id: string;
  text: string;
  translation?: string;
};

export type Assignment = {
  id: string;
  title: string;
  sentences: Sentence[];
  /** 截止时刻（epoch ms），逾期不接收 */
  deadline: number;
  /** 及格线（0-100），低于则退回重录 */
  passScore: number;
  createdAt: number;
};

/** 录音版本状态：active=当前唯一有效稿；withdrawn=重录前撤回；rejected=评审不及格退回 */
export type VersionStatus = 'active' | 'withdrawn' | 'rejected';

export type RecordingVersion = {
  id: string;
  /** 版本序号，从 1 开始 */
  seq: number;
  durationSec: number;
  /** 伪波形（纯前端模拟录音，0-100 的柱高） */
  wave: number[];
  recordedAt: number;
  status: VersionStatus;
  trigger: '首次录音' | '撤回重录' | '退回复录';
};

/** 一名学生对一个作业中一句的全部版本 */
export type Submission = {
  id: string; // `${assignmentId}|${sentenceId}|${studentId}`
  assignmentId: string;
  sentenceId: string;
  studentId: string;
  versions: RecordingVersion[];
};

/** 评审：一份录音（版本）只接一位评审人；草稿即占用 */
export type Review = {
  id: string;
  versionId: string;
  assignmentId: string;
  sentenceId: string;
  revieweeId: string;
  reviewerId: string;
  claimedAt: number;
  submittedAt?: number;
  score: number | null;
  comment: string;
};

export type LabState = {
  students: Student[];
  pairs: Pair[];
  assignments: Assignment[];
  submissions: Submission[];
  reviews: Review[];
};

/** 规则冲突：页面只负责展示文案 */
export class RuleError extends Error {
  constructor(public rule: string, message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
