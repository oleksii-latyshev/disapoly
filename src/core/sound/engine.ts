/**
 * Procedural sound effects synthesized with the Web Audio API — no audio files.
 *
 * Every voice feeds a shared bus that splits into a dry path and a synthesized
 * room reverb (a short exponentially-decaying noise impulse), then through a
 * gentle compressor. The bit of shared "air" plus per-voice touches — bell
 * partials instead of bare sines, click transients on percussive hits, slight
 * random detune/pan — is what keeps the blips from sounding dry and wooden.
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
let bus: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

/** Stereo impulse response for the convolver: decaying noise = small room. */
function makeImpulse(
  c: AudioContext,
  seconds: number,
  decay: number
): AudioBuffer {
  const rate = c.sampleRate
  const length = Math.floor(rate * seconds)
  const buf = c.createBuffer(2, length, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
  }
  return buf
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.knee.value = 12
    compressor.ratio.value = 5
    compressor.attack.value = 0.002
    compressor.release.value = 0.12

    const master = ctx.createGain()
    master.gain.value = 0.25
    compressor.connect(master).connect(ctx.destination)

    bus = ctx.createGain()
    bus.connect(compressor) // dry

    const reverb = ctx.createConvolver()
    reverb.buffer = makeImpulse(ctx, 1.4, 3.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.16
    bus.connect(reverb).connect(wet).connect(compressor)

    // 1s of noise: bursts start at a random offset (up to 0.2s) and the
    // longest tails run ~0.5s, so this never hits the buffer's end.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate)
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

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Route a voice to the bus, optionally through a stereo panner. */
function toBus(c: AudioContext, node: AudioNode, pan: number): void {
  if (pan !== 0 && typeof c.createStereoPanner === "function") {
    const p = c.createStereoPanner()
    p.pan.value = pan
    node.connect(p).connect(bus!)
  } else {
    node.connect(bus!)
  }
}

function tone(
  c: AudioContext,
  t0: number,
  opts: {
    freq: number
    dur: number
    type?: OscillatorType
    gain?: number
    slideTo?: number
    detune?: number
    pan?: number
    attack?: number
  }
): void {
  const osc = c.createOscillator()
  osc.type = opts.type ?? "sine"
  osc.frequency.setValueAtTime(opts.freq, t0)
  if (opts.detune) osc.detune.value = opts.detune
  if (opts.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.slideTo),
      t0 + opts.dur
    )
  }
  const g = c.createGain()
  const peak = opts.gain ?? 0.3
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.012))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  osc.connect(g)
  toBus(c, g, opts.pan ?? 0)
  osc.start(t0)
  osc.stop(t0 + opts.dur + 0.05)
}

function noiseBurst(
  c: AudioContext,
  t0: number,
  opts: {
    dur: number
    freq: number
    gain?: number
    q?: number
    filter?: BiquadFilterType
    slideTo?: number
    pan?: number
  }
): void {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  const f = c.createBiquadFilter()
  f.type = opts.filter ?? "bandpass"
  f.frequency.setValueAtTime(opts.freq, t0)
  if (opts.slideTo) {
    f.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.slideTo),
      t0 + opts.dur
    )
  }
  f.Q.value = opts.q ?? 0.8
  const g = c.createGain()
  g.gain.setValueAtTime(opts.gain ?? 0.25, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  src.connect(f).connect(g)
  toBus(c, g, opts.pan ?? 0)
  src.start(t0, rnd(0, 0.2))
  src.stop(t0 + opts.dur + 0.05)
}

/**
 * A struck bell/chime: a few inharmonic sine partials with independent decays.
 * Far warmer than a single oscillator at the same pitch.
 */
function bell(
  c: AudioContext,
  t0: number,
  opts: { freq: number; dur?: number; gain?: number; pan?: number }
): void {
  const dur = opts.dur ?? 0.6
  const gain = opts.gain ?? 0.2
  const partials: [ratio: number, level: number, life: number][] = [
    [1, 1, 1],
    [2.76, 0.35, 0.55],
    [5.4, 0.12, 0.3],
  ]
  for (const [ratio, level, life] of partials) {
    tone(c, t0, {
      freq: opts.freq * ratio,
      dur: dur * life,
      gain: gain * level,
      pan: opts.pan ?? 0,
      detune: rnd(-4, 4),
      attack: 0.006,
    })
  }
}

/** A knock: pitch-dropping thump plus a tiny click transient — wood, not beep. */
function knock(
  c: AudioContext,
  t0: number,
  opts: { freq?: number; gain?: number; pan?: number }
): void {
  const freq = opts.freq ?? 190
  const gain = opts.gain ?? 0.3
  tone(c, t0, {
    freq,
    dur: 0.1,
    gain,
    slideTo: freq * 0.45,
    attack: 0.004,
    pan: opts.pan ?? 0,
  })
  noiseBurst(c, t0, {
    dur: 0.025,
    freq: 2800,
    filter: "highpass",
    gain: gain * 0.5,
    pan: opts.pan ?? 0,
  })
}

