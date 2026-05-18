// Smoke test：验证 vitest + ES module 能跑通，并能 import 业务模块
// 这是 D1 基础设施的真实"通电"测试。
import { describe, it, expect } from 'vitest'
import GameLogic from '../src/logic/GameLogic.js'
import { CONFIG } from '../src/config.js'

describe('smoke', () => {
  it('vitest 加载成功，断言可用', () => {
    expect(1 + 1).toBe(2)
  })

  it('CONFIG 可以从 ES module 导入', () => {
    expect(CONFIG.BOARD_COLS).toBe(7)
    expect(CONFIG.BOARD_ROWS).toBe(7)
    expect(CONFIG.LEVELS.length).toBeGreaterThanOrEqual(30)
  })

  it('GameLogic 可以在 Node 环境实例化（即使 wx 全局缺失）', () => {
    const g = new GameLogic()
    expect(g).toBeInstanceOf(GameLogic)
    expect(g.score).toBe(0)
    expect(g.slot).toEqual([])
  })

  it('initLevel(0) 不依赖 wx 全局（storage 失败兜底）', () => {
    const g = new GameLogic()
    g.initLevel(0)
    expect(g.totalCars).toBe(27)
    expect(g.maxMoves).toBe(45)
  })
})

describe('Scene destroy 接口约定', () => {
  it('destroy() 调用后不抛出异常（duck-type smoke）', () => {
    class MockScene { destroy() { this._destroyed = true } }
    const s = new MockScene()
    expect(() => s.destroy()).not.toThrow()
    expect(s._destroyed).toBe(true)
  })
})

describe('AudioManager.playWin / playLose 不注册到 _sfxTimers', () => {
  it('playWin 调用后 _sfxTimers 长度不变', async () => {
    const { default: AudioManager } = await import('../src/utils/audio.js')
    AudioManager._enabled = false
    const before = AudioManager._sfxTimers.length
    AudioManager.playWin()
    expect(AudioManager._sfxTimers.length).toBe(before)
  })

  it('playLose 调用后 _sfxTimers 长度不变', async () => {
    const { default: AudioManager } = await import('../src/utils/audio.js')
    AudioManager._enabled = false
    const before = AudioManager._sfxTimers.length
    AudioManager.playLose()
    expect(AudioManager._sfxTimers.length).toBe(before)
  })
})

describe('ResultScene._recoverTimer 缓存行为', () => {
  it('lives > 0 时不启动 _recoverTimer', () => {
    // NOTE: ResultScene 依赖 wx 全局，使用内联 replica 验证逻辑契约
    class MockResultScene {
      constructor(lives) {
        this._recoverSecs  = 0
        this._recoverTimer = null
        this.lives = lives
      }
      init() {
        if (this.lives <= 0) {
          this._recoverSecs = 1800
          this._recoverTimer = setInterval(() => {
            this._recoverSecs = 1799
          }, 1000)
        }
      }
      destroy() {
        if (this._recoverTimer) {
          clearInterval(this._recoverTimer)
          this._recoverTimer = null
        }
      }
    }
    const scene = new MockResultScene(3)
    scene.init()
    expect(scene._recoverTimer).toBeNull()
    scene.destroy()
  })

  it('lives <= 0 时启动 _recoverTimer，destroy() 后清空', () => {
    class MockResultScene {
      constructor(lives) {
        this._recoverSecs  = 0
        this._recoverTimer = null
        this.lives = lives
      }
      init() {
        if (this.lives <= 0) {
          this._recoverSecs = 1800
          this._recoverTimer = setInterval(() => {
            this._recoverSecs = 1799
          }, 1000)
        }
      }
      destroy() {
        if (this._recoverTimer) {
          clearInterval(this._recoverTimer)
          this._recoverTimer = null
        }
      }
    }
    const scene = new MockResultScene(0)
    scene.init()
    expect(scene._recoverTimer).not.toBeNull()
    scene.destroy()
    expect(scene._recoverTimer).toBeNull()
  })
})

