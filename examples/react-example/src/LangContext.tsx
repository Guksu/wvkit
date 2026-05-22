import { createContext, useContext, type ReactNode } from 'react';
import { t, type Lang, type Translations } from './i18n';

interface LangContextValue {
  lang: Lang;
  tr: Translations;
}

const LangContext = createContext<LangContextValue>({ lang: 'en', tr: t.en });

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <LangContext.Provider value={{ lang, tr: t[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
