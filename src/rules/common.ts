import type { Assignment, LabState, Pair, RecordingVersion, Review, Sentence, Student, Submission } from '../data/types';

export const sid = (assignmentId: string, sentenceId: string, studentId: string) =>
  `${assignmentId}|${sentenceId}|${studentId}`;

export const getStudent = (s: LabState, id: string): Student | undefined =>
  s.students.find(x => x.id === id);

export const getAssignment = (s: LabState, id: string): Assignment | undefined =>
  s.assignments.find(a => a.id === id);

export const getSentence = (a: Assignment, id: string): Sentence | undefined =>
  a.sentences.find(x => x.id === id);

export const getSubmission = (s: LabState, a: string, sent: string, student: string): Submission | undefined =>
  s.submissions.find(x => x.assignmentId === a && x.sentenceId === sent && x.studentId === student);

/** 同组（互评两人一组）；未编组返回 undefined */
export const pairOf = (s: LabState, studentId: string): Pair | undefined =>
  s.pairs.find(p => p.a === studentId || p.b === studentId);

/** 同组伙伴；未编组返回 undefined */
export const partnerOf = (s: LabState, studentId: string): string | undefined => {
  const p = pairOf(s, studentId);
  if (!p) return undefined;
  return p.a === studentId ? p.b : p.a;
};

export const isSamePair = (s: LabState, x: string, y: string): boolean => {
  const p = pairOf(s, x);
  return !!p && (p.a === y || p.b === y);
};

/** 当前唯一有效稿（active）。重录撤回后旧稿变 withdrawn，退回稿变 rejected，旧稿仍可查 */
export const activeVersion = (sub: Submission | undefined): RecordingVersion | undefined =>
  sub?.versions.find(v => v.status === 'active');

export const versionIn = (s: LabState, versionId: string): { sub: Submission; version: RecordingVersion } | undefined => {
  for (const sub of s.submissions) {
    const version = sub.versions.find(v => v.id === versionId);
    if (version) return { sub, version };
  }
  return undefined;
};

export const reviewOfVersion = (s: LabState, versionId: string): Review | undefined =>
  s.reviews.find(r => r.versionId === versionId);

export const isClosed = (a: Assignment, now: number): boolean => now > a.deadline;

export const fmtDeadline = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const fmtDuration = (sec: number): string => `0:${String(sec).padStart(2, '0')}`;

/** 截止剩余（ms），已截止为 0 */
export const remaining = (a: Assignment, now: number): number => Math.max(0, a.deadline - now);
