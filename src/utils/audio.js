// 音效管理器 - 赢了个赢
// 开心消消乐风格：木琴 + 气泡 + 铃声，使用 WebAudio API 合成，无需音频文件

const AudioManager = {
  _ctx: null,
  _enabled: true,
  _bgmPlaying: false,
  _bgmTimer: null,
  _bgmNoteTimers: [],   // BGM 循环内每个音符的 setTimeout 句柄，stopBGM 时统一清掉
  _sfxTimers: [],       // 非 BGM 音效的延迟 timer，切场景时统一清掉

  // ========== 初始化 ==========
  init() {
    try {
      this._ctx = wx.createWebAudioContext()
    } catch (e) {
      this._ctx = null
    }
  },

  _cleanupOnEnd(source, nodes) {
    try {
      source.onended = () => {
        for (const node of nodes) {
          try { node.disconnect() } catch (e) {}
        }
      }
    } catch (e) {}
  },

  _setSfxTimeout(fn, delay) {
    const timer = setTimeout(() => {
      const idx = this._sfxTimers.indexOf(timer)
      if (idx !== -1) this._sfxTimers.splice(idx, 1)
      fn()
    }, delay)
    this._sfxTimers.push(timer)
    return timer
  },

  stopSFX() {
    for (const t of this._sfxTimers) clearTimeout(t)
    this._sfxTimers = []
  },

  // ========== 内部：木琴音（marimba 感）==========
  // 用正弦波 + 快速 decay 模拟拨弦/木琴敲击感
  _marimba(freq, duration = 0.25, vol = 0.45) {
    if (!this._enabled || !this._ctx) return
    try {
      const ctx = this._ctx
      const now = ctx.currentTime

      // 主音：正弦波，模拟木琴基音
      const osc1  = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, now)
      gain1.gain.setValueAtTime(vol, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc1.connect(gain1); gain1.connect(ctx.destination)
      this._cleanupOnEnd(osc1, [osc1, gain1])
      osc1.start(now); osc1.stop(now + duration)

      // 泛音：2倍频，三角波，音量小，增加木质感
      const osc2  = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 2, now)
      gain2.gain.setValueAtTime(vol * 0.25, now)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6)
      osc2.connect(gain2); gain2.connect(ctx.destination)
      this._cleanupOnEnd(osc2, [osc2, gain2])
      osc2.start(now); osc2.stop(now + duration * 0.7)
    } catch (e) {}
  },

  // ========== 内部：铃声（高频亮色）==========
  _bell(freq, duration = 0.4, vol = 0.3) {
    if (!this._enabled || !this._ctx) return
    try {
      const ctx = this._ctx
      const now = ctx.currentTime

      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      // 铃声：很快攻击，然后缓慢衰减（指数）
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(vol, now + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc.connect(gain); gain.connect(ctx.destination)
      this._cleanupOnEnd(osc, [osc, gain])
      osc.start(now); osc.stop(now + duration)
    } catch (e) {}
  },

  // ========== 内部：气泡破裂音 ==========
  _pop(vol = 0.25) {
    if (!this._enabled || !this._ctx) return
    try {
      const ctx = this._ctx
      const now = ctx.currentTime

      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      // 频率从高到低快速滑落，模拟气泡破裂"噗"
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08)
      gain.gain.setValueAtTime(vol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
      osc.connect(gain); gain.connect(ctx.destination)
      this._cleanupOnEnd(osc, [osc, gain])
      osc.start(now); osc.stop(now + 0.1)
    } catch (e) {}
  },

  // ========== 内部：滑音 ==========
  _sweep(freqFrom, freqTo, type = 'sine', duration = 0.18, vol = 0.3) {
    if (!this._enabled || !this._ctx) return
    try {
      const ctx = this._ctx
      const now = ctx.currentTime
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freqFrom, now)
      osc.frequency.exponentialRampToValueAtTime(freqTo, now + duration)
      gain.gain.setValueAtTime(vol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc.connect(gain); gain.connect(ctx.destination)
      this._cleanupOnEnd(osc, [osc, gain])
      osc.start(now); osc.stop(now + duration + 0.02)
    } catch (e) {}
  },

  // ========== 内部：多音符序列（开心消消乐核心） ==========
  // 注意：playWin/playLose 不调用此方法，因为它内部走 _setSfxTimeout，
  // 会被 stopSFX 截断。胜负音效需要 fire-and-forget，直接用原生 setTimeout。
  _playNotes(notes, interval = 80) {
    // notes: [{freq, dur, vol}]
    notes.forEach((n, i) => {
      this._setSfxTimeout(() => this._marimba(n.freq, n.dur || 0.22, n.vol || 0.42), i * interval)
    })
  },

  // ========== 对外音效接口 ==========

  // 点击车块：轻快的木琴单音"叮"
  playClick() {
    this._marimba(523, 0.14, 0.32)   // C5，短促
  },

  // 车块入槽：稍高的木琴"叮"+ 气泡
  playInsert() {
    this._marimba(659, 0.18, 0.38)   // E5
    this._setSfxTimeout(() => this._pop(0.15), 60)
  },

  // 消除成功：开心消消乐经典三连上扬音 do-mi-sol
  playMatch() {
    // C5 → E5 → G5，木琴快速上行
    this._playNotes([
      { freq: 523, dur: 0.22, vol: 0.4 },   // C5
      { freq: 659, dur: 0.22, vol: 0.44 },  // E5
      { freq: 784, dur: 0.30, vol: 0.48 },  // G5
    ], 90)
    // 最后加一个小铃声收尾
    this._setSfxTimeout(() => this._bell(1047, 0.5, 0.22), 280)  // C6 铃声
    // 气泡破裂感
    this._setSfxTimeout(() => this._pop(0.2), 40)
    this._setSfxTimeout(() => this._pop(0.18), 120)
    this._setSfxTimeout(() => this._pop(0.15), 200)
  },

  // 连消：级数越高音调越高，开心消消乐风格的欢呼上升
  playCombo(comboCount) {
    // 每次连消都是一套上扬音阶，但起始频率随连消数提高
    const scales = [
      [523, 659, 784, 1047],   // combo2: C5-E5-G5-C6
      [587, 740, 880, 1175],   // combo3: D5-F#5-A5-D6
      [659, 831, 988, 1319],   // combo4: E5-G#5-B5-E6
      [784, 988, 1175, 1568],  // combo5+: G5-B5-D6-G6
    ]
    const idx   = Math.min(comboCount - 2, scales.length - 1)
    const freqs = scales[Math.max(0, idx)]

    freqs.forEach((freq, i) => {
      this._setSfxTimeout(() => {
        this._marimba(freq, 0.22, 0.42 + i * 0.04)
      }, i * 75)
    })
    // 收尾铃声 + 扫频
    this._setSfxTimeout(() => this._bell(freqs[freqs.length - 1] * 1.5, 0.6, 0.25), freqs.length * 75 + 20)
    this._setSfxTimeout(() => this._sweep(freqs[freqs.length - 1], freqs[freqs.length - 1] * 2, 'sine', 0.3, 0.2), freqs.length * 75 + 80)
    // 连消气泡
    for (let i = 0; i < Math.min(comboCount, 5); i++) {
      this._setSfxTimeout(() => this._pop(0.18), i * 55 + 30)
    }
  },

  // 撤销：向下的木琴滑音，时光倒流感
  playUndo() {
    // 从高到低三个音 G5→E5→C5
    this._playNotes([
      { freq: 784, dur: 0.18, vol: 0.35 },  // G5
      { freq: 659, dur: 0.18, vol: 0.32 },  // E5
      { freq: 523, dur: 0.22, vol: 0.28 },  // C5
    ], 80)
    this._sweep(600, 300, 'sine', 0.28, 0.15)
  },

  // 槽位满：低沉警告双击，开心消消乐中的危险提示音
  playSlotFull() {
    this._marimba(196, 0.12, 0.4)   // G3 低音
    this._setSfxTimeout(() => this._marimba(185, 0.15, 0.45), 110)  // 略低
    // 噪声震动感
    this._setSfxTimeout(() => {
      if (!this._enabled || !this._ctx) return
      try {
        const ctx = this._ctx
        const bufSize = Math.floor(ctx.sampleRate * 0.08)
        const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6
        const src = ctx.createBufferSource()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'; filter.frequency.value = 300
        src.buffer = buf
        gain.gain.setValueAtTime(0.18, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
        this._cleanupOnEnd(src, [src, filter, gain])
        src.start(); src.stop(ctx.currentTime + 0.09)
      } catch (e) {}
    }, 50)
  },

  // 被遮挡点击：轻柔的"嗯"提示，开心消消乐中点到锁住方块的反馈
  playBlocked() {
    this._marimba(330, 0.1, 0.22)   // E4，低调短促
    this._setSfxTimeout(() => this._marimba(294, 0.12, 0.18), 70)   // D4
  },

  // 关卡通关：开心消消乐经典胜利旋律（快速上扬+铃声收尾）
  playWin() {
    // C5-E5-G5-C6 上行，然后 E6-G6 收尾，欢快活泼
    const notes = [
      { freq: 523,  dur: 0.18, vol: 0.42 },  // C5
      { freq: 659,  dur: 0.18, vol: 0.45 },  // E5
      { freq: 784,  dur: 0.18, vol: 0.48 },  // G5
      { freq: 1047, dur: 0.24, vol: 0.52 },  // C6
      { freq: 1319, dur: 0.20, vol: 0.50 },  // E6
      { freq: 1568, dur: 0.35, vol: 0.55 },  // G6
    ]
    // fire-and-forget：不受 stopSFX 管控，用原生 setTimeout
    notes.forEach((n, i) => {
      setTimeout(() => this._marimba(n.freq, n.dur || 0.22, n.vol || 0.42), i * 95)
    })
    // 铃声叠加，营造庆祝感（fire-and-forget，不受 stopSFX 管控）
    setTimeout(() => this._bell(2093, 0.7, 0.28), 480)  // C7 高铃
    setTimeout(() => this._bell(1568, 0.9, 0.22), 560)  // G6 铃
    // 气泡连串
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this._pop(0.15 + Math.random() * 0.1), i * 80 + 50)
    }
  },

  // 关卡失败：开心消消乐风格的下行闷音
  playLose() {
    // G4→E4→C4→A3，逐渐低沉
    const notes = [
      { freq: 392, dur: 0.22, vol: 0.38 },  // G4
      { freq: 330, dur: 0.24, vol: 0.35 },  // E4
      { freq: 262, dur: 0.26, vol: 0.32 },  // C4
      { freq: 220, dur: 0.35, vol: 0.28 },  // A3
    ]
    // fire-and-forget：不受 stopSFX 管控，用原生 setTimeout
    notes.forEach((n, i) => {
      setTimeout(() => this._marimba(n.freq, n.dur || 0.22, n.vol || 0.42), i * 130)
    })
    // 结尾加一个低沉滑落（fire-and-forget，不受 stopSFX 管控）
    setTimeout(() => this._sweep(220, 130, 'triangle', 0.35, 0.2), 520)
    // 低频噪声，增加"沮丧"质感
    setTimeout(() => {
      if (!this._enabled || !this._ctx) return
      try {
        const ctx = this._ctx
        const bufSize = Math.floor(ctx.sampleRate * 0.35)
        const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
        const src = ctx.createBufferSource()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'; filter.frequency.value = 280
        src.buffer = buf
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
        this._cleanupOnEnd(src, [src, filter, gain])
        src.start(); src.stop(ctx.currentTime + 0.36)
      } catch (e) {}
    }, 540)
  },

  // ========== BGM：开心消消乐风格的活泼木琴节拍 ==========
  playBGM() {
    if (!this._enabled || !this._ctx || this._bgmPlaying) return
    this._bgmPlaying = true
    this._scheduleBGM()
  },

  _scheduleBGM() {
    if (!this._bgmPlaying || !this._ctx) return

    // 开心消消乐风格：轻快的木琴旋律，C大调，BPM≈120
    // 每拍 0.5s，8拍一循环
    const pattern = [
      { freq: 523,  vol: 0.07, dur: 0.35 },  // C5
      { freq: 659,  vol: 0.06, dur: 0.35 },  // E5
      { freq: 784,  vol: 0.07, dur: 0.35 },  // G5
      { freq: 659,  vol: 0.06, dur: 0.35 },  // E5
      { freq: 523,  vol: 0.07, dur: 0.35 },  // C5
      { freq: 440,  vol: 0.05, dur: 0.35 },  // A4
      { freq: 523,  vol: 0.07, dur: 0.35 },  // C5
      { freq: 0,    vol: 0,    dur: 0    },   // 休止
      { freq: 587,  vol: 0.07, dur: 0.35 },  // D5
      { freq: 740,  vol: 0.06, dur: 0.35 },  // F#5
      { freq: 880,  vol: 0.07, dur: 0.35 },  // A5
      { freq: 740,  vol: 0.06, dur: 0.35 },  // F#5
      { freq: 659,  vol: 0.07, dur: 0.35 },  // E5
      { freq: 523,  vol: 0.06, dur: 0.35 },  // C5
      { freq: 659,  vol: 0.08, dur: 0.45 },  // E5（稍长）
      { freq: 0,    vol: 0,    dur: 0    },   // 休止
    ]

    const beatLen = 0.25  // 每拍 0.25s，BPM=120
    pattern.forEach((note, i) => {
      if (note.freq === 0) return
      const t = setTimeout(() => {
        if (this._bgmPlaying) {
          this._marimba(note.freq, note.dur, note.vol)
        }
      }, i * beatLen * 1000)
      this._bgmNoteTimers.push(t)
    })

    const totalLen = pattern.length * beatLen * 1000
    this._bgmTimer = setTimeout(() => {
      // 一轮播完，先清掉已派发的句柄数组，再继续下一轮
      this._bgmNoteTimers = []
      this._scheduleBGM()
    }, totalLen)
  },

  stopBGM() {
    this._bgmPlaying = false
    if (this._bgmTimer) {
      clearTimeout(this._bgmTimer)
      this._bgmTimer = null
    }
    // 清掉本轮所有还在队列里的音符 timer，避免离开场景后仍然空跑
    for (const t of this._bgmNoteTimers) clearTimeout(t)
    this._bgmNoteTimers = []
  },

  // ========== 开关 ==========
  toggle() {
    const willEnable = !this._enabled

    if (willEnable) {
      // 开启：先改状态，再播音效 + BGM
      this._enabled = true
      this._sweep(400, 800, 'sine', 0.15, 0.3)         // 上扬滑音表示"开"
      this._setSfxTimeout(() => this._bell(1047, 0.35, 0.25), 120)
      this.playBGM()
    } else {
      // 关闭：先播音效（此时 _enabled 还是 true，能正常播放）
      this._sweep(800, 300, 'sine', 0.18, 0.28)         // 下滑音表示"关"
      // 延迟一帧再真正禁用，确保音效 nodes 已加入调度
      this._setSfxTimeout(() => {
        this._enabled = false
        this.stopBGM()
      }, 30)
    }

    return willEnable
  },

  get enabled() { return this._enabled },
}

export default AudioManager
