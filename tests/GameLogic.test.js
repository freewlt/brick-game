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

    it('第 10 关：8 车型 × 4 组 × 3 块 = 96 辆，maxMoves=116', () => {
      g.initLevel(9)
      expect(g.totalCars).toBe(96)
      expect(g.maxMoves).toBe(116)
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
      expect(g.isBlocked(3, 3)).toBe(true)
      expect(g.isBlocked(3, 4)).toBe(false)
    })
  })
})
