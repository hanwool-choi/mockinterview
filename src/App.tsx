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

  const setSetup = (s: Setup) => {
    setSetupState(s);
    saveSetup(s);
  };
  const [uiTouched, setUiTouched] = useState(false);
  const setUiLang = (l: Lang) => {
    setUiTouched(true);
    setSetup({ ...setup, uiLang: l });
  };

  return (
    <UiLangContext.Provider value={setup.uiLang}>
      <div className={`app screen-${screen.name}`}>
        <nav className="topbar no-print">
          <button className="brand link" onClick={() => setScreen({ name: 'start' })}>
            <span className="logo" aria-hidden>
              ◉
            </span>
            {translate(setup.uiLang, 'app.title')}
          </button>
          {config.fake && <span className="badge demo">{translate(setup.uiLang, 'app.demo')}</span>}
          <select className="ui-lang-mini" aria-label="UI language" value={setup.uiLang} onChange={(e) => setUiLang(e.target.value as Lang)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </nav>
        {screen.name === 'start' && (
          <Start
            uiLang={setup.uiLang}
            onUiLang={setUiLang}
            onPick={(lang) => {
              setSetup({ ...setup, lang, uiLang: uiTouched ? setup.uiLang : lang });
              setScreen({ name: 'prepare' });
            }}
          />
        )}
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
          <a href="/privacy.html">{translate(setup.uiLang, 'footer.privacy')}</a>
          <a href="/terms.html">{translate(setup.uiLang, 'footer.terms')}</a>
        </footer>
      </div>
    </UiLangContext.Provider>
  );
}
