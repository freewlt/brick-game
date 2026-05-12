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
