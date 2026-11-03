import { useContext, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../shared/schema';
import { Portrait2D } from '../avatar/Portrait2D';
import { lookFor } from '../avatar/look';
import { Icon } from '../components/Icon';
import { CheckIcon, RubricGrid } from '../components/Sheet';
import { Interviewer } from '../avatar/Interviewer';
import { SupportNote, SupportPip } from '../components/Support';
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

  // Section parts rise in once as they enter; content is visible by default without script.
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.landing .pain-list > li, .landing .story-note, .landing .feature > *, .landing .modes-grid > *, .landing .privacy-field > h2, .landing .privacy-list > li, .landing .faq > *, .landing .close > *')];
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
          <p className="pill-badge">
            <Icon name="sparkle" size={16} /> {c.badge}
          </p>
          <h1 id="hero-title">
            {c.h1.split('\n').map((l, i, all) => {
              if (i < all.length - 1) return <span key={i} className="line">{l}</span>;
              // Underline only the last phrase, as in the mockup.
              const cut = l.lastIndexOf(' ');
              return (
                <span key={i} className="line">
                  {cut > 0 ? l.slice(0, cut + 1) : ''}
                  <span className="hl">{cut > 0 ? l.slice(cut + 1) : l}</span>
                </span>
              );
            })}
          </h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <button className="primary big" data-testid={`lang-${ui}`} onClick={() => onPick(ui)}>
              {c.startShort} <Icon name="arrowRight" />
            </button>
            <a className="secondary big" href="#report">
              <Icon name="doc" /> {c.sampleReport}
            </a>
          </div>
          <p className="free-note">
            {c.free}
            <button className="link other-lang" data-testid={`lang-${other}`} onClick={() => onPick(other)} lang={other}>
              {c.startOther}
            </button>
          </p>
        </div>

        <figure className="hero-mock" aria-label={c.sheetNote}>
          <div className="mock-window">
            <div className="mock-bar" aria-hidden="true">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="mock-head">
              <span className="mock-brand">
                <MiniLogo /> {ui === 'ko' ? '모두의면접관' : 'Modu Interviewer'}
              </span>
              <span className="mock-steps" aria-hidden="true">
                <i className="on" />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="mock-pills">
                <span className="pill">
                  <Icon name="clock" size={14} /> 00:24:36
                </span>
                <span className="pill">{c.live}</span>
              </span>
            </div>
            <div className="mock-stage">
              <div className="panel-row">
                {plan.interviewers.slice(0, 3).map((p, i) => (
                  <figure key={p.id} className="seat">
                    <Interviewer look={lookFor(PANEL[i])} state={i === 1 ? 'smile' : 'neutral'} speaking={i === 1 && !reduceMotion} live={!reduceMotion} seed={PANEL[i].seed} title={p.displayName} />
                    <figcaption className="nameplate">
                      <b>{p.displayName}</b>
                      <span>{PANEL[i].rank === 'exec' || PANEL[i].role === 'other' ? translate(ui, `rank.${PANEL[i].rank}` as Key) : translate(ui, `role.${PANEL[i].role}` as Key)}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="desk" aria-hidden="true" />
            </div>
            <div className="mock-caption">
              <span className="wave">
                <Icon name="wave" size={18} />
              </span>
              <span>
                <b>
                  {plan.interviewers[1]?.displayName} {c.asking}
                </b>
                {c.mockQuestion}
              </span>
            </div>
          </div>
          <aside className="mock-sheet">
            <header>
              <b>
                <Icon name="doc" /> {t('sheet.title')}
              </b>
              <span className="total-pill">
                {t('sheet.total')} <b>{SAMPLE_SHEET.score}</b>/100
              </span>
            </header>
            <RubricGrid rubric={SAMPLE_SHEET.rubric} lang={ui} compact />
            <div className="opinion">
              <b>
                <Icon name="sparkle" size={15} /> {t('sheet.opinion')}
              </b>
              <p>{SAMPLE_SHEET.opinion[ui]}</p>
            </div>
          </aside>
          <figcaption className="visually-hidden">{c.sheetNote}</figcaption>
        </figure>
      </section>

      <ul className="feature-strip">
        {c.features.map(([icon, h, p]) => (
          <li key={h}>
            <span className="icon-tile">
              <Icon name={icon as 'doc'} size={22} />
            </span>
            <span>
              <b>{h}</b>
              <small>{p}</small>
            </span>
          </li>
        ))}
      </ul>

      <section className="pains" aria-labelledby="pain-title">
        <h2 id="pain-title">{c.painH}</h2>
        <ol className="pain-list">
          {c.pains.map(([h, p, fix]) => (
            <li key={h}>
              <b className="pain-h">{h}</b>
              <p>{p}</p>
              <p className="pain-fix">
                <Icon name="arrowRight" size={16} /> {fix}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="story" aria-labelledby="story-title">
        <h2 id="story-title">{c.storyH}</h2>
        <div className="story-note">
          {c.story.map((para) => (
            <p key={para.slice(0, 12)}>{para}</p>
          ))}
          <p className="story-sign">— {c.storySign}</p>
        </div>
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
                  <span className="q-tick">{sel === i && <CheckIcon />}</span>
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
          <img src="/landing/room.webp" alt={c.heroVideoAlt} width={1440} height={1100} loading="lazy" />
          <figcaption>{c.heroVideoCap}</figcaption>
        </figure>
        <div className="feature-copy">
          <h2 id="panel-title">{c.panelH}</h2>
          <p>{c.panelP}</p>
          <ul className="ticks">
            {c.panelList.map((x) => (
              <li key={x}>
                <CheckIcon />
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
          <img src="/landing/report.webp" alt={c.reportAlt} width={1180} height={1476} loading="lazy" />
        </figure>
      </section>

      <section className="privacy-field" aria-labelledby="privacy-title">
        <h2 id="privacy-title">{c.privacyH}</h2>
        <ul className="privacy-list">
          {c.privacy.map(([h, p]) => (
            <li key={h}>
              <span className="box" aria-hidden="true">
                <CheckIcon />
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

      <SupportPip where="start" show delayMs={12000} />
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
        <SupportNote where="start" />
      </section>
    </main>
  );
}

function MiniLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="17" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M6 12.5 L10.5 17 L22 3" fill="none" stroke="#6b46c1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
