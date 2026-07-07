import { createContext } from "react"

export type Lang = "en" | "ru"

export type TFunction = (
  key: string,
  params?: Record<string, string | number>
) => string

export type I18nState = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFunction
}

export const I18nContext = createContext<I18nState | undefined>(undefined)
