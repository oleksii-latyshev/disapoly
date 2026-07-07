// No registration: a player is a persisted random id plus a nickname.
// The id lets a refreshed or reconnecting tab resume as the same player.

const PLAYER_ID_KEY = "disapoly.playerId"
const NICKNAME_KEY = "disapoly.nickname"
const EMOJI_KEY = "disapoly.emoji"

/** Stable per-browser player id, generated once and persisted. */
export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

export function getStoredNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? ""
}

export function setStoredNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname)
}

/** Preferred emoji avatar; empty string lets the room auto-assign one. */
export function getStoredEmoji(): string {
  return localStorage.getItem(EMOJI_KEY) ?? ""
}

export function setStoredEmoji(emoji: string): void {
  localStorage.setItem(EMOJI_KEY, emoji)
}

/** Short, URL-friendly room code. */
export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Shareable URL for a room. */
export function roomUrl(roomId: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${roomId}`
}
