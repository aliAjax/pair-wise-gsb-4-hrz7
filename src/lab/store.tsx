// 数据层 × 规则层的接缝：React store。
// 所有写操作先走 policy 闸门；通过才改状态，受阻则落一条 block 记录并返回原因。
// 版本一经创建永不删除（退回/撤回只改状态），旧稿永久可查。
// 全部状态写入 localStorage，刷新后作业、提交、配对与版本保持一致。

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { canClaim, canSubmit, canSubmitReview, canWithdraw } from './policy';
import { buildSeedState } from './seed';
import type {
  Assignment,
  BlockEvent,
  GateResult,
  Id,
  LabState,
  RecordingVersion,
  RuleCode,
  Student,
} from './types';

const STORE_KEY = 'reading-lab-state-v1';
const PREF_KEY = 'reading-lab-prefs-v1';

export type LabPrefs = { mode: 'teacher' | 'student'; studentId: Id; reviewerId: Id };

function loadState(): LabState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LabState;
      if (parsed.students?.length && parsed.assignments && parsed.versions) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return buildSeedState(Date.now());
}

function loadPrefs(students: Student[]): LabPrefs {
  const fallback: LabPrefs = { mode: 'student', studentId: students[0].id, reviewerId: students[1].id };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<LabPrefs>) };
  } catch {
    /* ignore */
  }
  return fallback;
}

export type SubmitOutcome = GateResult;

type LabApi = {
  state: LabState;
  now: number;
  prefs: LabPrefs;
  setPrefs: (p: Partial<LabPrefs>) => void;
  student: Student;
  reviewer: Student;
  /** 学生：提交一条新录音（含退回后重录；旧稿保留并回填 replacedBy） */
  submitRecording: (
    assignmentId: Id,
    sentenceIndex: number,
    durationSec: number,
    wave: number[],
  ) => SubmitOutcome;
  /** 学生：撤回当前有效稿（重录前置动作） */
  withdrawVersion: (versionId: Id) => SubmitOutcome;
  /** 评审：认领一条待评审录音（独占） */
  claimVersion: (versionId: Id) => SubmitOutcome;
  /** 评审：解除自己的认领，归还评审池 */
  releaseClaim: (versionId: Id) => void;
  /** 评审：提交分数与评语；低于及格线退回重录 */
  submitReview: (versionId: Id, score: number, comment: string) => SubmitOutcome;
  /** 教师：布置新作业 */
  addAssignment: (a: { title: string; sentences: string[]; passScore: number; deadline: number }) => string | null;
  /** 教师：重置为示例数据 */
  resetDemo: () => void;
};

