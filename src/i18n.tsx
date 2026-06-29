/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Lang = "en" | "ru"

/** Translation dictionaries. `{param}` placeholders are filled by `t(key, params)`. */
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "home.tagline": "Create a room and share the link with friends — no sign-up.",
    "home.createRoom": "Create online room",
    "home.roomCode": "Room code",
    "home.join": "Join",
    "home.hotseat": "Play hot-seat (one device)",

    "nickname.title": "Join game",
    "nickname.desc": "Pick a nickname to enter the room.",
    "nickname.label": "Nickname",
    "nickname.placeholder": "Your name",
    "nickname.enter": "Enter",
    "common.back": "Back",

    "setup.desc": "Local hot-seat. Add 2–{max} players and start.",
    "setup.players": "{n} players",
    "setup.start": "Start game",
    "setup.playerN": "Player {n}",
    "setup.addPlayer": "Add player",
    "setup.removePlayer": "Remove player",

    "lobby.title": "Lobby",
    "lobby.share": "Share the link to invite friends.",
    "lobby.connecting": "Connecting…",
    "lobby.players": "Players ({n})",
    "lobby.host": "host",
    "lobby.you": "(you)",
    "lobby.startNeed2": "(need 2+)",
    "lobby.waitHost": "Waiting for the host to start…",
    "lobby.leave": "Leave",
    "lobby.copyLink": "Copy link",

    "turn.turnOf": "{name}’s turn",
    "turn.waitingFor": "Waiting for {name} to play…",
    "turn.roll": "Roll dice",
    "turn.buyPrompt": "Buy {name} for ${price}?",
    "turn.buy": "Buy ${price}",
    "turn.decline": "Decline",
    "turn.end": "End turn",
    "turn.wins": "🏆 {name} wins!",
    "turn.gameOver": "Game over.",
    "turn.newGame": "New game",
    "turn.waitHostNew": "Waiting for the host to start a new game…",

    "jail.title": "In jail — escape attempt {n}/3",
    "jail.pay": "Pay ${fine}",
    "jail.useCard": "Use card",
    "jail.roll": "Roll for doubles",

    "card.chance": "Chance",
    "card.chest": "Community Chest",

    "manage.title": "Your properties",
    "manage.empty": "You don’t own any properties yet.",
    "manage.mortgaged": "(mortgaged)",
    "manage.build": "Build (${cost})",
    "manage.sell": "Sell a building",
    "manage.unmortgage": "Unmortgage",
    "manage.liftMortgage": "Lift mortgage (${cost})",
    "manage.mortgage": "Mortgage",

    "net.connected": "Connected",
    "net.reconnecting": "Reconnecting…",
    "net.connectingRoom": "Connecting to room…",

    "settings.title": "Settings",
    "settings.boardTheme": "Board theme",
    "settings.language": "Language",
    "theme.classic.name": "Classic",
    "theme.classic.desc": "Colorful board, light and friendly.",
    "theme.mono.name": "Minimal",
    "theme.mono.desc": "Black & white, adapts to light/dark mode.",
    "theme.neon.name": "Neon",
    "theme.neon.desc": "Dark board with glowing colors.",
  },
  ru: {
    "home.tagline": "Создай комнату и поделись ссылкой с друзьями — без регистрации.",
    "home.createRoom": "Создать онлайн-комнату",
    "home.roomCode": "Код комнаты",
    "home.join": "Войти",
    "home.hotseat": "Игра на одном устройстве",

    "nickname.title": "Вход в игру",
    "nickname.desc": "Выбери ник, чтобы войти в комнату.",
    "nickname.label": "Ник",
    "nickname.placeholder": "Твоё имя",
    "nickname.enter": "Войти",
    "common.back": "Назад",

    "setup.desc": "Игра на одном устройстве. Добавь 2–{max} игрока и начни.",
    "setup.players": "Игроков: {n}",
    "setup.start": "Начать игру",
    "setup.playerN": "Игрок {n}",
    "setup.addPlayer": "Добавить игрока",
    "setup.removePlayer": "Убрать игрока",

    "lobby.title": "Лобби",
    "lobby.share": "Поделись ссылкой, чтобы позвать друзей.",
    "lobby.connecting": "Подключение…",
    "lobby.players": "Игроки ({n})",
    "lobby.host": "хост",
    "lobby.you": "(ты)",
    "lobby.startNeed2": "(нужно 2+)",
    "lobby.waitHost": "Ждём, пока хост начнёт…",
    "lobby.leave": "Выйти",
    "lobby.copyLink": "Копировать ссылку",

    "turn.turnOf": "Ход {name}",
    "turn.waitingFor": "Ждём ход {name}…",
    "turn.roll": "Бросить кубики",
    "turn.buyPrompt": "Купить {name} за ${price}?",
    "turn.buy": "Купить ${price}",
    "turn.decline": "Отказаться",
    "turn.end": "Завершить ход",
    "turn.wins": "🏆 {name} побеждает!",
    "turn.gameOver": "Игра окончена.",
    "turn.newGame": "Новая игра",
    "turn.waitHostNew": "Ждём, пока хост начнёт новую игру…",

    "jail.title": "В тюрьме — попытка {n}/3",
    "jail.pay": "Заплатить ${fine}",
    "jail.useCard": "Карта",
    "jail.roll": "Бросок на дубль",

    "card.chance": "Шанс",
    "card.chest": "Общественная казна",

    "manage.title": "Твоё имущество",
    "manage.empty": "У тебя пока нет участков.",
    "manage.mortgaged": "(заложено)",
    "manage.build": "Построить (${cost})",
    "manage.sell": "Продать постройку",
    "manage.unmortgage": "Выкупить",
    "manage.liftMortgage": "Выкупить залог (${cost})",
    "manage.mortgage": "Заложить",

    "net.connected": "На связи",
    "net.reconnecting": "Переподключение…",
    "net.connectingRoom": "Подключение к комнате…",

    "settings.title": "Настройки",
    "settings.boardTheme": "Тема доски",
    "settings.language": "Язык",
    "theme.classic.name": "Classic",
    "theme.classic.desc": "Цветная доска, светлая и дружелюбная.",
    "theme.mono.name": "Minimal",
    "theme.mono.desc": "Чёрно-белая, подстраивается под тему.",
    "theme.neon.name": "Neon",
    "theme.neon.desc": "Тёмная доска со свечением.",
  },
}

const STORAGE_KEY = "disapoly.lang"

function detectLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "en" || stored === "ru") return stored
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en"
}

export type TFunction = (
  key: string,
  params?: Record<string, string | number>
) => string

type I18nState = { lang: Lang; setLang: (lang: Lang) => void; t: TFunction }

const I18nContext = createContext<I18nState | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback<TFunction>(
    (key, params) => {
      let s = DICT[lang][key] ?? DICT.en[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replaceAll(`{${k}}`, String(v))
        }
      }
      return s
    },
    [lang]
  )

  const value = useMemo<I18nState>(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider")
  return ctx
}

/** Convenience hook when you only need the translate function. */
export function useT(): TFunction {
  return useI18n().t
}
