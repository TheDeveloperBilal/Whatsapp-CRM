// Web Audio API notification sounds — no external files needed

/** Tawk.to-style descending 3-tone alert for human handoff requests */
export function playHandoffSound() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    // Three descending sine tones
    const notes = [
      { freq: 880, start: 0.0, dur: 0.2 },
      { freq: 660, start: 0.22, dur: 0.2 },
      { freq: 550, start: 0.44, dur: 0.28 },
    ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = n.freq
      gain.gain.setValueAtTime(0.35, ctx.currentTime + n.start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur)
      osc.start(ctx.currentTime + n.start)
      osc.stop(ctx.currentTime + n.start + n.dur + 0.05)
    }
    setTimeout(() => ctx.close(), 1500)
  } catch {
    // AudioContext may be unavailable (SSR, test env) — silently ignore
  }
}

/** Short single ping for new inbound messages */
export function playMessageSound() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 740
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => ctx.close(), 600)
  } catch {}
}

export function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'handoff' })
  } catch {}
}
