import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ── Mock wxApi.js storage layer ──────────────────────────────────────────────
// storage.js imports { storage } from './wxApi.js'; we replace it with an
// in-memory map so tests never touch wx globals.
vi.mock('../src/utils/wxApi.js', () => {
  const store = new Map()
  return {
    storage: {
      get:  (key, def = null) => (store.has(key) ? store.get(key) : def),
      set:  (key, val)        => { store.set(key, val); return true },
      _store: store,   // exposed for test setup / teardown
    },
    share:   { send: vi.fn(), getLaunchQuery: () => ({}) },
    auth:    { requirePrivacy: () => Promise.resolve(true) },
    cloud:   { call: vi.fn(), setKV: vi.fn(), getFriendKV: vi.fn(), getMyKV: vi.fn() },
    userInfo:{ getBasic: vi.fn(), getProfile: vi.fn() },
    ad:      { createRewarded: () => null },
  }
})

vi.mock('../src/utils/env.js', () => ({
  getEnvPrefix: () => '',
  getEnvVersion: () => 'release',
}))

import { storage } from '../src/utils/wxApi.js'
import {
  getLives,
  spendLife,
  getRecoverSecondsLeft,
  completeDailyChallenge,
  getDailyState,
} from '../src/utils/storage.js'

// Helper: clear the in-memory store before each test
beforeEach(() => { storage._store.clear() })
afterEach(() => { vi.useRealTimers() })

// ── getLives ─────────────────────────────────────────────────────────────────
describe('getLives', () => {
  it('存储为空时返回满机会 3', () => {
    expect(getLives()).toBe(3)
  })

  it('存储 count=2 且未到恢复时间时返回 2', () => {
    const now = Date.now()
    storage.set('ywgy_lives', { count: 2, lastRecover: now, lastSpend: now })
    expect(getLives()).toBe(2)
  })

  it('count=2 且已过 30 分钟后自动恢复到 3', () => {
    vi.useFakeTimers()
    const base = Date.now()
    storage.set('ywgy_lives', { count: 2, lastRecover: base, lastSpend: base })
    vi.setSystemTime(base + 31 * 60 * 1000)   // +31 min
    expect(getLives()).toBe(3)
  })

  it('count=1 且已过 60 分钟后恢复 2 次，但不超过上限 3', () => {
    vi.useFakeTimers()
    const base = Date.now()
    storage.set('ywgy_lives', { count: 1, lastRecover: base, lastSpend: base })
    vi.setSystemTime(base + 61 * 60 * 1000)   // +61 min → 2 recoveries
    expect(getLives()).toBe(3)
  })
})

// ── spendLife ─────────────────────────────────────────────────────────────────
describe('spendLife', () => {
  it('满机会时扣 1 返回 2', () => {
    expect(spendLife()).toBe(2)
  })

  it('count=1 时扣 1 返回 0，不低于 0', () => {
    const now = Date.now()
    storage.set('ywgy_lives', { count: 1, lastRecover: now, lastSpend: now })
    expect(spendLife()).toBe(0)
  })

  it('count=0 时再扣仍返回 0', () => {
    const now = Date.now()
    storage.set('ywgy_lives', { count: 0, lastRecover: now, lastSpend: now })
    expect(spendLife()).toBe(0)
  })
})

// ── getRecoverSecondsLeft ─────────────────────────────────────────────────────
describe('getRecoverSecondsLeft', () => {
  it('机会满时返回 0', () => {
    expect(getRecoverSecondsLeft()).toBe(0)
  })

  it('count=2 刚扣完时返回约 1800 秒', () => {
    vi.useFakeTimers()
    const now = Date.now()
    storage.set('ywgy_lives', { count: 2, lastRecover: now, lastSpend: now })
    // 1 秒后查询，剩余 ≈ 1799 秒
    vi.setSystemTime(now + 1000)
    const secs = getRecoverSecondsLeft()
    expect(secs).toBeGreaterThan(1790)
    expect(secs).toBeLessThanOrEqual(1800)
  })
})

// ── completeDailyChallenge ────────────────────────────────────────────────────
describe('completeDailyChallenge', () => {
  // Fix "today" to 2026-05-15 and "yesterday" to 2026-05-14
  const TODAY     = '20260515'
  const YESTERDAY = '20260514'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T10:00:00'))
  })

  it('首次通关：streak=1，dailyWins=1，played=true，won=true', () => {
    const state = completeDailyChallenge(true)
    expect(state.played).toBe(true)
    expect(state.won).toBe(true)
    expect(state.streak).toBe(1)
    expect(state.dailyWins).toBe(1)
    expect(state.date).toBe(TODAY)
  })

  it('首次失败：streak=0，dailyWins 不变，played=true，won=false', () => {
    const state = completeDailyChallenge(false)
    expect(state.played).toBe(true)
    expect(state.won).toBe(false)
    expect(state.streak).toBe(0)
    expect(state.dailyWins).toBe(0)
  })

  it('昨天赢了今天再赢：streak 累加', () => {
    // 预置昨天已赢的状态（date=昨天，streak=3，lastWonDate=昨天）
    storage.set('ywgy_daily', {
      date:        YESTERDAY,
      played:      true,
      won:         true,
      streak:      3,
      dailyWins:   5,
      lastWonDate: YESTERDAY,
    })
    const state = completeDailyChallenge(true)
    expect(state.streak).toBe(4)
    expect(state.dailyWins).toBe(6)
  })

  it('昨天没赢今天赢：streak 重置为 1', () => {
    // 上次赢是两天前
    storage.set('ywgy_daily', {
      date:        YESTERDAY,
      played:      true,
      won:         false,
      streak:      3,
      dailyWins:   5,
      lastWonDate: '20260513',
    })
    const state = completeDailyChallenge(true)
    expect(state.streak).toBe(1)
    expect(state.dailyWins).toBe(6)
  })

  it('今天已完成时重复调用不改变状态', () => {
    // 先完成一次
    completeDailyChallenge(true)
    const first = getDailyState()
    // 再调用一次（应被幂等保护）
    completeDailyChallenge(false)
    const second = getDailyState()
    expect(second.streak).toBe(first.streak)
    expect(second.won).toBe(first.won)
  })

  it('失败后 streak 清零', () => {
    storage.set('ywgy_daily', {
      date:        YESTERDAY,
      played:      true,
      won:         true,
      streak:      5,
      dailyWins:   8,
      lastWonDate: YESTERDAY,
    })
    const state = completeDailyChallenge(false)
    expect(state.streak).toBe(0)
    expect(state.dailyWins).toBe(8)   // 失败不增加 dailyWins
  })
})
