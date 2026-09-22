// 数据层：示例数据。所有时间相对首次加载时刻生成，保证总有进行中与已截止作业。

import type { Assignment, BlockEvent, Id, LabState, RecordingVersion, Review, Student } from './types';

const wave = (n: number, salt: number) =>
  Array.from({ length: n }, (_, i) => Math.round(16 + Math.abs(Math.sin(i * 1.7 + salt) * 46) + ((i * salt) % 9)));

export const STUDENTS: Student[] = [
  { id: 1, name: '林柚希', initials: 'YL', group: 1 },
  { id: 2, name: '周启明', initials: 'QM', group: 1 },
  { id: 3, name: '陈思远', initials: 'SY', group: 2 },
  { id: 4, name: '苏晚晴', initials: 'WQ', group: 2 },
  { id: 5, name: '何子墨', initials: 'ZM', group: 3 },
  { id: 6, name: '方一诺', initials: 'YN', group: 3 },
];

export function buildSeedState(now: number): LabState {
  const H = 3600_000;
  const assignments: Assignment[] = [
    {
      id: 101,
      title: '朗读作业 A · 晨间短句',
      sentences: [
        'The morning light feels different today.',
        'Could you walk me through the next step?',
        'I appreciate your patience and thoughtful feedback.',
      ],
      passScore: 60,
      deadline: now + 3 * 24 * H,
      createdAt: now - 2 * 24 * H,
    },
    {
      id: 102,
      title: '朗读作业 B · 会议表达',
      sentences: [
        'Let’s make room for a little curiosity.',
        'Shall we pick this up after the break?',
      ],
      passScore: 65,
      deadline: now + 26 * H,
      createdAt: now - 20 * H,
    },
    {
      id: 103,
      title: '朗读作业 C · 周末挑战（已截止）',
      sentences: ['Every voice deserves to be heard.', 'Practice quietly, then speak clearly.'],
      passScore: 70,
      deadline: now - 2 * H,
      createdAt: now - 4 * 24 * H,
    },
  ];

  const review = (reviewerId: Id, hoursAgo: number, score: number, comment: string): Review => ({
    score,
    comment,
    reviewerId,
    reviewedAt: now - hoursAgo * H,
  });

  const versions: RecordingVersion[] = [
    // —— 作业 A ——
    { id: 1, assignmentId: 101, studentId: 1, sentenceIndex: 0, version: 1, durationSec: 8, wave: wave(40, 3), createdAt: now - 30 * H, status: 'withdrawn', replacedBy: 2 },
    { id: 2, assignmentId: 101, studentId: 1, sentenceIndex: 0, version: 2, durationSec: 7, wave: wave(40, 7), createdAt: now - 22 * H, status: 'claimed', claimedBy: 3, claimedAt: now - 5 * H },
    { id: 3, assignmentId: 101, studentId: 3, sentenceIndex: 0, version: 1, durationSec: 9, wave: wave(40, 11), createdAt: now - 26 * H, status: 'reviewed', claimedBy: 1, claimedAt: now - 20 * H, review: review(1, 12, 88, '重音自然，语流连贯，句末降调处理得很好。') },
    { id: 4, assignmentId: 101, studentId: 5, sentenceIndex: 0, version: 1, durationSec: 11, wave: wave(40, 2), createdAt: now - 18 * H, status: 'returned', claimedBy: 3, claimedAt: now - 15 * H, replacedBy: 5, review: review(3, 10, 52, '部分单词发音含糊，节奏偏快；注意 thought·ful 的连读，重录一版。') },
    { id: 5, assignmentId: 101, studentId: 5, sentenceIndex: 0, version: 2, durationSec: 10, wave: wave(40, 9), createdAt: now - 6 * H, status: 'pending' },
    { id: 6, assignmentId: 101, studentId: 2, sentenceIndex: 1, version: 1, durationSec: 8, wave: wave(40, 5), createdAt: now - 9 * H, status: 'pending' },
    { id: 7, assignmentId: 101, studentId: 4, sentenceIndex: 1, version: 1, durationSec: 7, wave: wave(40, 8), createdAt: now - 8 * H, status: 'claimed', claimedBy: 6, claimedAt: now - 2 * H },
    // —— 作业 B ——
    { id: 8, assignmentId: 102, studentId: 1, sentenceIndex: 0, version: 1, durationSec: 6, wave: wave(40, 13), createdAt: now - 8 * H, status: 'pending' },
    { id: 9, assignmentId: 102, studentId: 3, sentenceIndex: 0, version: 1, durationSec: 7, wave: wave(40, 4), createdAt: now - 7 * H, status: 'claimed', claimedBy: 5, claimedAt: now - 1 * H },
    { id: 10, assignmentId: 102, studentId: 6, sentenceIndex: 1, version: 1, durationSec: 9, wave: wave(40, 6), createdAt: now - 5 * H, status: 'reviewed', claimedBy: 2, claimedAt: now - 4 * H, review: review(2, 3, 76, '语调得体，问句升调到位；break 的元音再饱满些。') },
    // —— 作业 C（已截止）——
    { id: 11, assignmentId: 103, studentId: 1, sentenceIndex: 0, version: 1, durationSec: 8, wave: wave(40, 1), createdAt: now - 30 * H, status: 'reviewed', claimedBy: 5, claimedAt: now - 28 * H, review: review(5, 24, 91, '情感饱满，停顿合理，是很好的示范。') },
    { id: 12, assignmentId: 103, studentId: 3, sentenceIndex: 1, version: 1, durationSec: 7, wave: wave(40, 12), createdAt: now - 27 * H, status: 'pending' },
  ];

  const blocks: BlockEvent[] = [
    { id: 1, at: now - 45 * 60000, actorId: 2, action: '提交录音（作业 A · 第 2 句）', rule: 'ACTIVE_EXISTS', detail: '已有一条待评审有效稿，需先撤回旧稿', assignmentId: 101, studentId: 2, sentenceIndex: 1, versionId: 6 },
    { id: 2, at: now - 100 * 60000, actorId: 4, action: '提交录音（作业 C · 第 1 句）', rule: 'DEADLINE_PASSED', detail: '作业已于 2 小时前截止，逾期不接收', assignmentId: 103, studentId: 4, sentenceIndex: 0 },
    { id: 3, at: now - 150 * 60000, actorId: 2, action: '认领评审（林柚希 · 作业 A · 第 1 句 v2）', rule: 'SAME_GROUP', detail: '林柚希与周启明同在第 1 组，同组不得互评', assignmentId: 101, studentId: 1, sentenceIndex: 0, versionId: 2 },
    { id: 4, at: now - 3 * 3600000, actorId: 5, action: '认领评审（本人录音 · 作业 A · 第 1 句 v2 候选）', rule: 'REVIEW_OWN', detail: '不得评审本人的录音', assignmentId: 101, studentId: 5, sentenceIndex: 0, versionId: 5 },
    { id: 5, at: now - 4 * 3600000, actorId: 6, action: '认领评审（何子墨 · 作业 A · 第 1 句 v1）', rule: 'SAME_GROUP', detail: '何子墨与方一诺同在第 3 组，同组不得互评', assignmentId: 101, studentId: 5, sentenceIndex: 0, versionId: 4 },
    { id: 6, at: now - 5 * 3600000, actorId: 4, action: '撤回录音（作业 A · 第 2 句 v1）', rule: 'CLAIM_LOCKED', detail: '该录音已被方一诺认领并锁定，无法撤回', assignmentId: 101, studentId: 4, sentenceIndex: 1, versionId: 7 },
  ];

  return { students: STUDENTS, assignments, versions, blocks, seq: 1000 };
}
