import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useLab } from '../lab/store';
import type { RuleCode } from '../lab/types';
import { fmtTime, RULE_META, RuleTag } from './ui';

export function BlockLog() {
  const { state } = useLab();
  const [ruleFilter, setRuleFilter] = useState<RuleCode | 'ALL'>('ALL');

  const rules = useMemo(
    () => Array.from(new Set(state.blocks.map((b) => b.rule))),
    [state.blocks],
  );
  const list = state.blocks.filter((b) => ruleFilter === 'ALL' || b.rule === ruleFilter);
  const nameOf = (id: number) => state.students.find((s) => s.id === id)?.name ?? `#${id}`;

  return (
    <div className="rl-blocks">
      <div className="rl-blocks-head">
        <div>
          <h3><ShieldAlert size={16} /> 受阻记录</h3>
          <p>每一次被规则拦截的操作都在此留痕：谁、在什么作业 / 句子 / 录音版本上、触发了哪条规则。</p>
        </div>
        <b>{state.blocks.length} 条</b>
      </div>

      <div className="rl-filters">
        <button className={ruleFilter === 'ALL' ? 'active' : ''} onClick={() => setRuleFilter('ALL')}>全部</button>
        {rules.map((r) => (
          <button key={r} className={ruleFilter === r ? 'active' : ''} onClick={() => setRuleFilter(r)}>
            {RULE_META[r].label}
          </button>
        ))}
      </div>

      {list.length === 0 && <div className="rl-empty">没有匹配的受阻记录。</div>}
      <div className="rl-block-list">
        {list.map((b) => {
          const a = state.assignments.find((x) => x.id === b.assignmentId);
          return (
            <div key={b.id} className="rl-block-row">
              <div className="rl-block-time">{fmtTime(b.at)}</div>
              <div className="rl-block-body">
                <div className="rl-block-action">
                  <span className="rl-avatar sm">{nameOf(b.actorId).slice(0, 1)}</span>
                  <b>{nameOf(b.actorId)}</b> 尝试：{b.action}
                </div>
                <div className="rl-block-detail">
                  <RuleTag rule={b.rule} />
                  <span>{b.detail}</span>
                </div>
                <div className="rl-block-meta">
                  {a && <span>作业：{a.title}</span>}
                  {b.studentId !== undefined && <span>涉及学生：{nameOf(b.studentId)}</span>}
                  {b.sentenceIndex !== undefined && <span>句子：第 {b.sentenceIndex + 1} 句</span>}
                  {b.versionId !== undefined && <span>录音版本：{versionLabel(state, b.versionId)}</span>}
                  <span className="rl-rule-explain">{RULE_META[b.rule].text}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function versionLabel(state: ReturnType<typeof useLab>['state'], id: number): string {
  const v = state.versions.find((x) => x.id === id);
  if (!v) return `#${id}（已不存在）`;
  const a = state.assignments.find((x) => x.id === v.assignmentId);
  return `${a?.title ?? ''} · 第 ${v.sentenceIndex + 1} 句 · v${v.version}`;
}
