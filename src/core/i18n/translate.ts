import type { Lang } from "./context"
import { en } from "./translations/en"
import { ru } from "./translations/ru"

const DICT: Record<Lang, Record<string, string>> = { en, ru }

export const LANG_STORAGE_KEY = "disapoly.lang"

export function detectLang(): Lang {
  const stored = localStorage.getItem(LANG_STORAGE_KEY)
  if (stored === "en" || stored === "ru") return stored
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en"
}

export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}
