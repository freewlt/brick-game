// 游戏主场景 - 赢了个赢（关卡制）
import GameLogic from '../logic/GameLogic.js'
import { CONFIG } from '../config.js'
import { roundRect } from '../utils/draw.js'
import AudioManager from '../utils/audio.js'
import { addExtraProp, SHARE_CONFIG } from '../utils/storage.js'

// 飘字动画
class FloatText {
  constructor(text, x, y, color = '#FFD700') {
    this.text = text; this.x = x; this.y = y
    this.color = color; this.alpha = 1; this.vy = -2; this.life = 60
  }
  update() { this.y += this.vy; this.vy *= 0.95; this.life--; this.alpha = this.life / 60 }
  isDead()  { return this.life <= 0 }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = this.color
    ctx.fillText(this.text, this.x, this.y)
    ctx.restore()
  }
}

// 消除粒子
class MatchParticle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color
    this.vx = (Math.random() - 0.5) * 8
    this.vy = (Math.random() - 0.5) * 8 - 3
    this.alpha = 1; this.r = 4 + Math.random() * 4; this.life = 40
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.vy += 0.3
    this.life--; this.alpha = this.life / 40
  }
  isDead() { return this.life <= 0 }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha = this.alpha
    ctx.fillStyle = this.color
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
}

// 辅助：将 '#RRGGBB' 转为 'R,G,B' 字符串（用于 rgba() 拼接）
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

export default class GameScene {
  constructor(game, levelIdx = 0) {
    this.game = game
    this.startLevel = levelIdx
    this.logic = new GameLogic()
    this.floatTexts   = []
    this.particles    = []
    this.selectedCell = null
    this.shake        = 0
    this.lastCarsWon  = 0
    this.lastSlotLen  = 0
    this.frame        = 0
    this._resultScheduled = false
    this._levelFlash  = 0
    this._undoBtn     = null
    this._undoFlash   = 0
    this._insertFlash = 0
    this._insertIdx   = -1
    this._propBtns    = []    // [{type,x,y,w,h}] 每帧重建
    this._propFlash   = null  // {type, frame} 按钮点亮动画
    this._adModal     = null  // 获取道具弹层 {type, ...btnRects}
    this._shuffleAnim = 0     // 洗牌棋盘绿光帧计数
    this._expandAnim  = 0     // 扩槽第7格弹入帧计数
  }

  init() {
    this.logic.initLevel(this.startLevel)
    this.lastCarsWon  = 0
    this.lastSlotLen  = 0
    this._resultScheduled = false
    this._levelFlash  = 40
    this._undoBtn     = null
    this._undoFlash   = 0
    this._insertFlash = 0
    this._insertIdx   = -1
    this._propBtns    = []
    this._propFlash   = null
    this._adModal     = null
    this._shuffleAnim = 0
    this._expandAnim  = 0
    AudioManager.playBGM()
  }

  // ========== 自适应布局 ==========
  // 整体布局（从上到下）：
  //   0 ~ 88px              系统状态栏 + 胶囊按钮（不可用区域）
  //   88 ~ headerH          Header：两行紧凑信息
  //   headerH ~ boardTop    棋盘上方间距
  //   boardTop ~ slotTop    棋盘区（7行）
  //   slotTop ~ slotBottom  槽位行（1行）
  //   slotBottom ~ H        底部面板（combo/提示/装饰）
  get cellGap()    { return 4 }
  get cellStep()   { return this.cellSize + this.cellGap }
  get safeTop()    { return this.game.safeTop }          // 动态安全顶，来自 game.js
  get headerH()    { return this.game.safeTop + 82 }     // 安全区 + 两行内容(82px)
  get boardTop()   { return this.headerH + 20 }   // header → 棋盘 间距 20px
  get boardH()     { return CONFIG.BOARD_ROWS * this.cellStep }
  get slotTop()    { return this.boardTop + this.boardH + 22 }
  get propBtnTop() { return this.slotTop + this.cellSize + 8 }   // 道具按钮行
  get propBtnH()   { return 44 }
  get bottomPanelTop() { return this.propBtnTop + this.propBtnH + 6 }  // 往下移

  get cellSize() {
    // 宽度优先：按列数计算最大格子尺寸
    const pad      = 10 * 2
    const colGaps  = (CONFIG.BOARD_COLS - 1) * this.cellGap
    const byWidth  = Math.floor((this.game.width - pad - colGaps) / CONFIG.BOARD_COLS)
    return byWidth
  }

  get boardLeft() {
    const totalW = CONFIG.BOARD_COLS * this.cellStep - this.cellGap
    return Math.floor((this.game.width - totalW) / 2)
  }
  get slotLeft() {
    const slotMax = this.logic ? this.logic.slotMax : CONFIG.SLOT_MAX
    const totalW  = slotMax * this.cellStep - this.cellGap
    return Math.floor((this.game.width - totalW) / 2)
  }

  cellXY(r, c) {
    return { x: this.boardLeft + c * this.cellStep, y: this.boardTop + r * this.cellStep }
  }
  slotXY(idx) {
    return { x: this.slotLeft + idx * this.cellStep, y: this.slotTop }
  }