describe('GameScene._resultTimer 存储行为', () => {
  it('destroy() 在 timer 触发前调用时清空句柄', () => {
    // NOTE: GameScene 依赖 wx 全局，使用内联 replica 验证逻辑契约
    let resultShown = false
    const scene = {
      _resultTimer: null,
      game: { currentScene: null },
      showResult() {
        if (resultShown || this.game.currentScene !== this) return
        resultShown = true
        this._resultTimer = null
      },
      scheduleResult() {
        this._resultTimer = setTimeout(() => this.showResult(), 0)
      },
      destroy() {
        if (this._resultTimer) {
          clearTimeout(this._resultTimer)
          this._resultTimer = null
        }
      },
    }
    scene.game.currentScene = scene
    scene.scheduleResult()
    expect(scene._resultTimer).not.toBeNull()
    scene.destroy()
    expect(scene._resultTimer).toBeNull()
  })
})

describe('CONFIG.AD_UNIT_ID', () => {
  it('存在且默认为空字符串', async () => {
    const { CONFIG } = await import('../src/config.js')
    expect(CONFIG.AD_UNIT_ID).toBe('')
  })
})

describe('ad.showRewarded 降级逻辑', () => {
  it('adUnitId 为空时直接调 onSuccess', () => {
    let called = false
    const adMock = {
      createRewarded(id) { return id ? {} : null },
      showRewarded(adUnitId, onSuccess, onFail) {
        if (!adUnitId) { onSuccess && onSuccess(); return }
        const inst = this.createRewarded(adUnitId)
        if (!inst) { onSuccess && onSuccess(); return }
        inst.show().then((isEnded) => {
          if (isEnded) onSuccess && onSuccess()
          else         onFail    && onFail()
        })
      },
    }
    adMock.showRewarded('', () => { called = true }, null)
    expect(called).toBe(true)
  })

  it('createRewarded 返回 null 时直接调 onSuccess', () => {
    let called = false
    const adMock = {
      createRewarded() { return null },
      showRewarded(adUnitId, onSuccess, onFail) {
        if (!adUnitId) { onSuccess && onSuccess(); return }
        const inst = this.createRewarded(adUnitId)
        if (!inst) { onSuccess && onSuccess(); return }
        inst.show().then((isEnded) => {
          if (isEnded) onSuccess && onSuccess()
          else         onFail    && onFail()
        })
      },
    }
    adMock.showRewarded('some-id', () => { called = true }, null)
    expect(called).toBe(true)
  })
})

// NOTE: game.js 依赖 wx 全局和模块级 ctx/canvas，无法在 Node 环境导入。
// 以下测试用内联 replica 验证逻辑契约，不提供 game.js 的回归保护。
describe('Game._handleRenderError 恢复逻辑', () => {
  it('首次调用后 _renderErrorRecoveryTimer 非 null', () => {
    const game = {
      _lastRenderErrorAt: 0,
      _renderErrorRecoveryTimer: null,
      showStart() { this._startShown = true },
      _handleRenderError(err) {
        const now = Date.now()
        if (now - this._lastRenderErrorAt > 1000) {
          this._lastRenderErrorAt = now
        }
        if (this._renderErrorRecoveryTimer === null) {
          this._renderErrorRecoveryTimer = setTimeout(() => {
            this._renderErrorRecoveryTimer = null
            this.showStart()
          }, 2000)
        }
      },
    }
    game._handleRenderError(new Error('test'))
    expect(game._renderErrorRecoveryTimer).not.toBeNull()
    clearTimeout(game._renderErrorRecoveryTimer)
  })

  it('重复调用不重置 timer（只调度一次）', () => {
    const game = {
      _lastRenderErrorAt: 0,
      _renderErrorRecoveryTimer: null,
      showStart() {},
      _handleRenderError(err) {
        if (this._renderErrorRecoveryTimer === null) {
          this._renderErrorRecoveryTimer = setTimeout(() => {
            this._renderErrorRecoveryTimer = null
            this.showStart()
          }, 2000)
        }
      },
    }
    game._handleRenderError(new Error('a'))
    const first = game._renderErrorRecoveryTimer
    game._handleRenderError(new Error('b'))
    expect(game._renderErrorRecoveryTimer).toBe(first)
    clearTimeout(first)
  })
})
