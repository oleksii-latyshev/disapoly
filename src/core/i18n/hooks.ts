import { useContext } from "react"

import { I18nContext, type I18nState, type TFunction } from "./context"

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider")
  return ctx
}

export function useT(): TFunction {
  return useI18n().t
}
