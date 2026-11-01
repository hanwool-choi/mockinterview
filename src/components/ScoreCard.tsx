import { Icon } from './Icon';
import { GuideView } from './Guide';
import type { Lang, Question, Score } from '../../shared/schema';
import { useT, type Key } from '../i18n';

const RUBRIC: (keyof Score['rubric'])[] = ['structure', 'specificity', 'jobFit', 'consistency', 'delivery'];

export function rubricLabel(k: keyof Score['rubric'], lang: Lang): Key {
  return k === 'delivery' && lang === 'en' ? 'rubric.deliveryEn' : (`rubric.${k}` as Key);
}

export function ScoreCard({ score, question, lang, onNext, onRetry, canRetry }: { score: Score; question?: Question; lang: Lang; onNext?: () => void; onRetry?: () => void; canRetry?: boolean }) {
  const t = useT();
  return (
    <section className="score-card" data-testid="score-card">
      <header>
        <div className={`grade grade-${score.grade}`}>{score.grade}</div>
        <div>
          <div className="score-num">
            {score.score}
            <small>/100</small>
          </div>
          {score.local && (
            <span className="badge" title={t('card.localD')}>
              {t('card.local')}
            </span>
          )}
        </div>
      </header>
      <ul className="rubric">
        {RUBRIC.map((k) => (
          <li key={k}>
            <span>{t(rubricLabel(k, lang))}</span>
            <span className="track" title={`${score.rubric[k]} / 20`}>
              <span className="bar" style={{ width: `${(score.rubric[k] / 20) * 100}%` }} />
            </span>
            <b>{score.rubric[k]}</b>
          </li>
        ))}
      </ul>
      {score.guide && <GuideView guide={score.guide} />}
      {!!score.strengths.length && (
        <div className="fb good">
          <h4>{t('card.strengths')}</h4>
          <ul>{score.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
      {!score.guide?.fixes.length && !!score.improvements.length && (
        <div className="fb fix">
          <h4>{t('card.improve')}</h4>
          <ul>{score.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
      {!!score.flaggedPhrases.length && (
        <p className="flagged">
          {t('card.flagged')}: {score.flaggedPhrases.map((f) => <mark key={f}>{f}</mark>)}
        </p>
      )}
      {score.betterAnswer && (
        <details open>
          <summary><Icon name="chevron" size={16} />{t('card.better')}</summary>
          <p className="better">{score.betterAnswer}</p>
        </details>
      )}
      {!!score.languageNotes?.length && (
        <details>
          <summary><Icon name="chevron" size={16} />{t('card.lang')}</summary>
          <ul className="lang-notes">
            {score.languageNotes.map((n, i) => (
              <li key={i}>
                <s>{n.original}</s> → <b>{n.better}</b>
              </li>
            ))}
          </ul>
        </details>
      )}
      {question?.answerOutline && (
        <details>
          <summary><Icon name="chevron" size={16} />{t('card.outline')}</summary>
          <p>{question.answerOutline}</p>
        </details>
      )}
      {(onNext || onRetry) && (
        <footer>
          {onRetry && canRetry && (
            <button className="ghost" onClick={onRetry} data-testid="feedback-retry">
              {t('card.retry')}
            </button>
          )}
          {onNext && (
            <button className="primary" onClick={onNext} data-testid="feedback-next">
              {t('card.next')}
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
