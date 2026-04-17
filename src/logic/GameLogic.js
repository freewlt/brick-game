// 游戏核心逻辑 - 赢了个赢（关卡制，无倒计时）
import { CONFIG } from '../config.js'

export default class GameLogic {
  constructor() {
    this.reset()
  }

  reset() {
    this.level      = 0
    this.score      = 0
    this.combo      = 0
    this.carsWon    = 0
    this.moves      = 0
    this.maxMoves   = 0
    this.totalCars  = 0
    this.slot       = []
    this.board      = []
    this.gameOver   = false
    this.win        = false
    this._idCounter = 0
    // ② 撤销
    this.undoStack  = []    // 最多保留1个快照
    this.undoLeft   = 1     // 每关1次
    // ③ 插槽高亮（供 GameScene 读取）
    this.lastInsertIdx = -1
  }

  // ========== 关卡初始化 ==========
  initLevel(levelIdx) {
    this.reset()
    this.level = levelIdx
    const cfg = CONFIG.LEVELS[Math.min(levelIdx, CONFIG.LEVELS.length - 1)]
    this.maxMoves = cfg.maxMoves || 0
    this.undoLeft = 1
    this._buildBoard(cfg)
  }

  _buildBoard(cfg) {
    const cols = CONFIG.BOARD_COLS
    const rows = CONFIG.BOARD_ROWS

    this.board = []
    for (let r = 0; r < rows; r++) {
      const row = []
      for (let c = 0; c < cols; c++) row.push([])
      this.board.push(row)
    }

    const typeCount = cfg.carTypes
    const types = []
    for (let t = 0; t < typeCount; t++) {
      for (let s = 0; s < cfg.setCount; s++) {
        for (let k = 0; k < CONFIG.MATCH_COUNT; k++) {
          types.push(t)
        }
      }
    }
    this.totalCars = types.length
    this._shuffle(types)

    const positions = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) positions.push({ r, c })
    }
    this._shuffle(positions)

    let pidx = 0
    for (const t of types) {
      let placed = false
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[(pidx + i) % positions.length]
        if (this.board[pos.r][pos.c].length < cfg.layerMax) {
          this.board[pos.r][pos.c].push(this._makeCar(t))
          placed = true
          pidx = (pidx + i + 1) % positions.length
          break
        }
      }
      if (!placed) {
        const pos = positions[pidx % positions.length]
        this.board[pos.r][pos.c].push(this._makeCar(t))
        pidx = (pidx + 1) % positions.length
      }
    }
  }

  _makeCar(type) {
    return {
      id:    ++this._idCounter,
      type,
      icon:  CONFIG.CAR_ICONS[type],
      color: CONFIG.COLORS[type],
    }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  destroy() {}

  // ========== ① 遮挡系统 ==========
  // 同列上方任意一行有车 → 本格被遮挡，不可点击
  isBlocked(r, c) {
    if (r === 0) return false
    for (let row = 0; row < r; row++) {
      if (this.board[row][c].length > 0) return true
    }
    return false
  }

  // ========== ② 撤销快照 ==========
  _snapshot() {
    return {
      board:   this.board.map(row => row.map(stack => stack.map(car => ({ ...car })))),
      slot:    this.slot.map(car => ({ ...car })),
      score:   this.score,
      combo:   this.combo,
      carsWon: this.carsWon,
      moves:   this.moves,
    }
  }

  undo() {
    if (this.undoLeft <= 0 || this.undoStack.length === 0) return false
    const snap      = this.undoStack.pop()
    this.board      = snap.board
    this.slot       = snap.slot
    this.score      = snap.score
    this.combo      = snap.combo
    this.carsWon    = snap.carsWon
    this.moves      = snap.moves
    this.gameOver   = false
    this.win        = false
    this.undoLeft--
    this.lastInsertIdx = -1
    return true
  }

  // ========== ③ 槽位同色靠拢 ==========
  _insertToSlot(car) {
    // 找最后一个同色位置，插入其正后方
    let insertIdx = -1
    for (let i = this.slot.length - 1; i >= 0; i--) {
      if (this.slot[i].type === car.type) {
        insertIdx = i + 1
        break
      }
    }
    if (insertIdx === -1) {
      this.slot.push(car)
      this.lastInsertIdx = this.slot.length - 1
    } else {
      this.slot.splice(insertIdx, 0, car)
      this.lastInsertIdx = insertIdx
    }
  }

  // ========== 点击逻辑 ==========
  clickCell(r, c) {
    if (this.gameOver || this.win) return false
    // ① 遮挡检查
    if (this.isBlocked(r, c)) return 'blocked'
    const stack = this.board[r][c]
    if (!stack || stack.length === 0) return false
    if (this.slot.length >= CONFIG.SLOT_MAX) return false

    // ② 存快照（每次只保留最新1个）
    this.undoStack = [this._snapshot()]

    const car = stack[stack.length - 1]
    stack.pop()
    // ③ 同色靠拢插入
    this._insertToSlot({ ...car })
    this.moves++

    this._checkMatch()
    this._checkWin()

    if (!this.win && this.slot.length >= CONFIG.SLOT_MAX && !this._hasMatchInSlot()) {
      this.gameOver = true
      return true
    }
    if (!this.win && this.maxMoves > 0 && this.moves >= this.maxMoves && !this._boardEmpty()) {
      this.gameOver = true
    }

    return true
  }

  _hasMatchInSlot() {
    const count = {}
    for (const car of this.slot) {
      count[car.type] = (count[car.type] || 0) + 1
      if (count[car.type] >= CONFIG.MATCH_COUNT) return true
    }
    return false
  }

  _checkMatch() {
    const count = {}
    for (const car of this.slot) {
      count[car.type] = (count[car.type] || 0) + 1
    }
    for (const type in count) {
      if (count[type] >= CONFIG.MATCH_COUNT) {
        let removed = 0
        this.slot = this.slot.filter(car => {
          if (String(car.type) === String(type) && removed < CONFIG.MATCH_COUNT) {
            removed++
            return false
          }
          return true
        })
        this.carsWon += CONFIG.MATCH_COUNT
        this.combo++
        this.score += CONFIG.SCORE_PER_MATCH + (this.combo - 1) * CONFIG.SCORE_COMBO_BONUS
        this.lastInsertIdx = -1  // 消除后重置高亮
        this._checkMatch()
        return
      }
    }
    this.combo = 0
  }

  _boardEmpty() {
    for (const row of this.board) {
      for (const stack of row) {
        if (stack.length > 0) return false
      }
    }
    return true
  }

  _checkWin() {
    if (this._boardEmpty() && this.slot.length === 0) {
      this.win = true
    }
  }

  // ========== ④ 真实星级评定 ==========
  calcStars() {
    if (!this.win) return 0
    if (this.maxMoves === 0) {
      // 无步数限制：按步均效率（步数 / 总车块数）
      const ratio = this.moves / Math.max(1, this.totalCars)
      if (ratio <= 1.2) return 3
      if (ratio <= 1.8) return 2
      return 1
    }
    // 有步数限制：剩余步数占maxMoves的比例
    const ratio = this.movesLeft / this.maxMoves
    if (ratio >= 0.5) return 3
    if (ratio >= 0.3) return 2
    return 1
  }

  // ========== 查询接口 ==========
  getTopCar(r, c) {
    const stack = this.board[r][c]
    return (stack && stack.length > 0) ? stack[stack.length - 1] : null
  }

  getStackDepth(r, c) {
    return (this.board[r] && this.board[r][c]) ? this.board[r][c].length : 0
  }

  getRemainingCount() {
    let n = this.slot.length
    for (const row of this.board) {
      for (const stack of row) n += stack.length
    }
    return n
  }

  get movesLeft() {
    if (this.maxMoves === 0) return 0
    return Math.max(0, this.maxMoves - this.moves)
  }

  static get totalLevels() {
    return CONFIG.LEVELS.length
  }
}
