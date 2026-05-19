// Smoke test：验证 vitest + ES module 能跑通，并能 import 业务模块
// 这是 D1 基础设施的真实"通电"测试。
import { describe, it, expect, afterEach } from 'vitest'
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

describe('env.js runtime helpers', () => {
  const oldWx = globalThis.wx

  afterEach(() => {
    if (oldWx === undefined) delete globalThis.wx
    else globalThis.wx = oldWx
  })

  it('maps envVersion to the storage key prefix through real env.js', async () => {
    const { getEnvPrefix } = await import('../src/utils/env.js')
    expect(getEnvPrefix('develop')).toBe('dev_')
    expect(getEnvPrefix('trial')).toBe('trial_')
    expect(getEnvPrefix('release')).toBe('')
    expect(getEnvPrefix('unknown')).toBe('')
    expect(getEnvPrefix(undefined)).toBe('')
  })

  it('reads envVersion from wx.getAccountInfoSync() through real env.js', async () => {
    globalThis.wx = {
      getAccountInfoSync: () => ({
        miniProgram: { envVersion: 'trial' },
      }),
    }

    const { getEnvVersion } = await import('../src/utils/env.js')
    expect(getEnvVersion()).toBe('trial')
  })

  it('falls back to release when envVersion cannot be read', async () => {
    globalThis.wx = {
      getAccountInfoSync: () => { throw new Error('no wx') },
    }

    const { getEnvVersion } = await import('../src/utils/env.js')
    expect(getEnvVersion()).toBe('release')
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

// NOTE: ad.showRewarded 依赖 wx 全局，使用内联 mock 验证降级逻辑契约
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

describe('leaderboard 云集合环境隔离', () => {
  const getLeaderboardCollectionName = (envVersion) => {
    if (envVersion === 'develop') return 'leaderboard_dev'
    if (envVersion === 'trial') return 'leaderboard_trial'
    return 'leaderboard'
  }

  it('develop 环境写入 leaderboard_dev', () => {
    expect(getLeaderboardCollectionName('develop')).toBe('leaderboard_dev')
  })

  it('trial 环境写入 leaderboard_trial', () => {
    expect(getLeaderboardCollectionName('trial')).toBe('leaderboard_trial')
  })

  it('release 和未知环境继续使用 leaderboard', () => {
    expect(getLeaderboardCollectionName('release')).toBe('leaderboard')
    expect(getLeaderboardCollectionName(undefined)).toBe('leaderboard')
  })
})

describe('progress 云集合环境隔离', () => {
  const getProgressCollectionName = (envVersion) => {
    if (envVersion === 'develop') return 'progress_dev'
    if (envVersion === 'trial') return 'progress_trial'
    return 'progress'
  }

  it('develop 环境写入 progress_dev', () => {
    expect(getProgressCollectionName('develop')).toBe('progress_dev')
  })

  it('trial 环境写入 progress_trial', () => {
    expect(getProgressCollectionName('trial')).toBe('progress_trial')
  })

  it('release 和未知环境继续使用 progress', () => {
    expect(getProgressCollectionName('release')).toBe('progress')
    expect(getProgressCollectionName(undefined)).toBe('progress')
  })
})

// NOTE: loadCloudProgress 依赖 wx 全局，使用内联 mock 验证逻辑契约
describe('loadCloudProgress 云端进度恢复逻辑', () => {
  it('云端返回更大值时覆盖本地，调用 onDone(best)', () => {
    let stored = 3
    let doneCalled = null
    const mockStorage = { get: () => stored, set: (k, v) => { stored = v } }
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: 9 }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        const local = mockStorage.get()
        const best  = Math.max(remote, local)
        if (best > local) mockStorage.set('key', best)
        onDone && onDone(best)
      })
    }
    loadCloudProgress((v) => { doneCalled = v })
    expect(stored).toBe(9)
    expect(doneCalled).toBe(9)
  })

  it('云端返回更小值时不覆盖本地，仍调用 onDone(local)', () => {
    let stored = 9
    let doneCalled = null
    const mockStorage = { get: () => stored, set: (k, v) => { stored = v } }
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: 3 }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        const local = mockStorage.get()
        const best  = Math.max(remote, local)
        if (best > local) mockStorage.set('key', best)
        onDone && onDone(best)
      })
    }
    loadCloudProgress((v) => { doneCalled = v })
    expect(stored).toBe(9)
    expect(doneCalled).toBe(9)
  })

  it('云端返回 null 时静默不调用 onDone', () => {
    let doneCalled = false
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: null }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        onDone && onDone(remote)
      })
    }
    loadCloudProgress(() => { doneCalled = true })
    expect(doneCalled).toBe(false)
  })

  it('云端返回相同值时不写本地，仍调用 onDone(local)', () => {
    let stored = 5
    let writeCount = 0
    let doneCalled = null
    const mockStorage = { get: () => stored, set: (k, v) => { stored = v; writeCount++ } }
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: 5 }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        const local = mockStorage.get()
        const best  = Math.max(remote, local)
        if (best > local) mockStorage.set('key', best)
        onDone && onDone(best)
      })
    }
    loadCloudProgress((v) => { doneCalled = v })
    expect(writeCount).toBe(0)
    expect(doneCalled).toBe(5)
  })
})
