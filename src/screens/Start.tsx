import { useContext, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../shared/schema';
import { Portrait2D } from '../avatar/Portrait2D';
import { lookFor } from '../avatar/look';
import { Icon } from '../components/Icon';
import { PenCheck, RubricGrid, SheetFields, Stamp } from '../components/Sheet';
import { chunkDoc } from '../docs/chunk';
import { buildTemplatePlan } from '../engine/templates';
import { translate, UiLangContext, type Key } from '../i18n';
import { COPY, ROW_LABELS, SAMPLE_SHEET } from '../landing/copy';
import { SAMPLE } from '../samples/sample';
import { defaultInterviewers } from '../state/setup';

const PANEL = (() => {
  const [lead, hr, dev] = defaultInterviewers();
  return [lead, hr, { ...dev, personality: 'pressure' as const }];
})();

function useSamplePlan(lang: Lang) {
  return useMemo(() => {
    const s = SAMPLE[lang];
    const chunks = [...chunkDoc('jd', s.docs.jd), ...chunkDoc('resume', s.docs.resume), ...chunkDoc('portfolio', s.docs.portfolio)];
    const plan = buildTemplatePlan({ lang, company: s.company, role: s.role, career: 'exp', interviewers: PANEL, chunks });
    return { plan, chunks };
  }, [lang]);
}

/** Marks the quoted resume line inside its source passage. */
function Passage({ text, quote }: { text: string; quote?: string }) {
  const q = quote?.replace(/…$/, '');
  const i = q ? text.indexOf(q) : -1;
  if (!q || i < 0) return <p className="passage">{text}</p>;
  return (
    <p className="passage">
      {text.slice(0, i)}
      <mark>{q}</mark>
      {text.slice(i + q.length)}
    </p>
  );
}

export function Start({ onPick }: { onPick: (l: Lang) => void }) {
  const ui = useContext(UiLangContext);
  const c = COPY[ui];
  const t = (k: Key) => translate(ui, k);
  const { plan, chunks } = useSamplePlan(ui);
  const [sel, setSel] = useState(3);
  const other: Lang = ui === 'ko' ? 'en' : 'ko';
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s = SAMPLE[ui];

  // Section parts rise in once as they enter; content is visible by default without script.
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.landing .feature > *, .landing .modes-grid > *, .landing .privacy-field > h2, .landing .privacy-list > li, .landing .faq > *, .landing .close > *')];
    els.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--d', `${(i % 3) * 80}ms`);
    });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
      { rootMargin: '0px 0px -10% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const rows = ROW_LABELS[ui];
  const q = sel > 0 ? plan.questions[sel - 1] : undefined;
  const whoOf = (id: string | undefined) => {
    const askerId = id ?? (PANEL.find((p) => p.role === 'hr') ?? PANEL[0]).id;
    const cfg = PANEL.find((p) => p.id === askerId)!;
    return { cfg, name: plan.interviewers.find((p) => p.id === askerId)?.displayName ?? '', title: `${translate(ui, `role.${cfg.role}` as Key)} · ${translate(ui, `rank.${cfg.rank}` as Key)}` };
  };
  const asker = whoOf(q?.askedBy);
  const evidence = q?.evidenceIds.map((id) => chunks.find((ch) => ch.id === id)).filter(Boolean)[0];
  const quote = q?.text.match(/"([^"]+)"/)?.[1];
  const probe = sel >= 3 && sel <= 5;

  return (
    <main className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">{c.h1}</h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <button className="primary big" data-testid={`lang-${ui}`} onClick={() => onPick(ui)}>
              {c.start} <Icon name="arrowRight" />
            </button>
            <button className="link other-lang" data-testid={`lang-${other}`} onClick={() => onPick(other)} lang={other}>
              {c.startOther}
            </button>
          </div>
          <p className="free-note">{c.free}</p>
        </div>

        <figure className="hero-sheet">
          <article className="sheet" aria-label={c.sheetNote} data-ui>
            <header className="sheet-head">
              <p className="sheet-title" aria-hidden="true">{t('sheet.title')}</p>
              <SheetFields
                fields={[
                  [t('sheet.company'), s.company],
                  [t('sheet.role'), s.role],
                  [ui === 'ko' ? '지원자' : 'Candidate', c.sheetCandidate],
                  [t('sheet.type'), ui === 'ko' ? `경력 ${s.years}년` : `${s.years} yrs experience`],
                ]}
              />
            </header>
            <RubricGrid rubric={SAMPLE_SHEET.rubric} lang={ui} compact />
            <div className="sheet-total">
              <div>
                <span className="sheet-k">{t('sheet.total')}</span>
                <span className="hand big-hand">{SAMPLE_SHEET.score}</span>
                <small>/100</small>
              </div>
              <div className="sheet-verdict">
                <span className="sheet-k">{t('sheet.verdict')}</span>
                <Stamp verdict={SAMPLE_SHEET.verdict} label={t(`report.verdict.${SAMPLE_SHEET.verdict}` as Key)} />
              </div>
            </div>
            <div className="sheet-opinion">
              <span className="sheet-k">{t('sheet.opinion')}</span>
              <p className="hand opinion-hand">{SAMPLE_SHEET.opinion[ui]}</p>
            </div>
            <div className="sheet-signs" aria-hidden="true">
              {plan.interviewers.map((p) => (
                <span key={p.id}>
                  <small>{ui === 'ko' ? '면접관' : 'Interviewer'}</small>
                  <span className="hand">{p.displayName}</span>
                </span>
              ))}
            </div>
          </article>
          <figcaption>{c.sheetNote}</figcaption>
        </figure>
      </section>

      <section className="questions" id="route" aria-labelledby="q-title">
        <h2 id="q-title">{c.questionsH}</h2>
        <p className="route-hint">{c.routeHint}</p>
        <div className="q-sheet">
          <div className="q-list" role="listbox" aria-label={c.routeLabel} data-ui>
            <div className="q-row q-headrow" aria-hidden="true">
              {c.cols.map((h) => <span key={h}>{h}</span>)}
            </div>
            {rows.map((r, i) => {
              const who = whoOf(i > 0 ? plan.questions[i - 1]?.askedBy : undefined);
              return (
                <button key={r.label} type="button" role="option" aria-selected={sel === i} className={`q-row ${sel === i ? 'on' : ''}`} onClick={() => setSel(i)}>
                  <span className="q-n">{i}</span>
                  <span className="q-stage">
                    {r.label}
                    {i >= 3 && i <= 5 && <em>{ui === 'ko' ? '이력서 인용' : 'quotes resume'}</em>}
                  </span>
                  <span className="q-by">{who.name}</span>
                  <span className="q-tick">{sel === i && <PenCheck />}</span>
                </button>
              );
            })}
          </div>
          <article className="board" aria-live="polite" key={sel}>
            <blockquote className="board-question">{q ? q.text : plan.smallTalk.opening[0]}</blockquote>
            <p className="board-by">
              <Portrait2D look={lookFor(asker.cfg)} size={44} seed={asker.cfg.seed} />
              <span>
                <b>{asker.name}</b> · {asker.title}
              </span>
            </p>
            <p className="intent">
              <b>{c.intent}</b> {q ? q.intent : c.unscored}
            </p>
            {q?.followUpSeeds[0] && probe && (
              <p className="probe-line">
                <b>{c.transfer}</b> {q.followUpSeeds[0]}
              </p>
            )}
            {evidence && (
              <figure className="board-source">
                <Passage text={evidence.text} quote={quote} />
                <figcaption>{c.source}</figcaption>
              </figure>
            )}
          </article>
        </div>
        <p className="board-sample">{c.sample}</p>
      </section>

      <section className="feature panel-feature" id="panel" aria-labelledby="panel-title">
        <figure className="shot wide">
          <video src="/landing/room-loop.mp4" poster="/landing/room-loop-poster.webp" width={928} height={540} muted loop playsInline autoPlay={!reduceMotion} aria-label={c.heroVideoAlt} />
          <figcaption>{c.heroVideoCap}</figcaption>
        </figure>
        <div className="feature-copy">
          <h2 id="panel-title">{c.panelH}</h2>
          <p>{c.panelP}</p>
          <ul className="ticks">
            {c.panelList.map((x) => (
              <li key={x}>
                <PenCheck />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="feature modes" aria-labelledby="modes-title">
        <h2 id="modes-title">{c.modesH}</h2>
        <div className="modes-grid">
          <div>
            <h3>{c.practiceH}</h3>
            <p>{c.practiceP}</p>
          </div>
          <figure className="shot card-shot">
            <img src="/landing/card.webp" alt={c.cardAlt} width={800} height={1000} loading="lazy" />
          </figure>
          <div>
            <h3>{c.realH}</h3>
            <p>{c.realP}</p>
            <figure className="shot phone">
              <img src="/landing/room-mobile.webp" alt={c.panelAlt} width={780} height={1300} loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      <section className="feature report-feature" id="report" aria-labelledby="report-title">
        <div className="feature-copy">
          <h2 id="report-title">{c.reportH}</h2>
          <p>{c.reportP}</p>
        </div>
        <figure className="shot tall">
          <img src="/landing/report.webp" alt={c.reportAlt} width={1180} height={1347} loading="lazy" />
        </figure>
      </section>

      <section className="privacy-field" aria-labelledby="privacy-title">
        <h2 id="privacy-title">{c.privacyH}</h2>
        <ul className="privacy-list">
          {c.privacy.map(([h, p]) => (
            <li key={h}>
              <span className="box" aria-hidden="true">
                <PenCheck />
              </span>
              <b>{h}</b>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="faq" id="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">{c.faqH}</h2>
        <div className="faq-list">
          {c.faq.map(([qq, a]) => (
            <details key={qq}>
              <summary>{qq}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="close" aria-labelledby="close-title">
        <h2 id="close-title">{c.closeH}</h2>
        <div className="hero-actions">
          <button className="primary big" onClick={() => onPick(ui)}>
            {c.start} <Icon name="arrowRight" />
          </button>
          <button className="link other-lang" onClick={() => onPick(other)} lang={other}>
            {c.startOther}
          </button>
        </div>
      </section>
    </main>
  );
}
