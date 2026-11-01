import { useState } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../api/client';
import { extractText, pdfPagesToJpeg } from '../docs/extract';
import { imageFileToJpeg } from '../docs/image';
import { readFiles } from '../docs/readFiles';
import { maskPII } from '../docs/mask';
import { useT } from '../i18n';
import { SAMPLE } from '../samples/sample';
import type { Docs, Setup } from '../state/setup';

const MAX_FILE = 10 * 1024 * 1024;
const MAX_FILES = 8;
type Kind = keyof Docs;

function DocField({ kind, label, value, onChange, setup, optional }: { kind: Kind; label: string; value: string; onChange: (v: string | ((prev: string) => string)) => void; setup: Setup; optional?: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [warn, setWarn] = useState('');
  const [note, setNote] = useState('');
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
          {busy ?? t('prep.upload')}
          <input
            type="file"
            data-testid={`upload-${kind}`}
            multiple
            accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            hidden
            disabled={busy !== null}
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (!files.length) return;
              if (files.length > MAX_FILES) return setWarn(t('prep.tooMany', { n: MAX_FILES }));
              if (files.some((f) => f.size > MAX_FILE)) return setWarn(t('prep.tooBig'));
              setBusy(t('prep.reading'));
              setWarn('');
              setNote('');
              try {
                const r = await readFiles(
                  files,
                  { extractText, pdfPagesToJpeg, imageFileToJpeg, ocr: (img) => api.ocr(img, kind, setup.lang) },
                  (i, n) => setBusy(t('prep.ocrProgress', { i: Math.min(i + 1, n), n })),
                );
                if (r.quota) setWarn(t('prep.ocrQuota', { n: r.failed }));
                else if (r.failed) setWarn(t('prep.ocrFail', { n: r.failed }));
                else if (!r.text.trim()) setWarn(t('prep.scanned'));
                if (r.images > r.failed) setNote(t('prep.ocrDone', { n: r.images - r.failed }));
                if (r.text.trim()) {
                  const m = maskPII(r.text, { lang: setup.lang, name: setup.name });
                  setMasked((x) => x + m.hits);
                  // Several uploads into one field are joined in the order they arrive.
                  onChange((prev) => (prev.trim() ? `${prev.trim()}\n\n${m.text}` : m.text));
                }
              } catch {
                setWarn(t('prep.scanned'));
              } finally {
                setBusy(null);
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
      {note && <p className="ok" data-testid={`ocr-note-${kind}`}>{note}</p>}
      {masked > 0 && <p className="ok">{t('prep.masked', { n: masked })}</p>}
    </div>
  );
}

export function Prepare({ setup, onChange, onBack, onNext }: { setup: Setup; onChange: (s: Setup | ((prev: Setup) => Setup)) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const [agree, setAgree] = useState(false);
  const set = (p: Partial<Setup>) => onChange((prev) => ({ ...prev, ...p }));
  const setDoc = (k: keyof Docs) => (v: string | ((prev: string) => string)) => onChange((prev) => ({ ...prev, docs: { ...prev.docs, [k]: typeof v === 'function' ? v(prev.docs[k]) : v } }));
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
      <p className="muted files-hint">{t('prep.filesHint')}</p>
      <DocField kind="jd" label={t('prep.jd')} value={setup.docs.jd} onChange={setDoc('jd')} setup={setup} />
      <DocField kind="resume" label={t('prep.resume')} value={setup.docs.resume} onChange={setDoc('resume')} setup={setup} />
      <DocField kind="portfolio" label={t('prep.portfolio')} value={setup.docs.portfolio} onChange={setDoc('portfolio')} setup={setup} optional />
      <section className="privacy">
        <h3>{t('prep.privacyTitle')}</h3>
        <ul>
          <li>{t('prep.privacy1')}</li>
          <li>{t('prep.privacy2')}</li>
          <li>{t('prep.privacy3')}</li>
          <li>{t('prep.privacy4')}</li>
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
