import { type ReactNode, useCallback, useMemo, useState } from "react"

import {
  I18nContext,
  type I18nState,
  type Lang,
  type TFunction,
} from "./context"
import { detectLang, LANG_STORAGE_KEY, translate } from "./translate"

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(LANG_STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback<TFunction>(
    (key, params) => translate(lang, key, params),
    [lang]
  )

  const value = useMemo<I18nState>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