export function playSound(name: SoundName): void {
  const c = ensure()
  if (!c || !bus) return
  const t = c.currentTime + 0.005

  switch (name) {
    case "dice": {
      // A handful of randomized ticks (the shake), two knocks (the tumble),
      // and a settling thump. Random pitch/pan/timing so no two rolls match.
      for (let i = 0; i < 5; i++) {
        noiseBurst(c, t + rnd(0, 0.2), {
          dur: rnd(0.02, 0.04),
          freq: rnd(3200, 6500),
          filter: "highpass",
          gain: rnd(0.08, 0.18),
          pan: rnd(-0.5, 0.5),
        })
      }
      knock(c, t + 0.05, { freq: rnd(180, 220), gain: 0.22, pan: -0.25 })
      knock(c, t + 0.16, { freq: rnd(200, 250), gain: 0.26, pan: 0.25 })
      knock(c, t + 0.29, { freq: 165, gain: 0.34 })
      tone(c, t + 0.29, { freq: 95, dur: 0.14, gain: 0.28, slideTo: 55 })
      break
    }
    case "buy":
      // Cash register "cha-ching": drawer click, two coin chimes, warm base.
      noiseBurst(c, t, {
        dur: 0.04,
        freq: 5200,
        filter: "highpass",
        gain: 0.14,
      })
      bell(c, t + 0.03, { freq: 1319, gain: 0.2, dur: 0.5, pan: -0.2 })
      bell(c, t + 0.12, { freq: 1760, gain: 0.18, dur: 0.55, pan: 0.2 })
      tone(c, t + 0.05, { freq: 523, dur: 0.3, type: "triangle", gain: 0.1 })
      break
    case "build":
      // Two hammer blows, then a light "in place" chime.
      knock(c, t, { freq: 175, gain: 0.34, pan: -0.15 })
      knock(c, t + 0.16, { freq: 205, gain: 0.34, pan: 0.15 })
      bell(c, t + 0.33, { freq: 880, gain: 0.12, dur: 0.4 })
      break
    case "card":
      // Card swish (rising noise sweep) into a bright flip chime.
      noiseBurst(c, t, {
        dur: 0.16,
        freq: 500,
        slideTo: 2600,
        q: 1.4,
        gain: 0.16,
      })
      tone(c, t + 0.1, { freq: 740, dur: 0.14, type: "triangle", gain: 0.16 })
      bell(c, t + 0.15, { freq: 1175, gain: 0.16, dur: 0.5 })
      break
    case "trade":
      tone(c, t, { freq: 330, dur: 0.3, gain: 0.07 })
      bell(c, t, { freq: 659, gain: 0.16, dur: 0.45, pan: -0.15 })
      bell(c, t + 0.12, { freq: 880, gain: 0.16, dur: 0.5, pan: 0.15 })
      break
    case "offer":
      // A brighter three-note ring for an offer addressed to you specifically.
      bell(c, t, { freq: 880, gain: 0.2, dur: 0.5, pan: -0.25 })
      bell(c, t + 0.14, { freq: 1319, gain: 0.2, dur: 0.55 })
      bell(c, t + 0.3, { freq: 1760, gain: 0.18, dur: 0.65, pan: 0.25 })
      noiseBurst(c, t + 0.28, {
        dur: 0.3,
        freq: 7000,
        filter: "highpass",
        gain: 0.05,
      })
      break
    case "jail": {
      // Cell door: metallic clang (inharmonic partials) over a deep slam.
      const base = 285
      const partials: [number, number, number][] = [
        [1, 0.2, 0.5],
        [1.48, 0.14, 0.4],
        [2.11, 0.1, 0.3],
        [2.9, 0.07, 0.22],
      ]
      for (const [ratio, gain, dur] of partials) {
        tone(c, t, {
          freq: base * ratio,
          dur,
          type: "triangle",
          gain,
          detune: rnd(-6, 6),
          attack: 0.004,
        })
      }
      noiseBurst(c, t, { dur: 0.08, freq: 1400, gain: 0.22, q: 1.2 })
      tone(c, t, { freq: 100, dur: 0.35, gain: 0.32, slideTo: 40 })
      break
    }
    case "win": {
      // Fanfare: quick arpeggio into a held chord with a sparkle on top.
      const run = [523, 659, 784]
      run.forEach((freq, i) => {
        tone(c, t + i * 0.09, {
          freq,
          dur: 0.22,
          type: "triangle",
          gain: 0.18,
          detune: rnd(-5, 5),
          pan: (i - 1) * 0.2,
        })
      })
      const chord = [523, 659, 784, 1046]
      chord.forEach((freq, i) => {
        tone(c, t + 0.28, {
          freq,
          dur: 0.9,
          type: "triangle",
          gain: 0.1,
          detune: rnd(-6, 6),
          pan: (i - 1.5) * 0.15,
        })
      })
      bell(c, t + 0.3, { freq: 2093, gain: 0.1, dur: 0.8 })
      noiseBurst(c, t + 0.3, {
        dur: 0.5,
        freq: 7500,
        filter: "highpass",
        gain: 0.05,
      })
      break
    }
    case "turn":
      // Soft two-note chime (G5 → C6), bell-voiced so it rings rather than beeps.
      bell(c, t, { freq: 784, gain: 0.2, dur: 0.45, pan: -0.1 })
      bell(c, t + 0.13, { freq: 1046, gain: 0.22, dur: 0.6, pan: 0.1 })
      break
  }
}