const Ctx = createContext<LabApi | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LabState>(loadState);
  const [prefs, setPrefsState] = useState<LabPrefs>(() => loadPrefs(loadState().students));
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const setPrefs = useCallback((p: Partial<LabPrefs>) => setPrefsState((cur) => ({ ...cur, ...p })), []);

  const logBlock = useCallback(
    (
      rule: RuleCode,
      actorId: Id,
      action: string,
      detail: string,
      ref?: { assignmentId?: Id; studentId?: Id; sentenceIndex?: number; versionId?: Id },
    ) => {
      setState((s) => ({
        ...s,
        seq: s.seq + 1,
        blocks: [
          { id: s.seq + 1, at: Date.now(), actorId, action, rule, detail, ...ref },
          ...s.blocks,
        ],
      }));
    },
    [],
  );

  const submitRecording = useCallback(
    (assignmentId: Id, sentenceIndex: number, durationSec: number, wave: number[]): SubmitOutcome => {
      const s = stateRef.current;
      const actorId = prefs.studentId;
      const assignment = s.assignments.find((a) => a.id === assignmentId);
      const gate = canSubmit(assignment, s.versions, actorId, sentenceIndex, Date.now());
      if (!gate.ok) {
        logBlock(gate.rule, actorId, `提交录音（${assignment?.title ?? '未知作业'} · 第 ${sentenceIndex + 1} 句）`, gate.message, {
          assignmentId,
          studentId: actorId,
          sentenceIndex,
        });
        return gate;
      }
      setState((cur) => {
        const seq = cur.seq + 1;
        const prior = cur.versions
          .filter(
            (v) =>
              v.assignmentId === assignmentId &&
              v.studentId === actorId &&
              v.sentenceIndex === sentenceIndex &&
              (v.status === 'returned' || v.status === 'withdrawn'),
          )
          .sort((a, b) => b.version - a.version)[0];
        const version = (prior?.version ?? 0) + 1;
        const nv: RecordingVersion = {
          id: seq,
          assignmentId,
          studentId: actorId,
          sentenceIndex,
          version,
          durationSec,
          wave,
          createdAt: Date.now(),
          status: 'pending',
        };
        const versions = prior
          ? cur.versions.map((v) => (v.id === prior.id ? { ...v, replacedBy: seq } : v)).concat(nv)
          : cur.versions.concat(nv);
        return { ...cur, seq, versions };
      });
      return { ok: true };
    },
    [logBlock, prefs.studentId],
  );

  const withdrawVersion = useCallback(
    (versionId: Id): SubmitOutcome => {
      const s = stateRef.current;
      const actorId = prefs.studentId;
      const v = s.versions.find((x) => x.id === versionId);
      const assignment = s.assignments.find((a) => a.id === v?.assignmentId);
      const gate = canWithdraw(assignment, v, actorId, Date.now());
      if (!gate.ok) {
        logBlock(gate.rule, actorId, `撤回录音（${assignment?.title ?? '未知作业'} · 第 ${(v?.sentenceIndex ?? 0) + 1} 句 v${v?.version ?? '?'}）`, gate.message, {
          assignmentId: assignment?.id,
          studentId: actorId,
          sentenceIndex: v?.sentenceIndex,
          versionId,
        });
        return gate;
      }
      setState((cur) => ({
        ...cur,
        versions: cur.versions.map((x) => (x.id === versionId ? { ...x, status: 'withdrawn' } : x)),
      }));
      return { ok: true };
    },
    [logBlock, prefs.studentId],
  );

  const claimVersion = useCallback(
    (versionId: Id): SubmitOutcome => {
      const s = stateRef.current;
      const actorId = prefs.reviewerId;
      const v = s.versions.find((x) => x.id === versionId);
      const gate = canClaim(s.students, v, actorId);
      if (!gate.ok) {
        const assignment = s.assignments.find((a) => a.id === v?.assignmentId);
        const author = s.students.find((x) => x.id === v?.studentId);
        logBlock(
          gate.rule,
          actorId,
          `认领评审（${author?.name ?? '录音'} · ${assignment?.title ?? '未知作业'} · 第 ${(v?.sentenceIndex ?? 0) + 1} 句 v${v?.version ?? '?'}）`,
          gate.message,
          { assignmentId: v?.assignmentId, studentId: v?.studentId, sentenceIndex: v?.sentenceIndex, versionId },
        );
        return gate;
      }
      if (!v) return gate;
      setState((cur) => ({
        ...cur,
        versions: cur.versions.map((x) =>
          x.id === versionId ? { ...x, status: 'claimed', claimedBy: actorId, claimedAt: Date.now() } : x,
        ),
      }));
      return { ok: true };
    },
    [logBlock, prefs.reviewerId],
  );

  const releaseClaim = useCallback(
    (versionId: Id) => {
      const actorId = prefs.reviewerId;
      setState((cur) => ({
        ...cur,
        versions: cur.versions.map((x) =>
          x.id === versionId && x.status === 'claimed' && x.claimedBy === actorId
            ? { ...x, status: 'pending', claimedBy: undefined, claimedAt: undefined }
            : x,
        ),
      }));
    },
    [prefs.reviewerId],
  );

  const submitReview = useCallback(
    (versionId: Id, score: number, comment: string): SubmitOutcome => {
      const s = stateRef.current;
      const actorId = prefs.reviewerId;
      const v = s.versions.find((x) => x.id === versionId);
      const gate = canSubmitReview(v, actorId, score, comment);
      if (!gate.ok) {
        logBlock(gate.rule, actorId, `提交评审（录音 v${v?.version ?? '?'}）`, gate.message, { versionId });
        return gate;
      }
      const assignment = s.assignments.find((a) => a.id === v!.assignmentId)!;
      const passed = score >= assignment.passScore;
      setState((cur) => ({
        ...cur,
        versions: cur.versions.map((x) =>
          x.id === versionId
            ? {
                ...x,
                // 低于及格线退回重录：本条另存为 returned 版本仍可查，
                // 作者该句重新出现提交入口（无需手动撤回）。
                status: passed ? 'reviewed' : 'returned',
                review: { score, comment: comment.trim(), reviewerId: actorId, reviewedAt: Date.now() },
              }
            : x,
        ),
      }));
      return { ok: true };
    },
    [logBlock, prefs.reviewerId],
  );

  const addAssignment = useCallback(
    (input: { title: string; sentences: string[]; passScore: number; deadline: number }): string | null => {
      const title = input.title.trim();
      const sentences = input.sentences.map((s) => s.trim()).filter(Boolean);
      if (!title) return '请填写作业标题';
      if (sentences.length === 0) return '请至少布置一个朗读句子';
      if (input.passScore < 0 || input.passScore > 100) return '及格线需在 0–100 之间';
      if (input.deadline <= Date.now()) return '截止时刻必须晚于当前时间';
      setState((cur) => {
        const seq = cur.seq + 1;
        const a: Assignment = { id: seq, title, sentences, passScore: input.passScore, deadline: input.deadline, createdAt: Date.now() };
        return { ...cur, seq, assignments: [...cur.assignments, a] };
      });
      return null;
    },
    [],
  );

  const resetDemo = useCallback(() => {
    const fresh = buildSeedState(Date.now());
    setState(fresh);
  }, []);

  const student = useMemo(
    () => state.students.find((x) => x.id === prefs.studentId) ?? state.students[0],
    [state.students, prefs.studentId],
  );
  const reviewer = useMemo(
    () => state.students.find((x) => x.id === prefs.reviewerId) ?? state.students[1],
    [state.students, prefs.reviewerId],
  );

  const api: LabApi = {
    state,
    now,
    prefs,
    setPrefs,
    student,
    reviewer,
    submitRecording,
    withdrawVersion,
    claimVersion,
    releaseClaim,
    submitReview,
    addAssignment,
    resetDemo,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useLab(): LabApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLab must be used within LabProvider');
  return ctx;
}

export type { BlockEvent };
