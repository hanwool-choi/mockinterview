import { useEffect, useState } from 'react';
import type { Lang, Report as R } from '../shared/schema';
import { api, type AppConfig } from './api/client';
import type { InterviewState } from './engine/machine';
import { UiLangContext, translate } from './i18n';
import { Panel } from './screens/Panel';
import { Prepare } from './screens/Prepare';
import { Report } from './screens/Report';
import { Room } from './screens/Room';
import { Start } from './screens/Start';
import { Icon } from './components/Icon';
import { DonateContext } from './components/Support';
import { COPY } from './landing/copy';
import { clearRun } from './state/useInterview';
import { emptySetup, loadSetup, saveSetup, type Setup } from './state/setup';

type Screen = { name: 'start' } | { name: 'prepare' } | { name: 'panel' } | { name: 'room'; sid: string } | { name: 'report'; report: R; state: InterviewState };

const NAV_KEY = 'iv:nav';
const fast = new URLSearchParams(location.search).has('fast');

export function App() {
  const [setup, setSetupState] = useState<Setup>(() => loadSetup() ?? emptySetup((navigator.language ?? 'ko').startsWith('ko') ? 'ko' : 'en'));
  const [screen, setScreen] = useState<Screen>(() => {
    try {
      const n = JSON.parse(sessionStorage.getItem(NAV_KEY) ?? 'null') as Screen | null;
      return n && n.name !== 'report' ? n : { name: 'start' };
    } catch {
      return { name: 'start' };
    }
  });
  const [config, setConfig] = useState<AppConfig>({ turnstileSiteKey: '', fake: false });

  useEffect(() => {
    void api.config().then(setConfig);
  }, []);
  useEffect(() => {
    if (screen.name !== 'report') sessionStorage.setItem(NAV_KEY, JSON.stringify(screen));
    window.scrollTo({ top: 0 });
  }, [screen]);
  useEffect(() => {
    document.documentElement.lang = setup.uiLang;
    document.title = translate(setup.uiLang, 'app.title');
  }, [setup.uiLang]);

  // Functional updates apply on top of the latest state, so async callbacks (file extraction) never overwrite each other.
  const setSetup = (next: Setup | ((prev: Setup) => Setup)) => {
    setSetupState((prev) => {
      const s = typeof next === 'function' ? next(prev) : next;
      saveSetup(s);
      return s;
    });
  };
  const [uiTouched, setUiTouched] = useState(false);
  const setUiLang = (l: Lang) => {
    setUiTouched(true);
    setSetup({ ...setup, uiLang: l });
  };

  const startWith = (lang: Lang) => {
    setSetup({ ...setup, lang, uiLang: uiTouched ? setup.uiLang : lang });
    setScreen({ name: 'prepare' });
  };

  return (
    <UiLangContext.Provider value={setup.uiLang}>
      <DonateContext.Provider value={config.donateUrl ?? ''}>
      <div className={`app screen-${screen.name}`}>
        <header className="topbar no-print">
          <button className="brand" onClick={() => setScreen({ name: 'start' })}>
            <Logo />
            {translate(setup.uiLang, 'app.title')}
          </button>
          {screen.name === 'start' && (
            <nav className="top-links" aria-label={translate(setup.uiLang, 'app.title')}>
              <a href="#route">{COPY[setup.uiLang].nav.route}</a>
              <a href="#panel">{COPY[setup.uiLang].nav.panel}</a>
              <a href="#report">{COPY[setup.uiLang].nav.report}</a>
              <a href="#faq">{COPY[setup.uiLang].nav.faq}</a>
            </nav>
          )}
          <div className="top-right">
            {config.fake && <span className="demo-note">{translate(setup.uiLang, 'app.demo')}</span>}
            <select className="ui-lang-mini" aria-label="Language / 언어" value={setup.uiLang} onChange={(e) => setUiLang(e.target.value as Lang)}>
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
            {screen.name === 'start' && (
              <button className="primary top-cta" onClick={() => startWith(setup.uiLang)}>
                {COPY[setup.uiLang].startShort} <Icon name="arrowRight" />
              </button>
            )}
          </div>
        </header>
        {screen.name === 'start' && <Start onPick={startWith} />}
        {screen.name === 'prepare' && <Prepare setup={setup} onChange={setSetup} onBack={() => setScreen({ name: 'start' })} onNext={() => setScreen({ name: 'panel' })} />}
        {screen.name === 'panel' && (
          <Panel
            setup={setup}
            onChange={setSetup}
            siteKey={config.turnstileSiteKey}
            onBack={() => setScreen({ name: 'prepare' })}
            onStart={(sid) => {
              clearRun();
              setScreen({ name: 'room', sid });
            }}
          />
        )}
        {screen.name === 'room' && <Room key={screen.sid} setup={setup} sid={screen.sid} fast={fast} onDone={(report, state) => setScreen({ name: 'report', report, state })} />}
        {screen.name === 'report' && (
          <Report
            setup={setup}
            report={screen.report}
            state={screen.state}
            onAgain={() => {
              clearRun();
              setScreen({ name: 'panel' });
            }}
          />
        )}
        <footer className="site-foot no-print">
          {screen.name === 'start' && <p className="foot-mark" aria-hidden="true">{translate(setup.uiLang, 'app.title')}</p>}
          <div className="foot-row">
            <span>{translate(setup.uiLang, 'app.tagline')}</span>
            <a href="/privacy.html">{translate(setup.uiLang, 'footer.privacy')}</a>
            <a href="/terms.html">{translate(setup.uiLang, 'footer.terms')}</a>
          </div>
        </footer>
      </div>
      </DonateContext.Provider>
    </UiLangContext.Provider>
  );
}

/** Wordmark symbol: a printed score box with a red-pen check. */
function Logo() {
  return (
    <svg className="logo" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="17" height="17" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M6 12.5 L10.5 17 L22 3" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