  // ========== 更新 ==========
  update() {
    this.frame++
    if (this._levelFlash > 0) this._levelFlash--
    if (this._undoFlash  > 0) this._undoFlash--
    if (this._insertFlash > 0) this._insertFlash--
    if (this._shuffleAnim > 0) this._shuffleAnim--
    if (this._expandAnim  > 0) this._expandAnim--
    if (this._propFlash && this._propFlash.frame > 0) this._propFlash.frame--

    this.floatTexts = this.floatTexts.filter(t => { t.update(); return !t.isDead() })
    this.particles  = this.particles.filter(p  => { p.update();  return !p.isDead()  })
    if (this.shake > 0) this.shake--

    const logic = this.logic

    if (logic.lastInsertIdx >= 0 && this._insertFlash <= 0) {
      this._insertIdx   = logic.lastInsertIdx
      this._insertFlash = 14
    }

    if (logic.carsWon > this.lastCarsWon) {
      const gained = logic.carsWon - this.lastCarsWon
      const cx = this.game.width / 2
      const cy = this.slotTop + this.cellSize / 2
      this.floatTexts.push(new FloatText(`+${gained} 🚗`, cx, cy, '#FFD700'))
      if (logic.combo > 1) {
        this.floatTexts.push(new FloatText(`连消 ×${logic.combo}!`, cx, cy - 34, '#FF6B35'))
        AudioManager.playCombo(logic.combo)
      } else {
        AudioManager.playMatch()
      }
      for (let i = 0; i < 18; i++) {
        this.particles.push(new MatchParticle(cx, cy,
          CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)]))
      }
      this.lastCarsWon = logic.carsWon
    }

    if (logic.slot.length >= logic.slotMax && logic.slot.length > this.lastSlotLen) {
      this.shake = 16
      AudioManager.playSlotFull()
    }
    this.lastSlotLen = logic.slot.length

    if ((logic.gameOver || logic.win) && !this._resultScheduled) {
      this._resultScheduled = true
      const stars = logic.calcStars()
      if (logic.win) AudioManager.playWin()
      else           AudioManager.playLose()
      setTimeout(() => {
        this.game.showResult(logic.score, logic.carsWon, logic.level, logic.win, stars)
      }, 1000)
    }
  }

  // ========== 绘制 ==========
  draw() {
    const { ctx, width, height } = this.game
    const logic = this.logic

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * 5 : 0
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * 5 : 0
    ctx.save()
    ctx.translate(shakeX, shakeY)

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, height)
    bg.addColorStop(0, '#080c18')
    bg.addColorStop(0.5, '#0d1020')
    bg.addColorStop(1, '#0a0d1a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // ── 棋盘区棋格背景纹理 ──
    this._drawGridTexture(ctx)

    this._drawHeader(ctx, width, logic)
    this._drawBoard(ctx, logic)
    this._drawDivider(ctx, width, logic)
    this._drawSlot(ctx, logic)
    this._drawPropBtns(ctx, width, logic)      // 道具按钮行
    this._drawBottomPanel(ctx, width, height, logic)

    this.particles.forEach(p => p.draw(ctx))
    this.floatTexts.forEach(t => t.draw(ctx))

    // 洗牌绿色光晕
    if (this._shuffleAnim > 0) {
      ctx.save()
      ctx.globalAlpha = (this._shuffleAnim / 20) * 0.22
      ctx.fillStyle = '#81C784'
      ctx.fillRect(this.boardLeft - 6, this.boardTop - 6,
        CONFIG.BOARD_COLS * this.cellStep + 12,
        CONFIG.BOARD_ROWS * this.cellStep + 12)
      ctx.restore()
    }

    if (this._undoFlash > 0) {
      ctx.save()
      ctx.globalAlpha = this._undoFlash / 18 * 0.4
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    if (this._levelFlash > 0) {
      ctx.save()
      ctx.globalAlpha = this._levelFlash / 40 * 0.35
      ctx.fillStyle = '#FFD700'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    if (logic.win)           this._drawWin(ctx, width, height)
    else if (logic.gameOver) this._drawGameOver(ctx, width, height)

    // 道具获取弹层（最后渲染，覆盖在最上层）
    if (this._adModal) this._drawAdModal(ctx, width, height)

    ctx.restore()
  }

  // ========== Header：紧凑两行，位于系统胶囊下方 ==========
  _drawHeader(ctx, width, logic) {
    const levelNum  = logic.level + 1
    const progress  = logic.totalCars > 0
      ? 1 - logic.getRemainingCount() / logic.totalCars : 1
    const hasLimit  = logic.maxMoves > 0
    const movesLeft = logic.movesLeft
    const isWarn    = hasLimit && movesLeft <= 10
    const padX      = 12
    const safe      = this.safeTop   // 88px，系统按钮下方

    // ── Header 背景：深色 + 底部彩虹渐变光条 ──
    ctx.save()
    ctx.fillStyle = 'rgba(8,10,22,0.99)'
    ctx.fillRect(0, 0, width, this.headerH)

    // 底部装饰光条（彩虹细线）
    const rainbow = ctx.createLinearGradient(0, 0, width, 0)
    rainbow.addColorStop(0,    'rgba(255,80,80,0)')
    rainbow.addColorStop(0.15, 'rgba(255,140,0,0.55)')
    rainbow.addColorStop(0.35, 'rgba(255,215,0,0.70)')
    rainbow.addColorStop(0.55, 'rgba(50,220,120,0.60)')
    rainbow.addColorStop(0.75, 'rgba(80,160,255,0.55)')
    rainbow.addColorStop(0.9,  'rgba(180,80,255,0.45)')
    rainbow.addColorStop(1,    'rgba(180,80,255,0)')
    ctx.fillStyle = rainbow
    ctx.fillRect(0, this.headerH - 2, width, 2)

    // 顶部极细高光线（增加质感）
    const topLine = ctx.createLinearGradient(0, 0, width, 0)
    topLine.addColorStop(0,   'rgba(255,255,255,0)')
    topLine.addColorStop(0.3, 'rgba(255,255,255,0.06)')
    topLine.addColorStop(0.7, 'rgba(255,255,255,0.06)')
    topLine.addColorStop(1,   'rgba(255,255,255,0)')
    ctx.fillStyle = topLine
    ctx.fillRect(0, 0, width, 1)
    ctx.restore()

    // ── 第一行（safe + 15px 居中）：关卡胶囊 + 进度条 ──
    const row1Y = safe + 15   // row1 内容中线 y = 103

    // 关卡胶囊（左侧）
    const lvlW = 72, lvlH = 24, lvlX = padX, lvlY = row1Y - lvlH / 2
    ctx.save()
    ctx.fillStyle   = 'rgba(255,215,0,0.13)'
    ctx.strokeStyle = 'rgba(255,215,0,0.4)'
    ctx.lineWidth   = 1
    roundRect(ctx, lvlX, lvlY, lvlW, lvlH, 12); ctx.fill(); ctx.stroke()
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🏆', lvlX + 12, row1Y)
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = '#FFD700'
    ctx.textAlign = 'left'
    ctx.fillText(`第${levelNum}关`, lvlX + 23, row1Y)
    ctx.restore()

    // 进度条（胶囊右侧到右边距）
    const pbX = lvlX + lvlW + 8, pbW = width - pbX - padX, pbH = 5
    const pbY = row1Y - pbH / 2
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, pbX, pbY, pbW, pbH, 3); ctx.fill()

    if (progress <= 0) {
      // 进度0%：展示星级目标（3颗星图标代替进度条）
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,215,0,0.55)'
      ctx.fillText('目标 ⭐⭐⭐', pbX + 4, row1Y)
    } else {
      const pg = ctx.createLinearGradient(pbX, 0, pbX + pbW, 0)
      pg.addColorStop(0, '#FFD700'); pg.addColorStop(1, '#2ECC71')
      ctx.fillStyle = pg
      roundRect(ctx, pbX, pbY, Math.max(pbH, pbW * progress), pbH, 3); ctx.fill()
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText(`${Math.round(progress * 100)}%`, pbX + pbW, row1Y)
    }
    ctx.restore()

    // ── 第二行（row1Y + 34px）：得分 | 赢车 | 步数 | 撤销按钮 ──
    const row2Y = row1Y + 34   // row2 内容中线 y = 137

    const canUndo = logic.undoLeft > 0 && logic.undoStack.length > 0
    // 右侧：撤销按钮（音效已移到第一行圆形按钮）
    const btnH = 26, btnR = 13
    const undoW = 66
    const undoX = width - padX - undoW, undoY = row2Y - btnH / 2

    const dataW = undoX - padX - 6
    const colW  = dataW / 3

    const cols = [
      { label: '得分',  value: `${logic.score}`,    vc: '#FFD700',  lc: 'rgba(255,215,0,0.45)' },
      { label: '赢车',  value: `x${logic.carsWon}`, vc: '#a0d8ef',  lc: 'rgba(160,216,239,0.45)' },
      { label: hasLimit ? '剩余步' : '已用步',
        value: hasLimit ? `${movesLeft}` : `${logic.moves}`,
        vc: isWarn ? '#FF4444' : '#7FFFD4',
        lc: isWarn ? 'rgba(255,80,80,0.6)' : 'rgba(127,255,212,0.45)' },
    ]

    cols.forEach((col, i) => {
      const cx2 = padX + i * colW + colW / 2
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '9px sans-serif'
      ctx.fillStyle = col.lc
      ctx.fillText(col.label, cx2, row2Y - 8)
      const warnBig = i === 2 && isWarn && this.frame % 30 < 15
      ctx.font = `bold ${warnBig ? 16 : 14}px sans-serif`
      ctx.fillStyle = col.vc
      ctx.fillText(col.value, cx2, row2Y + 8)
      ctx.restore()
    })

    // 撤销按钮（右边）
    ctx.save()
    ctx.fillStyle   = canUndo ? 'rgba(255,215,0,0.15)' : 'rgba(60,60,60,0.15)'
    ctx.strokeStyle = canUndo ? 'rgba(255,215,0,0.4)'  : 'rgba(80,80,80,0.25)'
    ctx.lineWidth   = 1
    roundRect(ctx, undoX, undoY, undoW, btnH, btnR); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = canUndo ? '#FFD700' : '#444'
    ctx.fillText(`↩ 撤销 x${logic.undoLeft}`, undoX + undoW / 2, row2Y)
    ctx.restore()
    this._undoBtn = { x: undoX, y: undoY, w: undoW, h: btnH }
  }

  _drawDivider(ctx, width, logic) {
    const y = this.slotTop - 8
    ctx.save()
    ctx.strokeStyle = 'rgba(255,215,0,0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 5])
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(width - 10, y); ctx.stroke()
    ctx.setLineDash([])

    ctx.font = '10px sans-serif'
    ctx.fillStyle = 'rgba(255,215,0,0.38)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(`槽 ${logic.slot.length}/${logic.slotMax}`, 10, y)

    // 右侧显示槽满警告
    if (logic.slot.length >= logic.slotMax) {
      const warn = this.frame % 30 < 15
      ctx.textAlign = 'right'
      ctx.fillStyle = warn ? 'rgba(255,80,80,0.8)' : 'rgba(255,80,80,0.4)'
      ctx.fillText('槽位已满!', width - 10, y)
    }
    ctx.restore()
  }

  // ========== 棋盘格纹理背景 ==========
  _drawGridTexture(ctx) {
    const step = this.cellStep
    const bL   = this.boardLeft
    const bT   = this.boardTop

    ctx.save()
    // 棋盘区整体淡色背景块（增加区域感）
    const totalW = CONFIG.BOARD_COLS * step - this.cellGap
    const totalH = CONFIG.BOARD_ROWS * step - this.cellGap
    ctx.fillStyle = 'rgba(255,255,255,0.025)'
    roundRect(ctx, bL - 6, bT - 6, totalW + 12, totalH + 12, 12); ctx.fill()

    // 画细格线（只绘竖线和横线，不铺满，保留空气感）
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth   = 0.5

    for (let c = 0; c <= CONFIG.BOARD_COLS; c++) {
      const x = bL + c * step - this.cellGap / 2
      ctx.beginPath(); ctx.moveTo(x, bT - 4); ctx.lineTo(x, bT + totalH + 4); ctx.stroke()
    }
    for (let r = 0; r <= CONFIG.BOARD_ROWS; r++) {
      const y = bT + r * step - this.cellGap / 2
      ctx.beginPath(); ctx.moveTo(bL - 4, y); ctx.lineTo(bL + totalW + 4, y); ctx.stroke()
    }

    ctx.restore()
  }

  // ========== 方案一（精简）：车块主体 ==========
  _drawBoard(ctx, logic) {
    const sz = this.cellSize
    for (let r = 0; r < CONFIG.BOARD_ROWS; r++) {
      for (let c = 0; c < CONFIG.BOARD_COLS; c++) {
        const { x, y } = this.cellXY(r, c)
        const depth   = logic.getStackDepth(r, c)
        const topCar  = logic.getTopCar(r, c)
        const blocked = depth > 0 && logic.isBlocked(r, c)
        const canTap  = depth > 0 && !blocked   // 可点击

        // 格子底板
        ctx.save()
        ctx.fillStyle = depth > 0
          ? (blocked ? 'rgba(20,20,28,0.6)' : 'rgba(255,255,255,0.07)')
          : 'rgba(255,255,255,0.03)'
        roundRect(ctx, x, y, sz, sz, 7); ctx.fill()
        ctx.strokeStyle = blocked ? 'rgba(60,60,70,0.3)' : 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1; ctx.stroke()
        ctx.restore()

        if (!topCar) continue

        // 堆叠层数偏移阴影
        if (depth >= 2) {
          const layers = Math.min(depth - 1, 2)
          for (let l = layers - 1; l >= 0; l--) {
            const off = (l + 1) * 3
            ctx.save()
            ctx.fillStyle = 'rgba(0,0,0,0.25)'
            roundRect(ctx, x + off, y + off, sz, sz, 7); ctx.fill()
            ctx.restore()
          }
        }

        const isSel = this.selectedCell &&
          this.selectedCell.r === r && this.selectedCell.c === c

        ctx.save()
        ctx.translate(x + sz / 2, y + sz / 2)
        if (isSel) ctx.scale(1.07, 1.07)

        // 被遮挡：整体降低饱和度 + 透明度
        if (blocked) {
          ctx.globalAlpha = 0.42
          ctx.filter = 'saturate(0.35) brightness(0.7)'
        }

        // 主色块
        ctx.fillStyle = topCar.color
        roundRect(ctx, -sz/2, -sz/2, sz, sz, 8); ctx.fill()

        // 顶部高光（仅上1/3）
        const hg = ctx.createLinearGradient(0, -sz/2, 0, -sz/2 + sz * 0.36)
        hg.addColorStop(0, 'rgba(255,255,255,0.30)')
        hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = hg
        roundRect(ctx, -sz/2, -sz/2, sz, sz * 0.36, 8); ctx.fill()

        // 被遮挡时覆盖灰色蒙版，进一步压暗
        if (blocked) {
          ctx.fillStyle = 'rgba(0,0,8,0.35)'
          roundRect(ctx, -sz/2, -sz/2, sz, sz, 8); ctx.fill()
        }

        // emoji 图标
        ctx.font = `${sz * 0.46}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(topCar.icon, 0, 0)

        // 堆叠数（右上角）
        if (depth > 1) {
          ctx.font = `bold ${Math.max(9, sz * 0.21)}px sans-serif`
          ctx.textAlign = 'right'; ctx.textBaseline = 'top'
          ctx.fillStyle = blocked ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.9)'
          ctx.fillText(`×${depth}`, sz/2 - 2, -sz/2 + 2)
        }

        // 遮挡锁（右下角）
        if (blocked) {
          ctx.font = `${sz * 0.24}px sans-serif`
          ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
          ctx.fillText('🔒', sz/2 - 2, sz/2 - 2)
        }

        ctx.restore()   // ← filter/alpha reset 完毕，回到正常状态

        // 可点击车块：外发光边框（在 restore 之后画，不受 filter 影响）
        if (canTap && !isSel) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'
          ctx.lineWidth   = 1.5
          ctx.shadowColor = 'rgba(255,255,255,0.28)'
          ctx.shadowBlur  = 6
          roundRect(ctx, x, y, sz, sz, 8); ctx.stroke()
          ctx.restore()
        }

        // 选中高亮（在 restore 之后画）
        if (isSel && !blocked) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'
          ctx.lineWidth   = 2.5
          ctx.shadowColor = 'rgba(255,255,255,0.6)'
          ctx.shadowBlur  = 10
          roundRect(ctx, x, y, sz, sz, 8); ctx.stroke()
          ctx.restore()
        }
      }
    }
  }

  _drawSlot(ctx, logic) {
    const sz      = this.cellSize
    const slotMax = logic.slotMax   // 扩槽后可能是7
    for (let i = 0; i < slotMax; i++) {
      const { x, y } = this.slotXY(i)
      const car      = logic.slot[i]
      const isFlash  = (this._insertFlash > 0 && i === this._insertIdx)
      // 扩槽第7格弹入动画
      const isNewSlot = (slotMax === CONFIG.SLOT_MAX_EXPANDED && i === CONFIG.SLOT_MAX_EXPANDED - 1)
      const expandScale = isNewSlot && this._expandAnim > 0
        ? 0.6 + 0.4 * (1 - this._expandAnim / 18) : 1

      ctx.save()
      if (expandScale < 1) {
        ctx.translate(x + sz / 2, y + sz / 2)
        ctx.scale(expandScale, expandScale)
        ctx.translate(-(x + sz / 2), -(y + sz / 2))
      }

      // 槽位底框
      ctx.strokeStyle = car ? 'rgba(255,215,0,0.4)' : (isNewSlot ? 'rgba(79,195,247,0.5)' : 'rgba(255,255,255,0.12)')
      ctx.lineWidth   = isNewSlot ? 2 : 1.5
      ctx.setLineDash(car ? [] : [3, 3])
      ctx.fillStyle   = car ? 'rgba(255,215,0,0.04)' : (isNewSlot ? 'rgba(79,195,247,0.06)' : 'rgba(255,255,255,0.025)')
      roundRect(ctx, x, y, sz, sz, 7); ctx.fill(); ctx.stroke()
      ctx.setLineDash([])

      if (car) {
        if (isFlash) ctx.globalAlpha = 0.85 + 0.15 * this._insertFlash / 14
        ctx.fillStyle = car.color
        roundRect(ctx, x, y, sz, sz, 7); ctx.fill()
        const hg = ctx.createLinearGradient(x, y, x, y + sz * 0.36)
        hg.addColorStop(0, 'rgba(255,255,255,0.28)')
        hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = hg
        roundRect(ctx, x, y, sz, sz * 0.36, 7); ctx.fill()
        if (isFlash) {
          ctx.strokeStyle = `rgba(255,255,255,${0.85 * this._insertFlash / 14})`
          ctx.lineWidth   = 2
          roundRect(ctx, x, y, sz, sz, 7); ctx.stroke()
        }
        ctx.font = `${sz * 0.44}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(car.icon, x + sz / 2, y + sz / 2)
      } else {
        ctx.font = `${Math.max(9, sz * 0.21)}px sans-serif`
        ctx.fillStyle = isNewSlot ? 'rgba(79,195,247,0.4)' : 'rgba(255,255,255,0.1)'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(isNewSlot ? '＋' : `${i + 1}`, x + sz / 2, y + sz / 2)
      }
      ctx.restore()
    }
  }

  // ========== 道具按钮行 ==========
  _drawPropBtns(ctx, width, logic) {
    const y    = this.propBtnTop
    const h    = this.propBtnH
    const btnW = Math.floor((width - 48) / 2)
    const gap  = 12
    const startX = Math.floor((width - (btnW * 2 + gap)) / 2)

    this._propBtns = []

    const defs = [
      {
        type:  'expand',
        icon:  '➕',
        label: '扩槽',
        sub:   logic.slotMax > CONFIG.SLOT_MAX ? '已激活' : `×${logic.expandLeft}`,
        left:  logic.expandLeft,
        maxed: logic.slotMax >= CONFIG.SLOT_MAX_EXPANDED,
        color: '#4FC3F7',
      },
      {
        type:  'shuffle',
        icon:  '🔀',
        label: '洗牌',
        sub:   `×${logic.shuffleLeft}`,
        left:  logic.shuffleLeft,
        maxed: false,
        color: '#81C784',
      },
    ]

    defs.forEach((def, i) => {
      const x     = startX + i * (btnW + gap)
      const empty = def.left <= 0
      const flash = this._propFlash && this._propFlash.type === def.type && this._propFlash.frame > 0
      const activated = def.type === 'expand' && def.maxed

      this._propBtns.push({ type: def.type, x, y, w: btnW, h })

      // 十六进制色转 rgb 字符串
      const rgb = hexToRgb(def.color)

      ctx.save()
      // 背景
      ctx.fillStyle = flash
        ? `rgba(${rgb},0.45)`
        : (empty ? 'rgba(35,35,45,0.7)' : `rgba(${rgb},0.12)`)
      ctx.strokeStyle = flash
        ? `rgba(${rgb},1)`
        : (empty ? 'rgba(80,80,95,0.4)' : (activated ? `rgba(${rgb},0.9)` : `rgba(${rgb},0.5)`))
      ctx.lineWidth = flash || activated ? 2 : 1.5
      roundRect(ctx, x, y, btnW, h, 12); ctx.fill(); ctx.stroke()

      // 激活态顶部亮线
      if (activated && !empty) {
        const ag = ctx.createLinearGradient(x, y, x + btnW, y)
        ag.addColorStop(0,   `rgba(${rgb},0)`)
        ag.addColorStop(0.5, `rgba(${rgb},0.7)`)
        ag.addColorStop(1,   `rgba(${rgb},0)`)
        ctx.fillStyle = ag
        ctx.fillRect(x + 12, y, btnW - 24, 2)
      }
      ctx.restore()

      // 图标（独立 save 避免被裁剪）
      ctx.save()
      ctx.globalAlpha = empty ? 0.3 : 1
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(def.icon, x + 28, y + h / 2)
      ctx.restore()

      // 文字
      ctx.save()
      ctx.globalAlpha = empty ? 0.35 : 1
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.font = `bold 14px sans-serif`
      ctx.fillStyle = empty ? '#666' : (flash ? '#fff' : def.color)
      ctx.fillText(def.label, x + 46, y + h / 2 - 8)
      ctx.font = '11px sans-serif'
      ctx.fillStyle = empty ? '#555' : 'rgba(255,255,255,0.55)'
      ctx.fillText(empty ? '已用完' : def.sub, x + 46, y + h / 2 + 9)
      ctx.restore()

      // 用完时右侧「+获取」角标
      if (empty) {
        const tagX = x + btnW - 36, tagY = y + h / 2 - 10, tagW = 32, tagH = 20
        ctx.save()
        ctx.fillStyle   = 'rgba(255,180,0,0.18)'
        ctx.strokeStyle = 'rgba(255,180,0,0.5)'
        ctx.lineWidth = 1
        roundRect(ctx, tagX, tagY, tagW, tagH, 6); ctx.fill(); ctx.stroke()
        ctx.font = '10px sans-serif'
        ctx.fillStyle   = '#FFD700'
        ctx.textAlign   = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('+获取', tagX + tagW / 2, tagY + tagH / 2)
        ctx.restore()
      }
    })
  }

  // ========== 获取道具弹层 ==========
  _drawAdModal(ctx, width, height) {
    if (!this._adModal) return
    const { type } = this._adModal
    const typeLabel = type === 'expand' ? '➕ 扩槽' : '🔀 洗牌'

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,10,0.75)'
    ctx.fillRect(0, 0, width, height)

    const cw = width - 48, ch = 230
    const cx = (width - cw) / 2, cy = (height - ch) / 2
    ctx.fillStyle   = 'rgba(16,22,42,0.98)'
    ctx.strokeStyle = 'rgba(255,215,0,0.25)'
    ctx.lineWidth   = 1.2
    roundRect(ctx, cx, cy, cw, ch, 18); ctx.fill(); ctx.stroke()

    // 标题
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#FFD700'
    ctx.fillText(`获取 ${typeLabel} 道具 ×1`, cx + cw / 2, cy + 36)
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(180,200,240,0.6)'
    ctx.fillText('选择一种方式获取', cx + cw / 2, cy + 60)

    // 看广告按钮
    const btnX = cx + 20, btnW2 = cw - 40, btnH2 = 44
    const y1   = cy + 80
    ctx.fillStyle   = 'rgba(255,193,7,0.15)'
    ctx.strokeStyle = 'rgba(255,193,7,0.55)'
    ctx.lineWidth   = 1.5
    roundRect(ctx, btnX, y1, btnW2, btnH2, 12); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#FFD700'
    ctx.fillText('📺  看广告获取', cx + cw / 2, y1 + btnH2 / 2)

    // 分享按钮
    const y2 = y1 + btnH2 + 10
    ctx.fillStyle   = 'rgba(76,175,80,0.15)'
    ctx.strokeStyle = 'rgba(76,175,80,0.55)'
    ctx.lineWidth   = 1.5
    roundRect(ctx, btnX, y2, btnW2, btnH2, 12); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#81C784'
    ctx.fillText('🔗  分享给好友获取', cx + cw / 2, y2 + btnH2 / 2)

    // 关闭 ×
    ctx.font = '20px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('✕', cx + cw - 16, cy + 18)

    // 记录命中区域
    this._adModal.btnWatch = { x: btnX, y: y1, w: btnW2, h: btnH2 }
    this._adModal.btnShare = { x: btnX, y: y2, w: btnW2, h: btnH2 }
    this._adModal.btnClose = { x: cx + cw - 30, y: cy + 4, w: 30, h: 30 }

    ctx.restore()
  }

  _drawWin(ctx, width, height) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 56px sans-serif'
    ctx.fillStyle = '#FFD700'
    ctx.fillText('🎉', width/2, height/2 - 60)
    ctx.font = 'bold 32px sans-serif'
    ctx.fillStyle = '#FFD700'
    ctx.fillText('本关通过！', width/2, height/2 - 5)
    ctx.font = '18px sans-serif'
    ctx.fillStyle = '#a0d8ef'
    ctx.fillText('进入下一关...', width/2, height/2 + 36)
    ctx.restore()
  }

  _drawGameOver(ctx, width, height) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 52px sans-serif'
    ctx.fillStyle = '#FF4444'
    ctx.fillText('💔', width/2, height/2 - 60)
    ctx.font = 'bold 28px sans-serif'
    ctx.fillStyle = '#FF6B6B'
    ctx.fillText('本关失败…', width/2, height/2 - 5)
    ctx.font = '16px sans-serif'
    ctx.fillStyle = '#a0d8ef'
    ctx.fillText('别灰心，重新挑战！', width/2, height/2 + 36)
    ctx.restore()
  }

  // ========== 触摸 ==========
  _hitTest(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  onTouchEnd(x, y) {
    // ── ① 道具获取弹层优先消费 ──
    if (this._adModal) {
      const { btnWatch, btnShare, btnClose, type } = this._adModal
      if (this._hitTest(x, y, btnClose)) { this._adModal = null; return }
      if (this._hitTest(x, y, btnWatch)) { this._adModal = null; this._showRewardedAd(type); return }
      if (this._hitTest(x, y, btnShare)) { this._adModal = null; this._shareForProp(type); return }
      return  // 弹层外点击不穿透
    }

    // ── ② 撤销按钮 ──
    const ub = this._undoBtn
    if (ub && x >= ub.x && x <= ub.x + ub.w && y >= ub.y && y <= ub.y + ub.h) {
      const ok = this.logic.undo()
      if (ok) {
        AudioManager.playUndo()
        this._undoFlash   = 18
        this._insertFlash = 0
        this._insertIdx   = -1
        this.lastCarsWon  = this.logic.carsWon
        this.lastSlotLen  = this.logic.slot.length
        this.floatTexts.push(new FloatText('已撤销', this.game.width / 2, this.slotTop - 20, '#FFD700'))
      }
      return
    }

    if (this.logic.gameOver || this.logic.win) return

    // ── ③ 道具按钮 ──
    for (const btn of this._propBtns) {
      if (this._hitTest(x, y, btn)) {
        this._onPropBtn(btn.type)
        return
      }
    }

    // ── ④ 棋盘格 ──
    const sz = this.cellSize
    for (let r = 0; r < CONFIG.BOARD_ROWS; r++) {
      for (let c = 0; c < CONFIG.BOARD_COLS; c++) {
        const pos = this.cellXY(r, c)
        if (x >= pos.x && x <= pos.x + sz && y >= pos.y && y <= pos.y + sz) {
          const result = this.logic.clickCell(r, c)
          if (result === 'blocked') {
            AudioManager.playBlocked()
            this.floatTexts.push(new FloatText('被遮挡', pos.x + sz / 2, pos.y + sz / 2, '#FF6B6B'))
          } else if (result) {
            AudioManager.playInsert()
            this.selectedCell = { r, c }
            setTimeout(() => { this.selectedCell = null }, 180)
          }
          return
        }
      }
    }
  }

  // ─── 道具按钮业务逻辑 ───
  _onPropBtn(type) {
    const logic = this.logic
    const W = this.game.width
    const floatY = this.slotTop - 24

    if (type === 'expand') {
      if (logic.slotMax >= CONFIG.SLOT_MAX_EXPANDED) {
        this.floatTexts.push(new FloatText('已是最大槽位', W / 2, floatY, '#4FC3F7'))
        return
      }
      if (logic.expandLeft <= 0) { this._adModal = { type }; return }
      const res = logic.useExpand()
      if (res === 'ok') {
        this._propFlash  = { type, frame: 14 }
        this._expandAnim = 18
        this.floatTexts.push(new FloatText('➕ 槽位扩展至7！', W / 2, floatY, '#4FC3F7'))
        AudioManager.playMatch()
      }
    }

    if (type === 'shuffle') {
      if (logic.shuffleLeft <= 0) { this._adModal = { type }; return }
      const res = logic.useShuffle()
      if (res === 'ok') {
        this._propFlash   = { type, frame: 14 }
        this._shuffleAnim = 22
        this.floatTexts.push(new FloatText('🔀 棋盘已洗牌！', W / 2, floatY, '#81C784'))
        AudioManager.playUndo()
      } else if (res === 'board_empty') {
        this.floatTexts.push(new FloatText('棋盘已空', W / 2, floatY, '#888'))
      }
    }
  }

  // ─── 看激励视频广告 ───
  _showRewardedAd(propType) {
    try {
      const ad = wx.createRewardedVideoAd({ adUnitId: 'YOUR_AD_UNIT_ID' })
      ad.onError(() => this._shareForProp(propType))
      ad.onClose((res) => {
        if (res && res.isEnded) {
          this._grantProp(propType, '广告')
        } else {
          this.floatTexts.push(new FloatText('请完整观看~', this.game.width / 2, this.game.height / 2, '#FF9800'))
        }
      })
      ad.show().catch(() => this._shareForProp(propType))
    } catch (e) {
      this._shareForProp(propType)
    }
  }

  // ─── 分享获取道具 ───
  _shareForProp(propType) {
    wx.shareAppMessage({
      title:    '我在「赢了个赢」里三消赢豪车！来挑战我！',
      imageUrl: SHARE_CONFIG.imageUrl,
      query: `from=share&prop=${propType}`,
      success: () => this._grantProp(propType, '分享'),
      fail: () => this.floatTexts.push(new FloatText('分享取消', this.game.width / 2, this.game.height / 2, '#888')),
    })
  }

  // ─── 实际发放道具 ───
  _grantProp(propType, source) {
    if (propType === 'expand') {
      this.logic.expandLeft++
      addExtraProp('expand', 1)
    } else {
      this.logic.shuffleLeft++
      addExtraProp('shuffle', 1)
    }
    const label = propType === 'expand' ? '➕ 扩槽' : '🔀 洗牌'
    this.floatTexts.push(new FloatText(
      `🎁 ${label} ×1（${source}获得）`,
      this.game.width / 2, this.game.height / 2 - 30, '#FFD700'
    ))
  }

  // ========== 底部信息面板 ==========
  _drawBottomPanel(ctx, width, height, logic) {
    const panelTop = this.bottomPanelTop
    if (panelTop >= height - 30) return

    const safeBottom = 34   // iPhone Home Indicator 安全区
    const panelH = height - panelTop - safeBottom
    if (panelH < 50) return

    const cx = width / 2
    ctx.save()

    // 连消展示
    if (logic.combo > 1) {
      const comboY = panelTop + 26
      const comboSize = Math.min(22, 13 + logic.combo)
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `bold ${comboSize}px sans-serif`
      ctx.fillStyle = '#FF6B35'
      ctx.shadowColor = 'rgba(255,107,53,0.7)'
      ctx.shadowBlur = 14
      const pulse = 1 + Math.sin(this.frame * 0.15) * 0.05
      ctx.translate(cx, comboY)
      ctx.scale(pulse, pulse)
      ctx.fillText(`连消 x${logic.combo}！`, 0, 0)
      ctx.restore()
    }

    // 提示文字（轮播）
    const tips = [
      '点击未被遮挡的车块放入槽中',
      '集齐3辆同款即可赢得！',
      '槽位满且无法消除则失败',
      '顶层有车时下方格被遮挡',
    ]
    const tipIdx = Math.floor(this.frame / 180) % tips.length
    const tipY   = panelTop + (logic.combo > 1 ? 58 : 22)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(180,200,240,0.32)'
    ctx.fillText(tips[tipIdx], cx, tipY)

    // ── 已收集进度展示 ──
    this._drawCollectionProgress(ctx, width, panelTop + (logic.combo > 1 ? 76 : 40), logic)

    // 装饰小车图标彩条（留出底部安全区）
    if (panelH > 100) {
      const iconY   = height - safeBottom - 18
      const icons   = CONFIG.CAR_ICONS.slice(0, 7)
      const iconGap = width / (icons.length + 1)
      ctx.font = '14px sans-serif'
      ctx.textBaseline = 'middle'
      icons.forEach((icon, i) => {
        const ix     = iconGap * (i + 1)
        const bounce = Math.sin(this.frame * 0.06 + i * 0.9) * 3
        ctx.globalAlpha = 0.14 + (i % 3) * 0.05
        ctx.textAlign = 'center'
        ctx.fillText(icon, ix, iconY + bounce)
      })
    }

    ctx.restore()
  }

  // ========== 已收集进度小条 ==========
  _drawCollectionProgress(ctx, width, startY, logic) {
    // 统计槽位中各车型数量 + 已消除数量（已赢车 / 3 = 每种消除了几组）
    const slotCount = {}
    for (const car of logic.slot) {
      slotCount[car.type] = (slotCount[car.type] || 0) + 1
    }

    // 棋盘上还有哪些类型
    const boardTypes = new Set()
    for (const row of logic.board) {
      for (const stack of row) {
        for (const car of stack) boardTypes.add(car.type)
      }
    }
    for (const car of logic.slot) boardTypes.add(car.type)

    const types = [...boardTypes].sort()
    if (types.length === 0) return

    const itemW   = Math.min(46, (width - 24) / types.length)
    const totalW  = itemW * types.length
    const startX  = Math.floor((width - totalW) / 2)
    const sz      = Math.min(itemW - 4, 32)

    ctx.save()
    types.forEach((type, i) => {
      const inSlot = slotCount[type] || 0
      const x = startX + i * itemW + (itemW - sz) / 2
      const y = startY

      // 小圆角底板
      ctx.fillStyle = inSlot > 0
        ? `rgba(${hexToRgb(CONFIG.COLORS[type])},0.18)`
        : 'rgba(255,255,255,0.04)'
      roundRect(ctx, x, y, sz, sz, 6); ctx.fill()

      // 车型图标
      ctx.font = `${sz * 0.48}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = inSlot > 0 ? 1 : 0.35
      ctx.fillText(CONFIG.CAR_ICONS[type], x + sz / 2, y + sz / 2)
      ctx.globalAlpha = 1

      // 底部数量点（最多3个点，代表收集进度）
      const dotY = y + sz + 5
      for (let d = 0; d < CONFIG.MATCH_COUNT; d++) {
        const filled = d < inSlot
        const dotX   = x + sz / 2 + (d - 1) * 8
        ctx.beginPath()
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2)
        ctx.fillStyle = filled ? CONFIG.COLORS[type] : 'rgba(255,255,255,0.12)'
        ctx.fill()
      }
    })
    ctx.restore()
  }
}
