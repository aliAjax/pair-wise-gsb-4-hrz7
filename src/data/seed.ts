import type { LabState } from './types';

// 伪波形生成（纯前端模拟录音，不采集真实音频）
const wave = (seed: number, len = 40): number[] =>
  Array.from({ length: len }, (_, i) => 18 + ((i * 29 + seed * 13) % 60));

const t = (iso: string) => Date.parse(iso);

export const seedState: LabState = {
  students: [
    { id: 's1', name: '林雨晴', initials: '雨晴' },
    { id: 's2', name: '陈思远', initials: '思远' },
    { id: 's3', name: '王梓涵', initials: '梓涵' },
    { id: 's4', name: '赵明轩', initials: '明轩' },
    { id: 's5', name: '周乐瑶', initials: '乐瑶' },
    { id: 's6', name: '何子墨', initials: '子墨' },
    { id: 's7', name: '孙一诺', initials: '一诺' },
  ],
  pairs: [
    { id: 'p1', a: 's1', b: 's2' },
    { id: 'p2', a: 's3', b: 's4' },
    { id: 'p3', a: 's5', b: 's6' },
    // s7（孙一诺）尚未编组：用于演示“未编组无法参与互评”
  ],
  assignments: [
    {
      id: 'a1',
      title: '第三周朗读 · 日常表达',
      passScore: 60,
      deadline: t('2026-09-23T18:00:00'),
      createdAt: t('2026-09-20T09:00:00'),
      sentences: [
        { id: 'a1s1', text: 'The morning light feels different today.', translation: '今天的晨光感觉不一样。' },
        { id: 'a1s2', text: 'Could you walk me through the next step?', translation: '你能带我了解下一步吗？' },
        { id: 'a1s3', text: 'I appreciate your patience and thoughtful feedback.', translation: '感谢你的耐心和细致反馈。' },
      ],
    },
    {
      id: 'a2',
      title: '第二周朗读 · 节奏与停顿',
      passScore: 60,
      deadline: t('2026-09-20T22:00:00'),
      createdAt: t('2026-09-14T09:00:00'),
      sentences: [
        { id: 'a2s1', text: "Let's make room for a little curiosity.", translation: '给好奇心留一点空间。' },
        { id: 'a2s2', text: 'Practice with patience, and let the sentence breathe.', translation: '耐心练习，让句子自然呼吸。' },
      ],
    },
  ],
  submissions: [
    // —— a1：进行中 ——
    {
      id: 'a1|a1s1|s1', assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's1',
      versions: [
        { id: 'v-1-1', seq: 1, durationSec: 7, wave: wave(1), recordedAt: t('2026-09-21T09:24:00'), status: 'active', trigger: '首次录音' },
      ],
    },
    {
      id: 'a1|a1s2|s1', assignmentId: 'a1', sentenceId: 'a1s2', studentId: 's1',
      versions: [
        { id: 'v-1-2', seq: 1, durationSec: 6, wave: wave(2), recordedAt: t('2026-09-21T09:26:00'), status: 'active', trigger: '首次录音' },
      ],
    },
    {
      id: 'a1|a1s1|s2', assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's2',
      versions: [
        { id: 'v-2-1', seq: 1, durationSec: 8, wave: wave(3), recordedAt: t('2026-09-21T10:02:00'), status: 'rejected', trigger: '首次录音' },
        { id: 'v-2-2', seq: 2, durationSec: 7, wave: wave(4), recordedAt: t('2026-09-22T08:15:00'), status: 'active', trigger: '退回复录' },
      ],
    },
    {
      id: 'a1|a1s1|s3', assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's3',
      versions: [
        { id: 'v-3-1', seq: 1, durationSec: 6, wave: wave(5), recordedAt: t('2026-09-21T14:40:00'), status: 'active', trigger: '首次录音' },
      ],
    },
    {
      id: 'a1|a1s3|s4', assignmentId: 'a1', sentenceId: 'a1s3', studentId: 's4',
      versions: [
        { id: 'v-4-1', seq: 1, durationSec: 9, wave: wave(6), recordedAt: t('2026-09-21T19:05:00'), status: 'withdrawn', trigger: '首次录音' },
        { id: 'v-4-2', seq: 2, durationSec: 8, wave: wave(7), recordedAt: t('2026-09-21T19:12:00'), status: 'active', trigger: '撤回重录' },
      ],
    },
    {
      id: 'a1|a1s2|s6', assignmentId: 'a1', sentenceId: 'a1s2', studentId: 's6',
      versions: [
        { id: 'v-6-2', seq: 1, durationSec: 7, wave: wave(8), recordedAt: t('2026-09-22T07:50:00'), status: 'active', trigger: '首次录音' },
      ],
    },
    {
      id: 'a1|a1s1|s7', assignmentId: 'a1', sentenceId: 'a1s1', studentId: 's7',
      versions: [
        { id: 'v-7-1', seq: 1, durationSec: 6, wave: wave(9), recordedAt: t('2026-09-22T08:40:00'), status: 'active', trigger: '首次录音' },
      ],
    },
    // —— a2：已截止 ——
    {
      id: 'a2|a2s1|s2', assignmentId: 'a2', sentenceId: 'a2s1', studentId: 's2',
      versions: [
        { id: 'v-2-a2-1', seq: 1, durationSec: 6, wave: wave(10), recordedAt: t('2026-09-19T20:11:00'), status: 'active', trigger: '首次录音' },
      ],
    },
    {
      // 被退回且已逾期：永久挂起，无法复录
      id: 'a2|a2s2|s5', assignmentId: 'a2', sentenceId: 'a2s2', studentId: 's5',
      versions: [
        { id: 'v-5-a2-1', seq: 1, durationSec: 8, wave: wave(11), recordedAt: t('2026-09-19T21:30:00'), status: 'rejected', trigger: '首次录音' },
      ],
    },
  ],
  reviews: [
    { id: 'r1', versionId: 'v-1-1', assignmentId: 'a1', sentenceId: 'a1s1', revieweeId: 's1', reviewerId: 's3', claimedAt: t('2026-09-21T12:00:00'), submittedAt: t('2026-09-21T12:20:00'), score: 82, comment: '发音清晰，重音自然，句末降调再明显一点会更好。' },
    { id: 'r2', versionId: 'v-2-1', assignmentId: 'a1', sentenceId: 'a1s1', revieweeId: 's2', reviewerId: 's4', claimedAt: t('2026-09-21T13:00:00'), submittedAt: t('2026-09-21T13:10:00'), score: 52, comment: '整句节奏偏赶，morning 和 different 的元音不够饱满，建议先慢速分句再连读。' },
    { id: 'r3', versionId: 'v-3-1', assignmentId: 'a1', sentenceId: 'a1s1', revieweeId: 's3', reviewerId: 's5', claimedAt: t('2026-09-22T09:00:00'), score: null, comment: '' },
    { id: 'r4', versionId: 'v-6-2', assignmentId: 'a1', sentenceId: 'a1s2', revieweeId: 's6', reviewerId: 's1', claimedAt: t('2026-09-22T09:10:00'), submittedAt: t('2026-09-22T09:18:00'), score: 74, comment: '问句语调有到位，through 的连读可以再顺滑些。' },
    { id: 'r5', versionId: 'v-2-a2-1', assignmentId: 'a2', sentenceId: 'a2s1', revieweeId: 's2', reviewerId: 's4', claimedAt: t('2026-09-20T08:00:00'), submittedAt: t('2026-09-20T08:20:00'), score: 68, comment: '停顿合理，curiosity 的重音位置再注意。' },
    { id: 'r6', versionId: 'v-5-a2-1', assignmentId: 'a2', sentenceId: 'a2s2', revieweeId: 's5', reviewerId: 's6', claimedAt: t('2026-09-20T08:30:00'), submittedAt: t('2026-09-20T08:45:00'), score: 55, comment: 'breathe 一词发音不完整，后半句气息没有跟上。' },
  ],
};
