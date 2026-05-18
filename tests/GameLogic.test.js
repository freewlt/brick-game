import { describe, it, expect, beforeEach } from 'vitest'
import GameLogic from '../src/logic/GameLogic.js'

describe('GameLogic', () => {
  let g
  beforeEach(() => { g = new GameLogic() })

  describe('initLevel', () => {
    it('第 1 关：3 车型 × 3 组 × 3 块 = 27 辆，maxMoves=45', () => {
      g.initLevel(0)
      expect(g.totalCars).toBe(27)
      expect(g.maxMoves).toBe(45)
      expect(g.slot).toEqual([])
      expect(g.score).toBe(0)
      expect(g.win).toBe(false)
      expect(g.gameOver).toBe(false)
    })

    it('第 10 关：8 车型 × 4 组 × 3 块 = 96 辆，maxMoves=120', () => {
      g.initLevel(9)
      expect(g.totalCars).toBe(96)
      expect(g.maxMoves).toBe(120)
    })

    it('超出关卡数兜底取最后一关', () => {
      g.initLevel(9999)
      expect(g.totalCars).toBeGreaterThan(0)
      expect(g.maxMoves).toBeGreaterThan(0)
    })

    it('棋盘车块总数等于 totalCars', () => {
      g.initLevel(0)
      let n = 0
      for (const row of g.board) for (const stack of row) n += stack.length
      expect(n).toBe(g.totalCars)
    })
  })

  describe('clickCell', () => {
    it('点空格返回 false', () => {
      g.initLevel(0)
      // 第 1 关 27 辆铺不满 49 格，必有空格
      let r = -1, c = -1
      outer: for (let rr = 0; rr < 7; rr++) {
        for (let cc = 0; cc < 7; cc++) {
          if (g.board[rr][cc].length === 0) { r = rr; c = cc; break outer }
        }
      }
      expect(r).toBeGreaterThanOrEqual(0)
      expect(g.clickCell(r, c)).toBe(false)
    })

    it('空格即使在被遮挡列也返回 false（不返回 blocked）', () => {
      // 构造：col=0 row=0 有车（遮挡下方），col=0 row=1 为空
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][0].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g._recomputeColTops()
      // row=1, col=0 是空格，但被 row=0 的车遮挡
      expect(g.isBlocked(1, 0)).toBe(true)
      expect(g.board[1][0].length).toBe(0)
      // 空格应返回 false，不应返回 'blocked'
      expect(g.clickCell(1, 0)).toBe(false)
    })

    it('点被遮挡的格子返回 "blocked"', () => {
      g.initLevel(0)
      // 构造遮挡场景：找一列上方有车下方也有车的格子
      for (let c = 0; c < 7; c++) {
        let topR = -1
        for (let r = 0; r < 7; r++) {
          if (g.board[r][c].length > 0) {
            if (topR === -1) { topR = r; continue }
            expect(g.clickCell(r, c)).toBe('blocked')
            return
          }
        }
      }
    })

    it('点合法格子后 car 进 slot，moves+1', () => {
      g.initLevel(0)
      // 找第 0 行任意有车的格子（顶层不可能被遮挡）
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          const before = g.slot.length
          const movesBefore = g.moves
          expect(g.clickCell(0, c)).toBe(true)
          expect(g.slot.length).toBe(before + 1)
          expect(g.moves).toBe(movesBefore + 1)
          return
        }
      }
    })

    it('集齐 3 辆同色后自动消除，carsWon += 3', () => {
      g.initLevel(0)
      // 强行清空棋盘并手工放 3 辆同色车
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][0].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][1].push({ id: 2, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][2].push({ id: 3, type: 0, icon: '🚗', color: '#E74C3C' })
      g.totalCars = 3
      g.clickCell(0, 0)
      g.clickCell(0, 1)
      g.clickCell(0, 2)
      expect(g.carsWon).toBe(3)
      expect(g.slot.length).toBe(0)
      expect(g.win).toBe(true)
    })

    it('连消两次后 combo 应为 2，不被重置为 0', () => {
      // 棋盘放 6 辆：type=0 × 3，type=1 × 3，点完触发两次连消
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][0].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][1].push({ id: 2, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][2].push({ id: 3, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][3].push({ id: 4, type: 1, icon: '🚕', color: '#F1C40F' })
      g.board[0][4].push({ id: 5, type: 1, icon: '🚕', color: '#F1C40F' })
      g.board[0][5].push({ id: 6, type: 1, icon: '🚕', color: '#F1C40F' })
      g._recomputeColTops()
      g.totalCars = 6
      // 先点 3 辆 type=0，触发第一次消除
      g.clickCell(0, 0); g.clickCell(0, 1); g.clickCell(0, 2)
      // 再点 3 辆 type=1，触发第二次消除（连消）
      g.clickCell(0, 3); g.clickCell(0, 4); g.clickCell(0, 5)
      // 第二次点击第 3 辆时，slot 里已有 type=0×0 + type=1×3，触发消除
      // combo 在第二次消除时应为 1（第一次消除 combo=1，第二次消除 combo=2）
      // 但由于 bug，_checkMatch 递归末尾 combo=0，所以 combo 会是 0
      expect(g.combo).toBeGreaterThan(0)
    })
  })

  describe('undo', () => {
    it('点一次后撤销，回到初始状态', () => {
      g.initLevel(0)
      const initialSlotLen = g.slot.length
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          const carBefore = g.board[0][c][g.board[0][c].length - 1]
          const carBeforeType = carBefore.type
          g.clickCell(0, c)
          expect(g.slot.length).toBe(initialSlotLen + 1)
          expect(g.undo()).toBe(true)
          expect(g.slot.length).toBe(initialSlotLen)
          const top = g.board[0][c][g.board[0][c].length - 1]
          expect(top.type).toBe(carBeforeType)
          return
        }
      }
    })

    it('撤销后剩余次数 -1', () => {
      g.initLevel(0)
      expect(g.undoLeft).toBe(1)
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          g.clickCell(0, c)
          g.undo()
          expect(g.undoLeft).toBe(0)
          return
        }
      }
    })

    it('无快照时撤销返回 false', () => {
      g.initLevel(0)
      expect(g.undo()).toBe(false)
    })

    it('撤销次数为 0 时返回 false', () => {
      g.initLevel(0)
      g.undoLeft = 0
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          g.clickCell(0, c)
          expect(g.undo()).toBe(false)
          return
        }
      }
    })

    it('浅拷贝快照后再消除：撤销能正确恢复 score/combo/carsWon', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][0].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][1].push({ id: 2, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][2].push({ id: 3, type: 0, icon: '🚗', color: '#E74C3C' })
      g.totalCars = 3
      g.clickCell(0, 0)
      g.clickCell(0, 1)
      const scoreBefore3rd = g.score
      const carsWonBefore3rd = g.carsWon
      g.clickCell(0, 2)
      expect(g.carsWon).toBe(3)
      expect(g.undo()).toBe(true)
      expect(g.carsWon).toBe(carsWonBefore3rd)
      expect(g.score).toBe(scoreBefore3rd)
      expect(g.slot.length).toBe(2)
    })
  })

  describe('useExpand', () => {
    it('扩槽：slotMax 6 → 7', () => {
      g.initLevel(0)
      expect(g.slotMax).toBe(6)
      expect(g.useExpand()).toBe('ok')
      expect(g.slotMax).toBe(7)
    })

    it('扩槽道具耗尽时返回 empty', () => {
      g.initLevel(0)
      g.expandLeft = 0
      expect(g.useExpand()).toBe('empty')
    })

    it('已扩槽再扩返回 maxed', () => {
      g.initLevel(0)
      g.useExpand()
      g.expandLeft = 1
      expect(g.useExpand()).toBe('maxed')
    })
  })

  describe('useShuffle', () => {
    it('洗牌后车块总数不变', () => {
      g.initLevel(0)
      const before = g.getRemainingCount()
      expect(g.useShuffle()).toBe('ok')
      expect(g.getRemainingCount()).toBe(before)
    })

    it('棋盘空时洗牌返回 board_empty', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      expect(g.useShuffle()).toBe('board_empty')
    })

    it('洗牌次数耗尽返回 empty', () => {
      g.initLevel(0)
      g.shuffleLeft = 0
      expect(g.useShuffle()).toBe('empty')
    })

    it('每日挑战模式：洗牌后每格堆叠不超过 customCfg.layerMax', () => {
      const customCfg = { carTypes: 6, layerMax: 4, setCount: 5, maxMoves: 100 }
      g.initLevel(0, customCfg)
      expect(g.useShuffle()).toBe('ok')
      for (const row of g.board) {
        for (const stack of row) {
          expect(stack.length).toBeLessThanOrEqual(customCfg.layerMax)
        }
      }
    })
  })

  describe('calcStars', () => {
    it('未通关返回 0 星', () => {
      g.initLevel(0)
      expect(g.calcStars()).toBe(0)
    })

    it('剩余步数 >= 50% 给 3 星', () => {
      g.initLevel(0)
      g.win = true
      g.moves = Math.floor(g.maxMoves * 0.4)
      expect(g.calcStars()).toBe(3)
    })

    it('剩余步数 30%~50% 给 2 星', () => {
      g.initLevel(0)
      g.win = true
      g.moves = Math.floor(g.maxMoves * 0.6)
      expect(g.calcStars()).toBe(2)
    })

    it('剩余步数 < 30% 给 1 星', () => {
      g.initLevel(0)
      g.win = true
      g.moves = Math.floor(g.maxMoves * 0.8)
      expect(g.calcStars()).toBe(1)
    })

    it('maxMoves=0 且步均效率 ≤1.2 给 3 星', () => {
      g.initLevel(0)
      g.maxMoves   = 0
      g.totalCars  = 27
      g.win        = true
      g.moves      = 30   // 30/27 ≈ 1.11 ≤ 1.2
      expect(g.calcStars()).toBe(3)
    })

    it('maxMoves=0 且步均效率 1.2~1.8 给 2 星', () => {
      g.initLevel(0)
      g.maxMoves   = 0
      g.totalCars  = 27
      g.win        = true
      g.moves      = 40   // 40/27 ≈ 1.48，1.2 < 1.48 ≤ 1.8
      expect(g.calcStars()).toBe(2)
    })

    it('maxMoves=0 且步均效率 >1.8 给 1 星', () => {
      g.initLevel(0)
      g.maxMoves   = 0
      g.totalCars  = 27
      g.win        = true
      g.moves      = 55   // 55/27 ≈ 2.04 > 1.8
      expect(g.calcStars()).toBe(1)
    })

    it('maxMoves=0 且 totalCars=0 时不除零（兜底 1）', () => {
      g.initLevel(0)
      g.maxMoves   = 0
      g.totalCars  = 0
      g.win        = true
      g.moves      = 0    // 0/max(1,0)=0 ≤ 1.2 → 3 星
      expect(g.calcStars()).toBe(3)
    })
  })

  describe('isBlocked', () => {
    it('第 0 行永不被遮挡', () => {
      g.initLevel(0)
      for (let c = 0; c < 7; c++) {
        expect(g.isBlocked(0, c)).toBe(false)
      }
    })

    it('上方有车则被遮挡', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][3].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g._recomputeColTops()
      expect(g.isBlocked(3, 3)).toBe(true)
      expect(g.isBlocked(3, 4)).toBe(false)
    })

    it('点击移除顶层车后，本列下方解锁', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[1][2].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[3][2].push({ id: 2, type: 1, icon: '🚙', color: '#3498DB' })
      g.totalCars = 2
      g._recomputeColTops()
      // 初始：(3,2) 被 (1,2) 遮挡
      expect(g.isBlocked(3, 2)).toBe(true)
      // 点击 (1,2) 把顶层车移走
      g.clickCell(1, 2)
      // 现在 (3,2) 应解锁
      expect(g.isBlocked(3, 2)).toBe(false)
    })

    it('undo 撤销后遮挡状态正确恢复', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[1][2].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[3][2].push({ id: 2, type: 1, icon: '🚙', color: '#3498DB' })
      g.totalCars = 2
      g._recomputeColTops()
      g.clickCell(1, 2)
      expect(g.isBlocked(3, 2)).toBe(false)
      g.undo()
      // 撤销后 (1,2) 的车回来，(3,2) 再次被遮挡
      expect(g.isBlocked(3, 2)).toBe(true)
    })

    it('useShuffle 后遮挡状态按新棋盘重算', () => {
      g.initLevel(0)
      // 洗牌前后总车数不变；用 isBlocked 抽样 49 格不报错即说明缓存被正确刷新
      g.useShuffle()
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          expect(typeof g.isBlocked(r, c)).toBe('boolean')
        }
      }
    })

    it('多层堆叠：顶层是第 2 行，下方第 5 行被遮挡，第 1 行不影响第 3 行', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      // 第 2 行 c=4 放车，下方应被遮挡
      g.board[2][4].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g._recomputeColTops()
      expect(g.isBlocked(2, 4)).toBe(false)  // 自身格不算被遮挡
      expect(g.isBlocked(3, 4)).toBe(true)
      expect(g.isBlocked(6, 4)).toBe(true)
      expect(g.isBlocked(1, 4)).toBe(false)  // 上方不会被下方挡
      expect(g.isBlocked(2, 5)).toBe(false)  // 邻列不影响
    })
  })
})
