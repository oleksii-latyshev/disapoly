/**
 * Procedural sound effects synthesized with the Web Audio API — no audio files.
 * Each effect is a few oscillator/noise blips with quick gain envelopes.
 *
 * Browsers block audio until a user gesture, so the context is created lazily
 * and `unlock()` is called on the first interaction (see SoundProvider).
 */

export type SoundName =
  | "dice"
  | "buy"
  | "build"
  | "card"
  | "trade"
  | "offer"
  | "jail"
  | "win"
  | "turn"

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.25
    master.connect(ctx.destination)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffer = buf
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Call from a user gesture to satisfy autoplay policies. */
export function unlock(): void {
  ensure()
}

function blip(
  c: AudioContext,
  t0: number,
  opts: {
    freq: number
    dur: number
    type?: OscillatorType
    gain?: number
    slideTo?: number
  }
): void {
  const osc = c.createOscillator()
  osc.type = opts.type ?? "sine"
  osc.frequency.setValueAtTime(opts.freq, t0)
  if (opts.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.slideTo),
      t0 + opts.dur
    )
  }
  const g = c.createGain()
  const peak = opts.gain ?? 0.3
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  osc.connect(g).connect(master!)
  osc.start(t0)
  osc.stop(t0 + opts.dur + 0.02)
}

function noise(
  c: AudioContext,
  t0: number,
  dur: number,
  freq: number,
  gain = 0.25
): void {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  const bp = c.createBiquadFilter()
  bp.type = "bandpass"
  bp.frequency.value = freq
  bp.Q.value = 0.8
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bp).connect(g).connect(master!)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

/** Arpeggio of notes (Hz) staggered in time. */
function arp(
  c: AudioContext,
  t0: number,
  freqs: number[],
  step: number,
  type: OscillatorType = "sine"
): void {
  freqs.forEach((f, i) =>
    blip(c, t0 + i * step, { freq: f, dur: step * 2, type, gain: 0.28 })
  )
}

export function playSound(name: SoundName): void {
  const c = ensure()
  if (!c || !master) return
  const t = c.currentTime + 0.005

  switch (name) {
    case "dice":
      noise(c, t, 0.18, 2200, 0.3)
      noise(c, t + 0.06, 0.1, 1600, 0.18)
      break
    case "buy":
      arp(c, t, [523, 659, 784], 0.07)
      break
    case "build":
      blip(c, t, {
        freq: 240,
        dur: 0.13,
        type: "square",
        gain: 0.22,
        slideTo: 150,
      })
      break
    case "card":
      blip(c, t, { freq: 740, dur: 0.12, type: "triangle", gain: 0.26 })
      blip(c, t + 0.1, { freq: 980, dur: 0.16, type: "triangle", gain: 0.26 })
      break
    case "trade":
      blip(c, t, { freq: 600, dur: 0.1, type: "sine", gain: 0.26 })
      blip(c, t + 0.09, { freq: 760, dur: 0.14, type: "sine", gain: 0.26 })
      break
    case "offer":
      // A brighter "ding-dong" for an offer addressed to you specifically.
      blip(c, t, { freq: 880, dur: 0.16, type: "triangle", gain: 0.3 })
      blip(c, t + 0.15, { freq: 1320, dur: 0.2, type: "triangle", gain: 0.3 })
      blip(c, t + 0.32, { freq: 1760, dur: 0.24, type: "sine", gain: 0.26 })
      break
    case "jail":
      blip(c, t, {
        freq: 200,
        dur: 0.28,
        type: "square",
        gain: 0.2,
        slideTo: 110,
      })
      noise(c, t, 0.1, 900, 0.15)
      break
    case "win":
      arp(c, t, [523, 659, 784, 1046], 0.11, "triangle")
      break
    case "turn":
      blip(c, t, { freq: 784, dur: 0.16, type: "sine", gain: 0.3 })
      blip(c, t + 0.14, { freq: 1046, dur: 0.22, type: "sine", gain: 0.3 })
      break
  }
}
