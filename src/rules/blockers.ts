import type { Assignment, LabState } from '../data/types';
import { activeVersion, getAssignment, getSentence, getSubmission, getStudent, isSamePair, pairOf, reviewOfVersion, sid } from './common';

/** 受阻类型：覆盖学生端（录音 / 复录）与评审端全部规则拦截点 */
export type BlockKind = '已截止' | '已退回且逾期' | '有效稿被占用' | '不能自评' | '同组不得互评' | '未编组' | '已被认领' | '非有效稿' | '已完成评审';

export type Blocker = {
  id: string;
  kind: BlockKind;
  /** 受阻学生：录音类=要交作业的学生；评审类=想当评审人的学生 */
  studentId: string;
  /** 被评学生（录音归属者）；录音类与 studentId 相同 */
  revieweeId: string;
  assignmentId: string;
  sentenceId: string;
  /** 涉及的录音版本；被退回且逾期等历史稿一并列出 */
  versionId?: string;
  versionSeq?: number;
  /** 命中的规则说明 */
  rule: string;
  detail: string;
  /** 场景：录音/复录 vs 评审 */
  scene: '提交' | '评审';
};

const studentName = (s: LabState, id: string) => getStudent(s, id)?.name ?? id;

/**
 * 枚举当前所有“想做做不成”的受阻项：
 * 提交侧：① 想录但已截止；② 被退回后想复录但已逾期；③ 想重录但有效稿被评审占用。
 * 评审侧：对每条 active 录音，逐个“可能评审它的学生”检查规则拦截；
 *        未编组的录音归属者、跨组限制、自评、已被认领/已完成均列出。
 * 教师视角看全部；学生视角可按 studentId 过滤（含自己作为被评人的提交侧阻塞）。
 */
