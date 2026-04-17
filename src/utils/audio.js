// 音效管理器 - 赢了个赢
// 使用微信小游戏 API
const AudioManager = {
  _sounds: {},
  _enabled: true,
  _bgm: null,

  // 初始化预加载音效
  init() {
    const sources = {
      click:  'sounds/click.wav',
      match:  'sounds/match.wav',
      combo:  'sounds/combo.wav',
      win:    'sounds/win.wav',
      lose:   'sounds/lose.wav',
      tick:   'sounds/tick.wav',
    }
    for (const [key, src] of Object.entries(sources)) {
      try {
        const audio = wx.createInnerAudioContext()
        audio.src = src
        audio.volume = 0.6
        this._sounds[key] = audio
      } catch (e) {
        // 忽略音效加载失败
      }
    }
  },

  play(key) {
    if (!this._enabled) return
    try {
      const audio = this._sounds[key]
      if (audio) {
        audio.seek(0)
        audio.play()
      }
    } catch (e) {}
  },

  playBGM() {
    try {
      if (this._bgm) return
      this._bgm = wx.createInnerAudioContext()
      this._bgm.src = 'sounds/bgm.mp3'
      this._bgm.loop = true
      this._bgm.volume = 0.3
      this._bgm.play()
    } catch (e) {}
  },

  stopBGM() {
    try {
      if (this._bgm) {
        this._bgm.stop()
        this._bgm = null
      }
    } catch (e) {}
  },

  toggle() {
    this._enabled = !this._enabled
    if (!this._enabled) this.stopBGM()
    else this.playBGM()
    return this._enabled
  }
}

export default AudioManager
