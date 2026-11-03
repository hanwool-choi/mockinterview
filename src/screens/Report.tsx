import { useState } from 'react';
import { Icon } from '../components/Icon';
import type { Report as R } from '../../shared/schema';
import { Portrait2D } from '../avatar/Portrait2D';
import { lookFor } from '../avatar/look';
import { api } from '../api/client';
import { RubricGrid, SheetFields, SheetProgress, VerdictBadge } from '../components/Sheet';
import { sheetRows } from '../landing/rows';
import { GuideView } from '../components/Guide';
import { SupportNote, SupportPip } from '../components/Support';
import type { InterviewState } from '../engine/machine';
import { useT, type Key } from '../i18n';
import { averageRubric, download, toMarkdown } from '../report/export';
import type { Setup } from '../state/setup';

export function Report({ setup, report, state, onAgain }: { setup: Setup; report: R; state: InterviewState; onAgain: () => void }) {
  const t = useT();
  const [rated, setRated] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const p = report.publicSummary;
  const d = report.privateDetail;
  const names = Object.fromEntries(state.plan.interviewers.map((i) => [i.id, i.displayName]));
  const titles = Object.fromEntries(state.plan.interviewers.map((i) => [i.id, i.title]));
  const stationName = Object.fromEntries(sheetRows(state.plan, setup.uiLang).map((st) => [st.id, st.label]));
  const verdictFace = p.verdict === 'pass' ? 'smile' : p.verdict === 'hold' ? 'doubt' : 'serious';

  return (
    <main className="report" data-testid="report">
      <article className="sheet report-sheet" aria-labelledby="sheet-title" data-ui>
        <header className="sheet-head">
          <h1 id="sheet-title">{t('sheet.title')}</h1>
          <SheetFields
            fields={[
              [t('sheet.company'), p.company],
              [t('sheet.role'), p.role || '—'],
              [t('sheet.type'), t(setup.mode === 'practice' ? 'sheet.typePractice' : 'sheet.typeReal')],
              [t('sheet.date'), new Date().toLocaleDateString(setup.uiLang === 'ko' ? 'ko-KR' : 'en-US')],
            ]}
          />
        </header>
        <RubricGrid rubric={averageRubric(state.items)} lang={setup.lang} caption={t('report.radar')} />
        <div className="sheet-total">
          <div>
            <span className="sheet-k">{t('sheet.total')}</span>
            <b className="big-num">{p.score}</b>
            <small>/100</small>
          </div>
          <div>
            <span className="sheet-k">{t('sheet.grade')}</span>
            <b className={`big-num grade-text grade-${p.grade}`}>{p.grade}</b>
          </div>
          <div className="sheet-verdict">
            <span className="sheet-k">{t('sheet.verdict')}</span>
            <VerdictBadge verdict={p.verdict} label={t(`report.verdict.${p.verdict}` as Key)} />
          </div>
        </div>
        <section className="sheet-opinion">
          <h2 className="sheet-k">{t('sheet.opinion')}</h2>
          <p className="lead">{p.oneLiner}</p>
          <p>{d.verdictReason}</p>
          {report.local && <p className="badge">{t('report.local')}</p>}
        </section>
        <SheetProgress
          showLabels
          ariaLabel={t('room.routeLabel')}
          cells={sheetRows(state.plan, setup.uiLang).map((st) => {
            const scored = state.items.find((it) => it.questionId === st.id && it.score && !it.skipped);
            return { id: st.id, label: st.label, state: 'done' as const, mark: st.id === 'icebreak' ? undefined : scored ? String(scored.score!.score) : '–' };
          })}
        />
        <section className="sheet-signers">
          <h2 className="sheet-k">{t('sheet.signers')}</h2>
          <ul className="panel-comments">
            {d.interviewerComments.map((c) => {
              const cfg = setup.interviewers.find((i) => i.id === c.interviewerId);
              return (
                <li key={c.interviewerId}>
                  {cfg && <Portrait2D look={lookFor(cfg, setup.overrides[cfg.id])} state={verdictFace} size={56} seed={cfg.seed} />}
                  <div>
                    <b>
                      {names[c.interviewerId] ?? c.interviewerId} <small>{titles[c.interviewerId]}</small>
                    </b>
                    <p>{c.comment}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </article>

      <SupportNote where="report" />
      <SupportPip where="report" show delayMs={2500} />
      <div className="report-grid">
        <section className="card">
          <h2>{t('report.strengths')}</h2>
          <ol>{d.top3Strengths.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <h2>{t('report.fixes')}</h2>
          <ol>{d.top3Fixes.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
        <section className="card">
          <h2>{t('report.next')}</h2>
          <ul>{d.nextQuestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>
      </div>

      <section className="card qa-table">
        <h2>{t('report.table')}</h2>
        <table>
          <tbody>
            {state.items.map((it, i) => (
              <tr key={i} className={open === i ? 'open' : ''}>
                <td className="n">{i + 1}</td>
                <td>
                  <button className="link row-toggle" onClick={() => setOpen(open === i ? null : i)}>
                    <span className="stage-tag">{stationName[it.questionId] ?? t(`stage.${it.stage}` as Key)}</span> {it.asked}
                  </button>
                  {open !== i && it.score?.guide?.verdict && <p className="row-verdict">{it.score.guide.verdict}</p>}
                  {open === i && (
                    <div className="row-detail">
                      <h4>{t('report.myAnswer')}</h4>
                      <p>{it.skipped ? t('report.skipped') : it.answer}</p>
                      {it.score?.guide ? <GuideView guide={it.score.guide} compact /> : it.score?.improvements.length ? <ul>{it.score.improvements.map((x, j) => <li key={j}>{x}</li>)}</ul> : null}
                      {it.score?.betterAnswer && (
                        <>
                          <h4>{t('report.better')}</h4>
                          <p className="better">{it.score.betterAnswer}</p>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td className="s">
                  {it.skipped ? '—' : it.score ? <b className={`grade-text grade-${it.score.grade}`}>{it.score.score}</b> : '…'}
                  {it.score?.local && <small className="badge">{t('card.local')}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="report-actions no-print">
        <button className="ghost" onClick={() => download(`interview-${p.company}.md`, toMarkdown(report, state.items, names, setup.lang))}>
          {t('report.md')}
        </button>
        <button className="ghost" onClick={() => window.print()}>
          {t('report.pdf')}
        </button>
        <button className="primary" onClick={onAgain}>
          {t('report.again')}
        </button>
      </footer>
      <section className="rate no-print">
        <span>{t('report.rate')}</span>
        {rated ? (
          <b>{t('report.thanks')}</b>
        ) : (
          [1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className="star"
              aria-label={`${n}`}
              onClick={() => {
                setRated(n);
                api.track('rating', setup.lang, n);
              }}
            >
              <Icon name="star" size={24} filled />
            </button>
          ))
        )}
      </section>
    </main>
  );
}
