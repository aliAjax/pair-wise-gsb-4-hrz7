import { strict as assert } from 'assert';
import { seedState } from '../data/seed.js';
import { RuleError } from '../data/types.js';
import { record, withdrawActive } from '../rules/submissions.js';
import { claimReview, discardDraft, submitReview } from '../rules/reviews.js';
import { addPair, removePair } from '../rules/pairs.js';
import { createAssignment } from '../rules/assignments.js';
import { listBlockers, blockersForStudent } from '../rules/blockers.js';
import { activeVersion, getSubmission } from '../rules/common.js';

let s = structuredClone(seedState);
const NOW = Date.parse('2026-09-22T12:00:00');
let failures = 0;
const ok = (name: string, fn: () => void) => {
  try { fn(); console.log('PASS', name); }
  catch (e) { failures++; console.log('FAIL', name, '\n  ', (e as Error).message); }
};
const throws = (name: string, fn: () => unknown, rule: string) => {
  try { fn(); failures++; console.log('FAIL', name, '(未抛错)'); }
  catch (e) {
    if (e instanceof RuleError && e.rule === rule) console.log('PASS', name);
    else { failures++; console.log('FAIL', name, '期望规则「' + rule + '」实际「' + ((e as Error).message) + '」'); }
  }
};

// 1. 首次录音：新建提交、版本 1 为 active
ok('首次录音产生 v1 active', () => {
  const n = record(s, { assignmentId: 'a1', sentenceId: 'a1s3', studentId: 's2', durationSec: 6 }, NOW);
  const sub = getSubmission(n, 'a1', 'a1s3', 's2')!;
  assert.equal(sub.versions.length, 1);
  assert.equal(activeVersion(sub)?.seq, 1);
  s = n;
});

// 2. 重录：旧稿 withdrawn、新稿 active，每句只一条有效稿
ok('重录先撤回旧稿，仍只一条有效稿', () => {
  const n = record(s, { assignmentId: 'a1', sentenceId: 'a1s3', studentId: 's2', durationSec: 7 }, NOW + 1000);
  const sub = getSubmission(n, 'a1', 'a1s3', 's2')!;
  assert.equal(sub.versions.length, 2);
  assert.equal(sub.versions[0].status, 'withdrawn');
  assert.equal(activeVersion(sub)?.seq, 2);
  assert.equal(sub.versions.filter(v => v.status === 'active').length, 1);
  s = n;
});

// 3. 有效稿被评审草稿占用 → 不能重录/撤回；一份录音只接一位评审人
ok('有效稿被占用规则', () => {
  throws('被占用时重录被拒', () => record(s, { assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's3', durationSec: 5 }, NOW), '有效稿已被评审占用');
  throws('被占用时撤回被拒', () => withdrawActive(s, { assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's3', durationSec: 0 }, NOW), '有效稿已被评审占用');
  throws('同组伙伴不能认领', () => claimReview(s, 'v-3-1', 's4', NOW), '同组不得互评');
  throws('已被认领的稿不能再认领', () => claimReview(s, 'v-3-1', 's1', NOW), '该录音已有评审人');
});

// 4. 不及格退回 → 旧稿 rejected 可查，复录另存新版本
ok('低于及格线退回，再复录另存版本', () => {
  let n = discardDraft(s, 'r3', 's5');
  n = claimReview(n, 'v-3-1', 's6', NOW + 2000);
  const rv = n.reviews.find(r => r.versionId === 'v-3-1' && !r.submittedAt)!;
  n = submitReview(n, rv.id, 's6', { score: 45, comment: '元音不饱满，节奏太赶。' }, NOW + 3000);
  const sub = getSubmission(n, 'a1', 'a1s1', 's3')!;
  assert.equal(sub.versions[0].status, 'rejected');
  assert.ok(n.reviews.find(r => r.id === rv.id)?.submittedAt);
  n = record(n, { assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's3', durationSec: 6 }, NOW + 4000);
  const sub2 = getSubmission(n, 'a1', 'a1s1', 's3')!;
  assert.equal(sub2.versions.length, 2);
  assert.equal(sub2.versions[0].status, 'rejected');
  assert.equal(activeVersion(sub2)?.status, 'active');
  assert.equal(activeVersion(sub2)?.trigger, '退回复录');
  s = n;
});

// 5. 及格评审定稿，不可撤回/重复认领
ok('及格评审提交后定稿', () => {
  let n = claimReview(s, 'v-2-2', 's5', NOW);
  const rv = n.reviews.find(r => r.versionId === 'v-2-2')!;
  n = submitReview(n, rv.id, 's5', { score: 88, comment: '不错。' }, NOW);
  const v = activeVersion(getSubmission(n, 'a1', 'a1s1', 's2')!)!;
  assert.equal(v.status, 'active');
  throws('已交评审不能撤回', () => discardDraft(n, rv.id, 's5'), '评审已提交');
  throws('已评稿不能再认领（跨组第三人 s3）', () => claimReview(n, v.id, 's3', NOW), '该录音已有评审人');
});

