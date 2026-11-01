import { useState } from 'react';
import { Icon } from '../components/Icon';
import { extractText } from '../docs/extract';
import { isLikelyScanned } from '../docs/chunk';
import { maskPII } from '../docs/mask';
import { useT } from '../i18n';
import { SAMPLE } from '../samples/sample';
import type { Docs, Setup } from '../state/setup';

const MAX_FILE = 10 * 1024 * 1024;

function DocField({ label, value, onChange, setup, optional }: { label: string; value: string; onChange: (v: string) => void; setup: Setup; optional?: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');
  const [masked, setMasked] = useState(0);
  return (
    <div className="doc-field">
      <div className="doc-head">
        <label>
          {label}
          {!optional && <span className="req">*</span>}
        </label>
        <span className="muted">{value ? t('prep.chars', { n: value.length }) : ''}</span>
        <label className="upload ghost">
          {busy ? t('prep.reading') : t('prep.upload')}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > MAX_FILE) return setWarn(t('prep.tooBig'));
              setBusy(true);
              setWarn('');
              try {
                const raw = await extractText(f);
                if (isLikelyScanned(raw)) setWarn(t('prep.scanned'));
                const m = maskPII(raw, { lang: setup.lang, name: setup.name });
                setMasked(m.hits);
                onChange(m.text);
              } catch {
                setWarn(t('prep.scanned'));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      <textarea
        value={value}
        placeholder={t('prep.paste')}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const m = maskPII(value, { lang: setup.lang, name: setup.name });
          if (m.hits) {
            setMasked((x) => x + m.hits);
            onChange(m.text);
          }
        }}
      />
      {warn && <p className="warn">{warn}</p>}
      {masked > 0 && <p className="ok">{t('prep.masked', { n: masked })}</p>}
    </div>
  );
}

export function Prepare({ setup, onChange, onBack, onNext }: { setup: Setup; onChange: (s: Setup | ((prev: Setup) => Setup)) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const [agree, setAgree] = useState(false);
  const set = (p: Partial<Setup>) => onChange((prev) => ({ ...prev, ...p }));
  const setDoc = (k: keyof Docs) => (v: string) => onChange((prev) => ({ ...prev, docs: { ...prev.docs, [k]: v } }));
  const ready = setup.company.trim() && setup.docs.jd.trim() && setup.docs.resume.trim() && agree;
  return (
    <main className="prepare">
      <header className="screen-head">
        <button className="link" onClick={onBack}>
          <Icon name="arrowLeft" /> {t('common.back')}
        </button>
        <h1>{t('prep.title')}</h1>
        <button
          className="ghost"
          data-testid="fill-sample"
          onClick={() => {
            const s = SAMPLE[setup.lang];
            onChange((prev) => ({ ...prev, company: s.company, role: s.role, career: 'exp', years: s.years, docs: s.docs }));
          }}
        >
          {t('prep.sample')}
        </button>
      </header>
      <div className="grid-2">
        <label>
          {t('prep.company')}
          <span className="req">*</span>
          <input value={setup.company} maxLength={60} onChange={(e) => set({ company: e.target.value })} />
        </label>
        <label>
          {t('prep.role')}
          <input value={setup.role} maxLength={60} onChange={(e) => set({ role: e.target.value })} />
        </label>
        <fieldset className="seg">
          <legend>{t('prep.career')}</legend>
          {(['new', 'exp'] as const).map((c) => (
            <button key={c} className={setup.career === c ? 'on' : ''} onClick={() => set({ career: c })}>
              {t(c === 'new' ? 'prep.new' : 'prep.exp')}
            </button>
          ))}
          {setup.career === 'exp' && (
            <input className="years" type="number" min={0} max={40} value={setup.years ?? 0} aria-label={t('prep.years')} onChange={(e) => set({ years: Number(e.target.value) })} />
          )}
        </fieldset>
        <label>
          {t('prep.name')}
          <input value={setup.name} maxLength={30} onChange={(e) => set({ name: e.target.value })} />
        </label>
      </div>
      <DocField label={t('prep.jd')} value={setup.docs.jd} onChange={setDoc('jd')} setup={setup} />
      <DocField label={t('prep.resume')} value={setup.docs.resume} onChange={setDoc('resume')} setup={setup} />
      <DocField label={t('prep.portfolio')} value={setup.docs.portfolio} onChange={setDoc('portfolio')} setup={setup} optional />
      <section className="privacy">
        <h3>{t('prep.privacyTitle')}</h3>
        <ul>
          <li>{t('prep.privacy1')}</li>
          <li>{t('prep.privacy2')}</li>
          <li>{t('prep.privacy3')}</li>
        </ul>
        <label className="check">
          <input type="checkbox" data-testid="privacy-ok" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          {t('prep.privacyOk')}
        </label>
      </section>
      <footer className="screen-foot">
        {!ready && <span className="muted">{t('prep.need')}</span>}
        <button className="primary big" disabled={!ready} data-testid="to-panel" onClick={onNext}>
          {t('prep.next')} <Icon name="arrowRight" />
        </button>
      </footer>
    </main>
  );
}
