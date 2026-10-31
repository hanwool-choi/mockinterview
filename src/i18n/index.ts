import { createContext, useContext } from 'react';
import ko from './ko.json';
import en from './en.json';
import type { Lang } from '../../shared/schema';

export type Dict = typeof ko;
export type Key = keyof Dict;
const DICTS: Record<Lang, Dict> = { ko, en };

export function format(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  return format(DICTS[lang][key] ?? key, vars);
}

export const UiLangContext = createContext<Lang>('ko');
export function useT() {
  const lang = useContext(UiLangContext);
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
