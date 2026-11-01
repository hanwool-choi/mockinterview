import { useContext, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../shared/schema';
import { Portrait2D } from '../avatar/Portrait2D';
import { faceTarget } from '../avatar/expression';
import { lookFor } from '../avatar/look';
import { Icon } from '../components/Icon';
import { LineMap, type Station } from '../components/LineMap';
import { chunkDoc } from '../docs/chunk';
import { buildTemplatePlan } from '../engine/templates';
import { translate, UiLangContext, type Key } from '../i18n';
import { COPY, STATION_LABELS } from '../landing/copy';
import { SAMPLE } from '../samples/sample';
import { defaultInterviewers } from '../state/setup';

const PANEL = (() => {
  const [lead, hr, dev] = defaultInterviewers();
  return [lead, hr, { ...dev, personality: 'pressure' as const }];
})();

function useSampleRoute(lang: Lang) {
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
  const { plan, chunks } = useSampleRoute(ui);
  const [sel, setSel] = useState('s3');
  const other: Lang = ui === 'ko' ? 'en' : 'ko';
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Section parts rise in once as they enter; content is visible by default without script.
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.landing .feature > *, .landing .modes-grid > *, .landing .privacy-field > h2, .landing .privacy-line > li, .landing .faq > *, .landing .close > *')];
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

  const stations: Station[] = STATION_LABELS[ui].map((l, i) => ({
    id: `s${i}`,
    ...l,
    transfer: i >= 3 && i <= 5,
  }));
  const idx = Number(sel.slice(1));
  const q = idx > 0 ? plan.questions[idx - 1] : undefined;
  const askerId = q?.askedBy ?? (PANEL.find((p) => p.role === 'hr') ?? PANEL[0]).id;
  const asker = PANEL.find((p) => p.id === askerId)!;
  const askerName = plan.interviewers.find((p) => p.id === askerId)?.displayName ?? '';
  const askerTitle = `${translate(ui, `role.${asker.role}` as Key)} · ${translate(ui, `rank.${asker.rank}` as Key)}`;
  const evidence = q?.evidenceIds.map((id) => chunks.find((ch) => ch.id === id)).filter(Boolean)[0];
  const quote = q?.text.match(/"([^"]+)"/)?.[1];

  return (
    <main className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">{c.h1}</h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <button className="btn primary big" data-testid={`lang-${ui}`} onClick={() => onPick(ui)}>
              {c.start} <Icon name="arrowRight" />
            </button>
            <button className="link other-lang" data-testid={`lang-${other}`} onClick={() => onPick(other)} lang={other}>
              {c.startOther}
            </button>
          </div>
          <p className="free-note">{c.free}</p>
        </div>
        <figure className="shot hero-media">
          <video src="/landing/room-loop.mp4" poster="/landing/room-loop-poster.webp" width={928} height={540} muted loop playsInline autoPlay={!reduceMotion} aria-label={c.heroVideoAlt} />
          <figcaption>{c.heroVideoCap}</figcaption>
        </figure>

        <div className="route" id="route">
          <h2 className="visually-hidden">{c.routeLabel}</h2>
          <LineMap stations={stations} selected={sel} onSelect={setSel} ariaLabel={c.routeLabel} />
          <p className="route-hint">{c.routeHint}</p>
          <article className="board" aria-live="polite">
            <div className="board-q">
              <blockquote className="board-question">{q ? q.text : plan.smallTalk.opening[0]}</blockquote>
              <p className="board-by">
                <Portrait2D look={lookFor(asker)} face={faceTarget('neutral', lookFor(asker).browBase)} size={44} />
                <span>
                  <b>{askerName}</b> · {askerTitle} · {stations[idx].label}
                </span>
              </p>
              <p className="intent">{q ? q.intent : c.unscored}</p>
              {q?.followUpSeeds[0] && stations[idx].transfer && (
                <p className="transfer-line">
                  <span className="dot transfer" aria-hidden="true" />
                  <span>
                    {q.followUpSeeds[0]} <em>{c.transfer}</em>
                  </span>
                </p>
              )}
            </div>
            {evidence && (
              <figure className="board-source">
                <Passage text={evidence.text} quote={quote} />
                <figcaption>{c.source}</figcaption>
              </figure>
            )}
          </article>
          <p className="board-sample">{c.sample}</p>
        </div>
      </section>

      <div className="spine">
        <section className="feature panel-feature on-spine" id="panel" aria-labelledby="panel-title">
          <figure className="shot wide">
            <img src="/landing/room.webp" alt={c.panelAlt} width={1440} height={828} loading="lazy" />
          </figure>
          <div className="feature-copy">
            <h2 id="panel-title">{c.panelH}</h2>
            <p>{c.panelP}</p>
            <ul className="ticks">
              {c.panelList.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        </section>

        <section className="feature modes on-spine" aria-labelledby="modes-title">
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

        <section className="feature report-feature on-spine terminus-stop" id="report" aria-labelledby="report-title">
          <div className="feature-copy">
            <h2 id="report-title">{c.reportH}</h2>
            <p>{c.reportP}</p>
          </div>
          <figure className="shot tall">
            <img src="/landing/report.webp" alt={c.reportAlt} width={1180} height={1150} loading="lazy" />
          </figure>
        </section>
      </div>

      <section className="privacy-field" aria-labelledby="privacy-title">
        <h2 id="privacy-title">{c.privacyH}</h2>
        <ol className="privacy-line">
          {c.privacy.map(([h, p]) => (
            <li key={h}>
              <span className="dot" aria-hidden="true" />
              <b>{h}</b>
              <span>{p}</span>
            </li>
          ))}
        </ol>
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
          <button className="btn primary big" onClick={() => onPick(ui)}>
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