export function listBlockers(s: LabState, now: number): Blocker[] {
  const out: Blocker[] = [];

  // —— 提交侧 ——
  for (const a of s.assignments) {
    const closed = now > a.deadline;
    for (const st of s.students) {
      for (const sent of a.sentences) {
        const sub = getSubmission(s, a.id, sent.id, st.id);
        const cur = activeVersion(sub);
        const last = sub?.versions[sub.versions.length - 1];

        if (!cur) {
          if (last?.status === 'rejected' && closed) {
            out.push({
              id: `b-rejected-late-${sub!.id}`, kind: '已退回且逾期', studentId: st.id, revieweeId: st.id,
              assignmentId: a.id, sentenceId: sent.id, versionId: last.id, versionSeq: last.seq,
              rule: '低于及格线退回重录；逾期不接收',
              detail: `第 ${last.seq} 版未达及格线（${a.passScore} 分）已退回，但作业已截止，无法复录，该稿永久挂起。`,
              scene: '提交',
            });
          } else if (closed) {
            out.push({
              id: `b-missed-${sid(a.id, sent.id, st.id)}`, kind: '已截止', studentId: st.id, revieweeId: st.id,
              assignmentId: a.id, sentenceId: sent.id,
              rule: '教师设截止时刻，逾期不接收',
              detail: `未提交有效录音，作业已于截止时刻关闭。`,
              scene: '提交',
            });
          }
        } else if (closed) {
          // 已交有效稿且截止：正常，不算受阻
        } else {
          const rv = reviewOfVersion(s, cur.id);
          if (rv) {
            out.push({
              id: `b-occupied-${cur.id}`, kind: '有效稿被占用', studentId: st.id, revieweeId: st.id,
              assignmentId: a.id, sentenceId: sent.id, versionId: cur.id, versionSeq: cur.seq,
              rule: '每生每句只留一条有效稿；重录先撤回旧稿；一份录音只接一位评审人',
              detail: `第 ${cur.seq} 版正在被 ${studentName(s, rv.reviewerId)} 评审（${rv.submittedAt ? '评审已交' : '草稿占用中'}），需评审人放弃草稿后才能撤回重录。`,
              scene: '提交',
            });
          }
        }
      }
    }
  }

  // —— 评审侧：对每条 active 录音枚举候选评审人 ——
  for (const sub of s.submissions) {
    const cur = activeVersion(sub);
    if (!cur) continue;
    const a = getAssignment(s, sub.assignmentId);
    if (!a) continue;
    const rv = reviewOfVersion(s, cur.id);
    const revieweePair = pairOf(s, sub.studentId);

    for (const reviewer of s.students) {
      if (reviewer.id === sub.studentId) {
        pushReviewBlocker(out, reviewer.id, sub.studentId, a.id, sub.sentenceId, cur.id, cur.seq,
          '不能自评', '不能评审自己的录音。');
        continue;
      }
      if (!pairOf(s, reviewer.id)) {
        pushReviewBlocker(out, reviewer.id, sub.studentId, a.id, sub.sentenceId, cur.id, cur.seq,
          '未编组', `评审人 ${studentName(s, reviewer.id)} 尚未加入互评小组，不能参与互评。`);
        continue;
      }
      if (!revieweePair) {
        pushReviewBlocker(out, reviewer.id, sub.studentId, a.id, sub.sentenceId, cur.id, cur.seq,
          '未编组', `录音归属者 ${studentName(s, sub.studentId)} 尚未编组，其录音不进入互评。`);
        continue;
      }
      if (isSamePair(s, reviewer.id, sub.studentId)) {
        pushReviewBlocker(out, reviewer.id, sub.studentId, a.id, sub.sentenceId, cur.id, cur.seq,
          '同组不得互评', `${studentName(s, reviewer.id)} 与 ${studentName(s, sub.studentId)} 同组，互评必须跨组。`);
        continue;
      }
      if (rv?.reviewerId === reviewer.id && rv.submittedAt) {
        pushReviewBlocker(out, reviewer.id, sub.studentId, a.id, sub.sentenceId, cur.id, cur.seq,
          '已完成评审', `你已完成对第 ${cur.seq} 版的评审，一份录音只接一位评审人，无需重复评审。`);
        continue;
      }
      if (rv && rv.reviewerId !== reviewer.id) {
        pushReviewBlocker(out, reviewer.id, sub.studentId, a.id, sub.sentenceId, cur.id, cur.seq,
          '已被认领', `第 ${cur.seq} 版已被 ${studentName(s, rv.reviewerId)} 认领（${rv.submittedAt ? '评审已交' : '草稿中'}），一份录音只接一位评审人。`);
        continue;
      }
    }
  }

  return out;
}

function pushReviewBlocker(
  out: Blocker[], reviewerId: string, revieweeId: string,
  assignmentId: string, sentenceId: string, versionId: string, seq: number,
  kind: BlockKind, detail: string,
) {
  const ruleByKind: Record<BlockKind, string> = {
    '已截止': '教师设截止时刻，逾期不接收',
    '已退回且逾期': '低于及格线退回重录；逾期不接收',
    '有效稿被占用': '重录先撤回旧稿；一份录音只接一位评审人',
    '不能自评': '互评须由同伴完成',
    '同组不得互评': '互评两人一组，同组不得互评',
    '未编组': '互评两人一组，未编组不能参与',
    '已被认领': '一份录音只接一位评审人',
    '非有效稿': '只有当前有效稿可被评审，旧稿仍可查',
    '已完成评审': '一份录音只接一位评审人',
  };
  out.push({
    id: `b-rv-${versionId}-${reviewerId}`, kind, studentId: reviewerId, revieweeId,
    assignmentId, sentenceId, versionId, versionSeq: seq,
    rule: ruleByKind[kind], detail, scene: '评审',
  });
}

/** 学生视角：只看“与我有关”的受阻（我交作业、或我想评审别人） */
export function blockersForStudent(all: Blocker[], studentId: string): Blocker[] {
  return all.filter(b => b.studentId === studentId || (b.scene === '提交' && b.revieweeId === studentId));
}
