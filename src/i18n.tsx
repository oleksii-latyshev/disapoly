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
    "home.tagline":
      "Create a room and share the link with friends — no sign-up.",
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
    "buy.rentLabel": "Rent",
    "buy.withSet": "${rent} with full set",
    "buy.completesSet": "Completes the color set!",
    "buy.setProgress": "{owned}/{total} in this color",
    "buy.railroads": "{owned}/{total} railroads → rent",
    "buy.utilities": "{owned}/{total} utilities → rent",
    "buy.timesDice": "{mult}× dice",

    "auction.title": "Auction",
    "auction.tileUp": "{tile} is up for auction",
    "auction.highBid": "High bid ${amount}",
    "auction.highBy": "by {name}",
    "auction.noBids": "No bids yet",
    "auction.yourTurn": "Your turn to bid",
    "auction.turnOf": "{name} to bid",
    "auction.bid": "Bid ${amount}",
    "auction.pass": "Pass",
    "auction.waiting": "Waiting for {name} to bid…",
    "auction.passed": "passed",
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

    "details.owner": "Owner",
    "details.price": "Price",
    "details.baseRent": "Base rent",
    "details.withSet": "With color set",
    "details.house": "With {n} house(s)",
    "details.hotel": "With hotel",
    "details.houseCost": "House cost",
    "details.mortgage": "Mortgage value",
    "details.owned": "{n} owned",
    "details.timesDice": "{x}× dice roll",
    "details.tax": "Tax",

    "manage.title": "Your properties",
    "manage.supplyTitle": "Houses / hotels left in the bank",
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
    "net.playerOffline": "{name} is offline",
    "net.skip": "Skip their turn",
    "net.autoSkipIn": "Auto-skip in {n}s",
    "net.slowConnection": "{name} has a slow connection ({ms}ms) — hang tight…",
    "notify.yourTurn": "Your turn!",
    "notify.tradeOffer": "Trade offer!",

    "settings.title": "Settings",
    "settings.boardTheme": "Board theme",
    "settings.language": "Language",
    "theme.classic.name": "Classic",
    "theme.classic.desc": "Colorful board, light and friendly.",
    "theme.mono.name": "Minimal",
    "theme.mono.desc": "Black & white, adapts to light/dark mode.",
    "theme.neon.name": "Neon",
    "theme.neon.desc": "Dark board with glowing colors.",

    "trade.open": "Propose a trade",
    "trade.title": "Propose a trade",
    "trade.partner": "Partner",
    "trade.youGive": "You give",
    "trade.youReceive": "You receive",
    "trade.money": "Money",
    "trade.cards": "Jail cards",
    "trade.send": "Send offer",
    "trade.cancel": "Withdraw offer",
    "trade.accept": "Accept",
    "trade.decline": "Decline",
    "trade.waiting": "Waiting for {name}…",
    "trade.pendingTitle": "Trade offer",
    "trade.gives": "{name} gives",
    "trade.nothing": "nothing",

    "settings.sound": "Sound",
    "common.on": "On",
    "common.off": "Off",

    "stats.open": "Stats",
    "stats.title": "Net worth over time",
    "results.standings": "Final standings",
    "results.bankrupt": "bankrupt",

    "howto.title": "How to play",
    "howto.goal.title": "Goal",
    "howto.goal.body":
      "Be the last player standing — bankrupt everyone else through rent and smart deals. You start with ${start}.",
    "howto.turn.title": "Your turn",
    "howto.turn.body":
      "Roll and move. Doubles let you roll again, but three in a row send you to jail. Passing GO pays ${go}.",
    "howto.buy.title": "Buying & rent",
    "howto.buy.body":
      "Land on an unowned property to buy it; land on someone else's and you pay them rent. The buy panel shows the rent you'd earn.",
    "howto.build.title": "Monopolies & building",
    "howto.build.body":
      "Own a whole color group to form a monopoly: rent doubles, and you can build houses then a hotel (evenly across the set) to raise rent sharply.",
    "howto.mortgage.title": "Mortgage",
    "howto.mortgage.body":
      "Short on cash? Mortgage properties for half price and lift them later (plus 10%). You can't build while any property in the set is mortgaged.",
    "howto.jail.title": "Jail",
    "howto.jail.body":
      "In jail, roll doubles to escape, pay ${fine}, or use a Get-Out-of-Jail card. After three failed rolls you must pay the fine.",
    "howto.cards.title": "Chance & Community Chest",
    "howto.cards.body":
      "These tiles draw a card: money in or out, a move around the board, or a trip to jail.",
    "howto.trade.title": "Trading",
    "howto.trade.body":
      "Deal with anyone at any time — swap properties, cash and jail cards. A trade that completes a set can decide the game.",
    "howto.win.title": "Bankruptcy & winning",
    "howto.win.body":
      "Can't pay a debt? You auto-sell buildings and mortgage to cover it; if you still fall short, you're bankrupt. The last player left wins.",

    "log.started": "Game started with {n} players.",
    "log.rolled": "{name} rolled {a} + {b} = {sum}.",
    "log.rolledDoubles": "{name} rolled {a} + {b} = {sum} (doubles).",
    "log.threeDoubles": "{name} rolled three doubles and goes to jail!",
    "log.rolledFromJail": "{name} rolled {a} + {b} = {sum} from jail.",
    "log.jailDoubles": "{name} rolled doubles and leaves jail.",
    "log.jailStay": "{name} failed to roll doubles and stays in jail.",
    "log.jailThird": "{name}'s third attempt failed — pays ${fine}.",
    "log.jailPaid": "{name} paid ${fine} to get out of jail.",
    "log.jailCard": "{name} used a get-out-of-jail card.",
    "log.tradeProposed": "{from} proposed a trade to {to}.",
    "log.tradeDeclined": "{name} declined the trade.",
    "log.tradeInvalid": "The trade is no longer valid and was cancelled.",
    "log.tradeAccepted": "{name} accepted the trade.",
    "log.tradeWithdrawn": "The trade offer was withdrawn.",
    "log.passGo": "{name} passed GO and collected ${amount}.",
    "log.tax": "{name} landed on {tile} and owes ${amount}.",
    "log.toJail": "{name} was sent to jail.",
    "log.cantAfford": "{name} can't afford {tile} (${price}).",
    "log.rent": "{name} pays ${rent} rent to {owner} for {tile}.",
    "log.drew": "{name} drew: {card}",
    "log.bought": "{name} bought {tile} for ${price}.",
    "log.declinedBuy": "{name} declined to buy {tile}.",
    "log.auctionStart": "{tile} goes to auction!",
    "log.bid": "{name} bids ${amount} for {tile}.",
    "log.auctionPass": "{name} passes the auction.",
    "log.auctionWon": "{name} won {tile} at auction for ${price}.",
    "log.auctionNoBids": "{tile} drew no bids and stays with the bank.",
    "log.builtHouse": "{name} built a house on {tile} for ${cost}.",
    "log.builtHotel": "{name} built a hotel on {tile} for ${cost}.",
    "log.soldBuilding": "{name} sold a building on {tile} for ${refund}.",
    "log.mortgaged": "{name} mortgaged {tile} for ${value}.",
    "log.unmortgaged": "{name} lifted the mortgage on {tile} for ${cost}.",
    "log.bankrupt": "{name} went bankrupt!",
    "log.wins": "{name} wins the game!",
    "log.gameOver": "Game over.",

    "card.ch_go": "Advance to GO. Collect $200.",
    "card.ch_illinois": "Advance to Illinois Avenue.",
    "card.ch_charles": "Advance to St. Charles Place.",
    "card.ch_reading": "Take a trip to Reading Railroad.",
    "card.ch_boardwalk": "Advance to Boardwalk.",
    "card.ch_dividend": "Bank pays you a dividend of $50.",
    "card.ch_jailfree": "Get out of jail free.",
    "card.ch_back3": "Go back 3 spaces.",
    "card.ch_jail": "Go to jail. Do not pass GO.",
    "card.ch_repairs": "Make repairs: $25 per house, $100 per hotel.",
    "card.ch_poortax": "Pay poor tax of $15.",
    "card.ch_chairman": "Elected chairman. Pay each player $50.",
    "card.cc_go": "Advance to GO. Collect $200.",
    "card.cc_bankerror": "Bank error in your favor. Collect $200.",
    "card.cc_doctor": "Doctor's fee. Pay $50.",
    "card.cc_jailfree": "Get out of jail free.",
    "card.cc_jail": "Go to jail. Do not pass GO.",
    "card.cc_birthday": "It's your birthday. Collect $10 from each player.",
    "card.cc_refund": "Income tax refund. Collect $20.",
    "card.cc_hospital": "Pay hospital fees of $100.",
    "card.cc_inherit": "You inherit $100.",
    "card.cc_insurance": "Life insurance matures. Collect $100.",
    "card.cc_school": "School fees. Pay $50.",
    "card.cc_streets": "Street repairs: $40 per house, $115 per hotel.",
  },
  ru: {
    "home.tagline":
      "Создай комнату и поделись ссылкой с друзьями — без регистрации.",
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
    "buy.rentLabel": "Аренда",
    "buy.withSet": "${rent} с монополией",
    "buy.completesSet": "Завершает цветной набор!",
    "buy.setProgress": "{owned}/{total} в этом цвете",
    "buy.railroads": "{owned}/{total} ж/д → аренда",
    "buy.utilities": "{owned}/{total} компаний → аренда",
    "buy.timesDice": "{mult}× по кубикам",

    "auction.title": "Аукцион",
    "auction.tileUp": "«{tile}» на аукционе",
    "auction.highBid": "Ставка ${amount}",
    "auction.highBy": "— {name}",
    "auction.noBids": "Ставок пока нет",
    "auction.yourTurn": "Твоя ставка",
    "auction.turnOf": "Ставит {name}",
    "auction.bid": "Ставка ${amount}",
    "auction.pass": "Пас",
    "auction.waiting": "Ждём ставку {name}…",
    "auction.passed": "спасовал",
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

    "details.owner": "Владелец",
    "details.price": "Цена",
    "details.baseRent": "Базовая аренда",
    "details.withSet": "С монополией",
    "details.house": "С {n} домами",
    "details.hotel": "С отелем",
    "details.houseCost": "Цена дома",
    "details.mortgage": "Залог",
    "details.owned": "Во владении: {n}",
    "details.timesDice": "{x}× по кубикам",
    "details.tax": "Налог",

    "manage.title": "Твоё имущество",
    "manage.supplyTitle": "Осталось домов / отелей в банке",
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
    "net.playerOffline": "{name} не в сети",
    "net.skip": "Пропустить его ход",
    "net.autoSkipIn": "Авто-пропуск через {n}с",
    "net.slowConnection":
      "У {name} медленное соединение ({ms}мс) — немного подождите…",
    "notify.yourTurn": "Твой ход!",
    "notify.tradeOffer": "Предложение сделки!",

    "settings.title": "Настройки",
    "settings.boardTheme": "Тема доски",
    "settings.language": "Язык",
    "theme.classic.name": "Classic",
    "theme.classic.desc": "Цветная доска, светлая и дружелюбная.",
    "theme.mono.name": "Minimal",
    "theme.mono.desc": "Чёрно-белая, подстраивается под тему.",
    "theme.neon.name": "Neon",
    "theme.neon.desc": "Тёмная доска со свечением.",

    "trade.open": "Предложить сделку",
    "trade.title": "Предложить сделку",
    "trade.partner": "Партнёр",
    "trade.youGive": "Ты отдаёшь",
    "trade.youReceive": "Ты получаешь",
    "trade.money": "Деньги",
    "trade.cards": "Карты тюрьмы",
    "trade.send": "Отправить",
    "trade.cancel": "Отозвать",
    "trade.accept": "Принять",
    "trade.decline": "Отклонить",
    "trade.waiting": "Ждём ответа {name}…",
    "trade.pendingTitle": "Предложение обмена",
    "trade.gives": "{name} отдаёт",
    "trade.nothing": "ничего",

    "settings.sound": "Звук",
    "common.on": "Вкл",
    "common.off": "Выкл",

    "stats.open": "Статистика",
    "stats.title": "Капитал по ходам",
    "results.standings": "Итоговый рейтинг",
    "results.bankrupt": "банкрот",

    "howto.title": "Как играть",
    "howto.goal.title": "Цель",
    "howto.goal.body":
      "Останься последним игроком — разори остальных арендой и выгодными сделками. Старт — ${start}.",
    "howto.turn.title": "Твой ход",
    "howto.turn.body":
      "Брось кубики и походи. Дубль — ходишь ещё раз, но три подряд отправляют в тюрьму. За проход «Старта» — ${go}.",
    "howto.buy.title": "Покупка и аренда",
    "howto.buy.body":
      "Попал на свободный участок — можешь купить; попал на чужой — платишь аренду. В панели покупки видно, сколько будешь получать.",
    "howto.build.title": "Монополии и стройка",
    "howto.build.body":
      "Собери все участки одного цвета — это монополия: аренда удваивается, и можно строить дома, а затем отель (равномерно по набору), резко поднимая аренду.",
    "howto.mortgage.title": "Залог",
    "howto.mortgage.body":
      "Не хватает денег? Заложи участки за половину цены и выкупи позже (плюс 10%). Строить нельзя, пока в наборе есть заложенный участок.",
    "howto.jail.title": "Тюрьма",
    "howto.jail.body":
      "В тюрьме: выбрось дубль, заплати ${fine} или используй карту «выйти из тюрьмы». После трёх неудачных бросков платишь штраф.",
    "howto.cards.title": "Шанс и Казна",
    "howto.cards.body":
      "Эти клетки тянут карту: деньги плюс или минус, перемещение по доске или отправка в тюрьму.",
    "howto.trade.title": "Сделки",
    "howto.trade.body":
      "Меняйся с кем угодно и когда угодно — участки, деньги и карты тюрьмы. Сделка, завершающая набор, может решить партию.",
    "howto.win.title": "Банкротство и победа",
    "howto.win.body":
      "Не можешь заплатить? Автоматически продаёшь постройки и закладываешь имущество; если всё равно не хватает — банкрот. Побеждает последний оставшийся.",

    "log.started": "Игра началась, игроков: {n}.",
    "log.rolled": "{name} выбрасывает {a} + {b} = {sum}.",
    "log.rolledDoubles": "{name} выбрасывает {a} + {b} = {sum} (дубль).",
    "log.threeDoubles":
      "{name} выбрасывает три дубля подряд и попадает в тюрьму!",
    "log.rolledFromJail": "{name} в тюрьме выбрасывает {a} + {b} = {sum}.",
    "log.jailDoubles": "{name} выбрасывает дубль и выходит из тюрьмы.",
    "log.jailStay": "{name} не выбрасывает дубль и остаётся в тюрьме.",
    "log.jailThird": "Третья попытка {name} неудачна — платит ${fine}.",
    "log.jailPaid": "{name} платит ${fine} и выходит из тюрьмы.",
    "log.jailCard": "{name} использует карту «выйти из тюрьмы».",
    "log.tradeProposed": "{from} предлагает сделку {to}.",
    "log.tradeDeclined": "{name} отклоняет сделку.",
    "log.tradeInvalid": "Сделка больше недействительна и отменена.",
    "log.tradeAccepted": "{name} принимает сделку.",
    "log.tradeWithdrawn": "Предложение сделки отозвано.",
    "log.passGo": "{name} проходит «Старт» и получает ${amount}.",
    "log.tax": "{name} попадает на «{tile}» и должен ${amount}.",
    "log.toJail": "{name} отправляется в тюрьму.",
    "log.cantAfford": "{name} не может купить «{tile}» (${price}).",
    "log.rent": "{name} платит ${rent} аренды {owner} за «{tile}».",
    "log.drew": "{name} тянет карту: {card}",
    "log.bought": "{name} покупает «{tile}» за ${price}.",
    "log.declinedBuy": "{name} отказывается от покупки «{tile}».",
    "log.auctionStart": "«{tile}» уходит на аукцион!",
    "log.bid": "{name} ставит ${amount} за «{tile}».",
    "log.auctionPass": "{name} пасует на аукционе.",
    "log.auctionWon": "{name} выигрывает «{tile}» на аукционе за ${price}.",
    "log.auctionNoBids": "«{tile}» не получил ставок и остаётся у банка.",
    "log.builtHouse": "{name} строит дом на «{tile}» за ${cost}.",
    "log.builtHotel": "{name} строит отель на «{tile}» за ${cost}.",
    "log.soldBuilding": "{name} продаёт постройку на «{tile}» за ${refund}.",
    "log.mortgaged": "{name} закладывает «{tile}» за ${value}.",
    "log.unmortgaged": "{name} выкупает залог «{tile}» за ${cost}.",
    "log.bankrupt": "{name} банкротится!",
    "log.wins": "{name} выигрывает!",
    "log.gameOver": "Игра окончена.",

    "card.ch_go": "На «Старт». Получи $200.",
    "card.ch_illinois": "Переместись на Illinois Avenue.",
    "card.ch_charles": "Переместись на St. Charles Place.",
    "card.ch_reading": "Поездка на Reading Railroad.",
    "card.ch_boardwalk": "Переместись на Boardwalk.",
    "card.ch_dividend": "Банк выплачивает дивиденд $50.",
    "card.ch_jailfree": "Карта «выйти из тюрьмы бесплатно».",
    "card.ch_back3": "Вернись на 3 клетки назад.",
    "card.ch_jail": "Отправляйся в тюрьму. Без прохода «Старта».",
    "card.ch_repairs": "Ремонт: $25 за дом, $100 за отель.",
    "card.ch_poortax": "Заплати налог $15.",
    "card.ch_chairman": "Ты избран председателем. Заплати каждому игроку $50.",
    "card.cc_go": "На «Старт». Получи $200.",
    "card.cc_bankerror": "Ошибка банка в твою пользу. Получи $200.",
    "card.cc_doctor": "Оплата врача. Заплати $50.",
    "card.cc_jailfree": "Карта «выйти из тюрьмы бесплатно».",
    "card.cc_jail": "Отправляйся в тюрьму. Без прохода «Старта».",
    "card.cc_birthday": "У тебя день рождения. Получи по $10 с каждого игрока.",
    "card.cc_refund": "Возврат налога. Получи $20.",
    "card.cc_hospital": "Оплата больницы. Заплати $100.",
    "card.cc_inherit": "Ты получаешь наследство $100.",
    "card.cc_insurance": "Страховка созрела. Получи $100.",
    "card.cc_school": "Оплата обучения. Заплати $50.",
    "card.cc_streets": "Ремонт дорог: $40 за дом, $115 за отель.",
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

  const value = useMemo<I18nState>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  )
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
