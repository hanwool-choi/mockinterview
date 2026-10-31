import { useState } from 'react';
import type { Report as R } from '../../shared/schema';
import { Portrait2D } from '../avatar/Portrait2D';
import { faceTarget } from '../avatar/expression';
import { lookFor } from '../avatar/look';
import { api } from '../api/client';
import { RubricBars } from '../components/RubricBars';
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
  const verdictFace = p.verdict === 'pass' ? 'smile' : p.verdict === 'hold' ? 'tilt' : 'frown';

  return (
    <main className="report" data-testid="report">
      <header className="report-hero">
        <div className={`grade big grade-${p.grade}`}>{p.grade}</div>
        <div>
          <p className="eyebrow">
            {t('report.title')} · {p.company}
            {p.role ? ` · ${p.role}` : ''}
          </p>
          <h1>
            {p.score}
            <small>/100</small> <span className={`verdict v-${p.verdict}`}>{t(`report.verdict.${p.verdict}` as Key)}</span>
          </h1>
          <p className="lead">{p.oneLiner}</p>
          {report.local && <p className="badge">{t('report.local')}</p>}
        </div>
      </header>

      <div className="report-grid">
        <section className="card">
          <h2>{t('report.why')}</h2>
          <p>{d.verdictReason}</p>
          <RubricBars rubric={averageRubric(state.items)} lang={setup.lang} />
        </section>
        <section className="card">
          <h2>{t('report.panel')}</h2>
          <ul className="panel-comments">
            {d.interviewerComments.map((c) => {
              const cfg = setup.interviewers.find((i) => i.id === c.interviewerId);
              return (
                <li key={c.interviewerId}>
                  {cfg && <Portrait2D look={lookFor(cfg, setup.overrides[cfg.id])} face={faceTarget(verdictFace, lookFor(cfg).browBase)} size={56} />}
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
                    <span className="stage-tag">{t(`stage.${it.stage}` as Key)}</span> {it.asked}
                  </button>
                  {open === i && (
                    <div className="row-detail">
                      <h4>{t('report.myAnswer')}</h4>
                      <p>{it.skipped ? t('report.skipped') : it.answer}</p>
                      {it.score?.improvements.length ? <ul>{it.score.improvements.map((x, j) => <li key={j}>{x}</li>)}</ul> : null}
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
              ★
            </button>
          ))
        )}
      </section>
    </main>
  );
}