// 6. 截止：逾期不接收（首次/重录/撤回）；退回且逾期永久挂起
ok('逾期规则', () => {
  const LATE = Date.parse('2026-09-23T19:00:00');
  throws('逾期不能首次录音', () => record(s, { assignmentId: 'a1', sentenceId: 'a1s2', studentId: 's4', durationSec: 5 }, LATE), '逾期不接收');
  throws('逾期不能重录', () => record(s, { assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's1', durationSec: 5 }, LATE), '逾期不接收');
  throws('逾期不能撤回', () => withdrawActive(s, { assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's1', durationSec: 0 }, LATE), '逾期不接收');
  throws('退回后逾期无法复录', () => record(s, { assignmentId: 'a2', sentenceId: 'a2s2', studentId: 's5', durationSec: 5 }, NOW), '逾期不接收');
});

// 7. 配对规则
ok('配对规则：两人一组、一人只属一组', () => {
  throws('不能与自己编组', () => addPair(s, 's7', 's7'), '不能与自己编组');
  throws('已编组学生不能重复编组（s1）', () => addPair(s, 's1', 's7'), '学生已有小组');
  throws('s7 不能与已编组的 s2 编组', () => addPair(s, 's7', 's2'), '学生已有小组');
  let n = removePair(s, 'p3');
  n = addPair(n, 's5', 's7');
  assert.ok(n.pairs.find(p => (p.a === 's5' && p.b === 's7') || (p.a === 's7' && p.b === 's5')));
  // 历史评审记录保留
  assert.ok(n.reviews.some(r => r.reviewerId === 's6'));
});

// 8. 互评资格
ok('互评资格：自评/未编组/同组限制', () => {
  throws('不能自评', () => claimReview(seedState, 'v-1-1', 's1', NOW), '不能自评');
  throws('评审人未编组不能评审', () => claimReview(seedState, 'v-4-2', 's7', NOW), '评审人未编组');
  throws('被评人未编组其录音不进入互评', () => claimReview(seedState, 'v-7-1', 's1', NOW), '被评人未编组');
  throws('同组不得互评', () => claimReview(seedState, 'v-1-1', 's2', NOW), '同组不得互评');
});

// 9. 非有效稿不可评审
ok('撤回稿/退回稿不可评审', () => {
  throws('退回稿不能评审', () => claimReview(seedState, 'v-2-1', 's5', NOW), '非有效稿');
  throws('撤回稿不能评审', () => claimReview(seedState, 'v-4-1', 's5', NOW), '非有效稿');
});

// 10. 布置作业校验
ok('布置作业校验', () => {
  throws('标题必填', () => createAssignment(s, { title: '', deadline: NOW + 1e5, passScore: 60, sentences: ['x'] }, NOW), '标题必填');
  throws('至少一句', () => createAssignment(s, { title: 't', deadline: NOW + 1e5, passScore: 60, sentences: ['  '] }, NOW), '至少一句');
  throws('截止必须晚于现在', () => createAssignment(s, { title: 't', deadline: NOW - 1, passScore: 60, sentences: ['x'] }, NOW), '截止时刻无效');
  throws('及格线范围', () => createAssignment(s, { title: 't', deadline: NOW + 1e5, passScore: 120, sentences: ['x'] }, NOW), '及格线无效');
  const n = createAssignment(s, { title: '新作业', deadline: NOW + 86400000, passScore: 70, sentences: ['Hello.', 'Bye.'] }, NOW);
  const a = n.assignments[n.assignments.length - 1];
  assert.equal(a.sentences.length, 2);
  assert.equal(a.passScore, 70);
});

// 11. 受阻清单：学生、句子、版本、规则四要素齐全
ok('受阻清单内容完整', () => {
  const all = listBlockers(seedState, NOW);
  assert.ok(all.some(b => b.kind === '已截止' && b.scene === '提交'));
  assert.ok(all.some(b => b.kind === '已退回且逾期' && b.studentId === 's5' && b.versionSeq === 1));
  assert.ok(all.some(b => b.kind === '有效稿被占用' && b.studentId === 's3' && b.versionId === 'v-3-1'));
  assert.ok(all.some(b => b.kind === '同组不得互评' && b.studentId === 's4' && b.revieweeId === 's3'));
  assert.ok(all.some(b => b.kind === '已被认领' && b.studentId === 's1' && b.versionId === 'v-3-1'));
  assert.ok(all.some(b => b.kind === '未编组' && b.studentId === 's7'));
  assert.ok(all.some(b => b.kind === '不能自评'));
  for (const b of all) {
    assert.ok(b.studentId && b.assignmentId && b.sentenceId && b.rule && b.detail);
  }
  const s7 = blockersForStudent(all, 's7');
  assert.ok(s7.length > 0);
  assert.ok(s7.every(b => b.studentId === 's7' || b.revieweeId === 's7'));
});

// 12. 刷新一致性：序列化往返不丢数据
ok('状态可序列化（刷新一致的基础）', () => {
  const restored = JSON.parse(JSON.stringify(seedState));
  assert.equal(restored.submissions.length, seedState.submissions.length);
  assert.equal(restored.reviews.length, seedState.reviews.length);
  assert.equal(restored.pairs.length, seedState.pairs.length);
});

console.log(failures === 0 ? '\n全部规则测试通过' : `\n${failures} 条失败`);
process.exit(failures === 0 ? 0 : 1);
