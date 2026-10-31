import type { Lang } from '../../shared/schema';
import { useT } from '../i18n';

export function Start({ uiLang, onUiLang, onPick }: { uiLang: Lang; onUiLang: (l: Lang) => void; onPick: (l: Lang) => void }) {
  const t = useT();
  return (
    <main className="start">
      <section className="hero">
        <p className="eyebrow">{t('app.title')}</p>
        <h1>{t('start.headline')}</h1>
        <p className="lead">{t('start.sub')}</p>
        <h2 className="pick-title">{t('start.lang')}</h2>
        <div className="lang-pick">
          <button className="lang-card" data-testid="lang-ko" onClick={() => onPick('ko')}>
            <span className="flag">가</span>
            <b>{t('start.ko')}</b>
          </button>
          <button className="lang-card" data-testid="lang-en" onClick={() => onPick('en')}>
            <span className="flag">A</span>
            <b>{t('start.en')}</b>
          </button>
        </div>
        <label className="ui-lang">
          {t('start.uiLang')}
          <select value={uiLang} onChange={(e) => onUiLang(e.target.value as Lang)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>
      <section className="features">
        {(['1', '2', '3'] as const).map((n) => (
          <article key={n}>
            <h3>{t(`start.f${n}`)}</h3>
            <p>{t(`start.f${n}d`)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
