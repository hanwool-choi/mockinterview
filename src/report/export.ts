import type { Lang, Report, Rubric } from '../../shared/schema';
import type { AnswerItem } from '../engine/machine';
import { translate, type Key } from '../i18n';

const KEYS: (keyof Rubric)[] = ['structure', 'specificity', 'jobFit', 'consistency', 'delivery'];

export function averageRubric(items: AnswerItem[]): Rubric {
  const scored = items.filter((i) => i.score && !i.skipped);
  const out = { structure: 0, specificity: 0, jobFit: 0, consistency: 0, delivery: 0 };
  if (!scored.length) return out;
  for (const k of KEYS) out[k] = Math.round(scored.reduce((n, i) => n + i.score!.rubric[k], 0) / scored.length);
  return out;
}

export function toMarkdown(report: Report, items: AnswerItem[], names: Record<string, string>, lang: Lang): string {
  const t = (k: Key, v?: Record<string, string | number>) => translate(lang, k, v);
  const p = report.publicSummary;
  const d = report.privateDetail;
  const out: string[] = [
    `# ${t('report.title')} — ${p.company}${p.role ? ` · ${p.role}` : ''}`,
    '',
    `**${p.grade} · ${p.score}/100 · ${t(`report.verdict.${p.verdict}` as Key)}** — ${p.oneLiner}`,
    '',
    `## ${t('report.why')}`,
    d.verdictReason,
    '',
    `## ${t('report.panel')}`,
    ...d.interviewerComments.map((c) => `- **${names[c.interviewerId] ?? c.interviewerId}**: ${c.comment}`),
    '',
    `## ${t('report.strengths')}`,
    ...d.top3Strengths.map((s) => `- ${s}`),
    '',
    `## ${t('report.fixes')}`,
    ...d.top3Fixes.map((s) => `- ${s}`),
    '',
    `## ${t('report.next')}`,
    ...d.nextQuestions.map((s) => `- ${s}`),
    '',
    `## ${t('report.table')}`,
  ];
  items.forEach((i, n) => {
    out.push('', `### ${n + 1}. ${i.asked}`, `*${t(`stage.${i.stage}` as Key)} · ${names[i.askedBy] ?? i.askedBy}*`, '');
    if (i.skipped) {
      out.push(`> ${t('report.skipped')}`);
      return;
    }
    out.push(`**${t('report.myAnswer')}**`, '', i.answer, '');
    if (i.score) {
      out.push(`**${t('card.score')}: ${i.score.score} (${i.score.grade})**`);
      if (i.score.improvements.length) out.push('', ...i.score.improvements.map((x) => `- ${x}`));
      if (i.score.betterAnswer) out.push('', `**${t('report.better')}**`, '', i.score.betterAnswer);
    }
  });
  return out.join('\n') + '\n';
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
