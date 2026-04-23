// 游戏主场景 - 赢了个赢（关卡制）
import GameLogic from '../logic/GameLogic.js'
import { CONFIG } from '../config.js'
import { roundRect } from '../utils/draw.js'
import AudioManager from '../utils/audio.js'
import { addExtraProp, SHARE_CONFIG,
  getAchievementStats, saveAchievementStats, checkAndUnlockAchievements,
} from '../utils/storage.js'
import { CONFIG as _CFG } from '../config.js'  // 成就列表引用
import AchievementUnlockPopup from './AchievementUnlockPopup.js'

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
  // customCfg: 每日挑战专用关卡参数，传入时不走 CONFIG.LEVELS
  // onComplete: 每日挑战完成回调 (isWin, score, carsWon, stars) => void
  constructor(game, levelIdx = 0, customCfg = null, onComplete = null) {
    this.game = game
    this.startLevel = levelIdx
    this._customCfg  = customCfg    // 每日挑战自定义参数
    this._onComplete = onComplete   // 每日挑战完成回调
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
    // 成就追踪（本关会话）
    this._sessionMaxCombo  = 0   // 本关最高连消
    this._sessionUndos     = 0   // 本关撤销次数
    this._sessionShuffles  = 0   // 本关洗牌次数
    this._sessionShares    = 0   // 本关分享次数
    this._achChecked       = false  // 胜利时只检测一次
    this._achPopup         = new AchievementUnlockPopup()
  }

  init() {
    this.logic.initLevel(this.startLevel, this._customCfg)
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
    // 成就追踪重置
    this._sessionMaxCombo  = 0
    this._sessionUndos     = 0
    this._sessionShuffles  = 0
    this._sessionShares    = 0
    this._achChecked       = false
    this._achPopup         = new AchievementUnlockPopup()
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
  get headerH()    { return (this.game.statusBarHeight || 44) + 108 } // 胶囊中心22 + 行间距+分隔线
  get boardTop()   { return this.headerH + 10 }          // header → 棋盘 间距 10px
  get boardH()     { return CONFIG.BOARD_ROWS * this.cellStep }
  get slotTop()    { return this.boardTop + this.boardH + 32 }
  get propBtnTop() { return this.slotTop + this.cellSize + 12 }   // 道具按钮行
  get propBtnH()   { return 52 }
  get bottomPanelTop() { return this.propBtnTop + this.propBtnH + 6 }

  get cellSize() {
    // 宽度优先：按列数计算最大格子尺寸
    const pad      = 8 * 2
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
      // 追踪本关最高连消
      if (logic.combo > this._sessionMaxCombo) this._sessionMaxCombo = logic.combo
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

    // 成就弹窗更新
    this._achPopup.update()

    if ((logic.gameOver || logic.win) && !this._resultScheduled) {
      this._resultScheduled = true
      const stars = logic.calcStars()
      if (logic.win) {
        AudioManager.playWin()
        // ── 成就：累积统计并检测 ──
        if (!this._achChecked) {
          this._achChecked = true
          const stats = getAchievementStats()
          stats.levelsPassed  = (stats.levelsPassed  || 0) + 1
          stats.totalCarsWon  = (stats.totalCarsWon  || 0) + logic.carsWon
          stats.totalUndos    = (stats.totalUndos    || 0) + this._sessionUndos
          stats.totalShuffles = (stats.totalShuffles || 0) + this._sessionShuffles
          stats.totalShares   = (stats.totalShares   || 0) + this._sessionShares
          if (this._sessionMaxCombo > (stats.maxCombo || 0)) stats.maxCombo = this._sessionMaxCombo
          if (stars === 3) stats.threeStarCount = (stats.threeStarCount || 0) + 1
          saveAchievementStats(stats)
          const newly = checkAndUnlockAchievements(_CFG.ACHIEVEMENTS, stats)
          if (newly.length > 0) {
            // 延迟1.2秒再弹出庆祝弹窗（让玩家先看到通关动画）
            setTimeout(() => {
              this._achPopup.show(newly)
            }, 1200)
          }
        }
      } else {
        AudioManager.playLose()
      }
      setTimeout(() => {
        if (this._onComplete) {
          // 每日挑战模式：通过回调返回结果，不走普通 showResult
          this._onComplete(logic.win, logic.score, logic.carsWon, stars)
        } else {
          this.game.showResult(logic.score, logic.carsWon, logic.level, logic.win, stars)
        }
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

    // ── 背景：天蓝渐变（亮色主题）──
    const bg = ctx.createLinearGradient(0, 0, 0, height)
    bg.addColorStop(0,   '#5BC8F5')
    bg.addColorStop(0.5, '#84D9FF')
    bg.addColorStop(1,   '#B8EEFF')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    this._drawHeader(ctx, width, logic)
    this._drawBoard(ctx, logic)
    this._drawSlot(ctx, logic)
    this._drawPropBtns(ctx, width, logic)
    this._drawBottomPanel(ctx, width, height, logic)

    this.particles.forEach(p => p.draw(ctx))
    this.floatTexts.forEach(t => t.draw(ctx))

    // 洗牌绿色光晕
    if (this._shuffleAnim > 0) {
      ctx.save()
      ctx.globalAlpha = (this._shuffleAnim / 20) * 0.18
      ctx.fillStyle = '#2ECC71'
      ctx.fillRect(this.boardLeft - 6, this.boardTop - 6,
        CONFIG.BOARD_COLS * this.cellStep + 12,
        CONFIG.BOARD_ROWS * this.cellStep + 12)
      ctx.restore()
    }

    if (this._undoFlash > 0) {
      ctx.save()
      ctx.globalAlpha = this._undoFlash / 18 * 0.25
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    if (this._levelFlash > 0) {
      ctx.save()
      ctx.globalAlpha = this._levelFlash / 40 * 0.22
      ctx.fillStyle = '#FFD700'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    if (logic.win)           this._drawWin(ctx, width, height)
    else if (logic.gameOver) this._drawGameOver(ctx, width, height)

    // 成就解锁弹窗（最上层）
    this._achPopup.draw(ctx, width, height)

    // 道具获取弹层（最后渲染，覆盖在最上层）
    if (this._adModal) this._drawAdModal(ctx, width, height)

    ctx.restore()
  }

  // ========== Header：对标目标UI（天蓝背景，无面板）==========
  _drawHeader(ctx, width, logic) {
    const levelNum  = logic.level + 1
    const hasLimit  = logic.maxMoves > 0
    const movesLeft = logic.movesLeft
    const isWarn    = hasLimit && movesLeft <= 10
    const padX      = 16
    const statusBarH = this.game.statusBarHeight || 44
    const capCenterY = statusBarH + 22   // 与微信胶囊垂直中心对齐

    // ── 行1：「第N关」金色 + 「目标 ★★★」+ 撤销按钮 ──
    const row1Y = capCenterY

    // 「第N关」金色粗体（左）
    ctx.save()
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(120,60,0,0.55)'
    ctx.lineWidth   = 4
    ctx.strokeText(`第${levelNum}关`, padX, row1Y)
    const tg = ctx.createLinearGradient(padX, row1Y - 14, padX, row1Y + 14)
    tg.addColorStop(0,   '#FFE855')
    tg.addColorStop(0.5, '#FFD000')
    tg.addColorStop(1,   '#FFA000')
    ctx.fillStyle = tg
    ctx.fillText(`第${levelNum}关`, padX, row1Y)
    ctx.restore()

    // 「目标 ★★★」— 与「第N关」同行，紧跟其右侧
    // 实时星数：游戏中用 calcCurrentStars()，通关/失败后用 calcStars()
    const stars = logic.win || logic.gameOver
      ? (logic.calcStars ? logic.calcStars() : 0)
      : (logic.calcCurrentStars ? logic.calcCurrentStars() : 0)
    const titleW = (() => {
      ctx.save(); ctx.font = 'bold 28px sans-serif'
      const w = ctx.measureText(`第${levelNum}关`).width; ctx.restore(); return w
    })()
    // 「目标」小字起点
    const starAreaX = padX + titleW + 12

    ctx.save()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'

    // 「目标」小字（与第N关同一基线，字号小一号）
    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = 'rgba(255,220,80,0.90)'
    ctx.fillText('目标', starAreaX, row1Y)

    // 三颗大星星（同行，字号20px，间距22px）
    const starColors    = ['#FFE840', '#FFD000', '#FFA500']   // 亮金/金/橙金（激活，3颗递进）
    const starColorsDim  = ['rgba(120,100,0,0.35)', 'rgba(100,80,0,0.35)', 'rgba(80,60,0,0.35)']  // 暗淡
    const starGlows      = ['rgba(255,240,0,0.90)', 'rgba(255,200,0,0.90)', 'rgba(255,140,0,0.90)']
    const starGlowsDim   = ['rgba(180,150,0,0.20)', 'rgba(150,120,0,0.20)', 'rgba(120,90,0,0.20)']  // 暗淡发光
    ctx.font = 'bold 20px sans-serif'
    const targetLabelW = (() => {
      ctx.save(); ctx.font = 'bold 13px sans-serif'
      const w = ctx.measureText('目标').width; ctx.restore(); return w
    })()
    for (let s = 0; s < 3; s++) {
      if (s < stars) {
        ctx.fillStyle   = starColors[s]
        ctx.shadowColor = starGlows[s]
        ctx.shadowBlur  = 8
      } else {
        ctx.fillStyle   = starColorsDim[s]
        ctx.shadowColor = starGlowsDim[s]
        ctx.shadowBlur  = 4
      }
      ctx.fillText('★', starAreaX + targetLabelW + 4 + s * 22, row1Y + 1)
    }
    ctx.shadowBlur = 0
    ctx.restore()

    // ── 行2：得分 / 赢车 / 剩余步（三列，右侧预留撤回按钮位置）──
    const row2Y   = capCenterY + 44
    const undoBtnSz = 36
    const undoReserve = padX + undoBtnSz + 8   // 右侧为撤回按钮留出的空间
    const dataW = width - padX - undoReserve    // 三列只占左侧区域
    const colW  = dataW / 3

    const cols = [
      { label: '得分',   value: `${logic.score}`,    vc: 'rgba(255,220,80,1)', lc: 'rgba(255,220,80,1)' },
      { label: '赢车',   value: `×${logic.carsWon}`, vc: '#fff', lc: '#fff' },
      { label: hasLimit ? '剩余步' : '已用步',
        value: hasLimit ? `${movesLeft}` : `${logic.moves}`,
        vc: '#fff', lc: '#fff' },
    ]

    cols.forEach((col, i) => {
      const cx2 = padX + i * colW + colW / 2
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '10px sans-serif'
      ctx.fillStyle = col.lc
      ctx.fillText(col.label, cx2, row2Y - 9)
      const warnBig = i === 2 && isWarn && this.frame % 30 < 15
      ctx.font = `bold ${warnBig ? 19 : 16}px sans-serif`
      ctx.fillStyle = col.vc
      if (i === 2 && isWarn) {
        ctx.shadowColor = 'rgba(255,220,80,1)'
        ctx.shadowBlur  = 6
      }
      ctx.fillText(col.value, cx2, row2Y + 9)
      ctx.shadowBlur = 0
      ctx.restore()
    })

    // 撤销按钮（右侧，与 row2Y 垂直居中，避开微信胶囊按钮）
    const canUndo = logic.undoLeft > 0 && logic.undoStack.length > 0
    const undoX = width - padX - undoBtnSz
    const undoY = row2Y - undoBtnSz / 2
    ctx.save()
    // 按钮背景：可用=橙色渐变；不可用=灰蓝
    if (canUndo) {
      const uBg = ctx.createLinearGradient(undoX, undoY, undoX, undoY + undoBtnSz)
      uBg.addColorStop(0, '#FFB840')
      uBg.addColorStop(1, '#FF8000')
      ctx.fillStyle = uBg
      ctx.shadowColor = 'rgba(255,140,0,0.50)'
      ctx.shadowBlur  = 10
    } else {
      ctx.fillStyle = 'rgba(98, 167, 236, 0.35)'
      ctx.shadowBlur = 0
    }
    roundRect(ctx, undoX, undoY, undoBtnSz, undoBtnSz, 10); ctx.fill()
    ctx.shadowBlur = 0
    // 顶部高光
    if (canUndo) {
      const uHg = ctx.createLinearGradient(undoX, undoY, undoX, undoY + undoBtnSz * 0.5)
      uHg.addColorStop(0, 'rgba(255,255,255,0.35)')
      uHg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = uHg
      roundRect(ctx, undoX, undoY, undoBtnSz, undoBtnSz * 0.5, { tl:10, tr:10, bl:0, br:0 }); ctx.fill()
    }
    // 撤销符号
    ctx.font = `bold 18px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = canUndo ? '#FFFFFF' : 'rgba(160,190,220,0.70)'
    ctx.fillText('↩', undoX + undoBtnSz / 2, undoY + undoBtnSz / 2)
    // 次数小标（右下角角标）
    ctx.font = `bold 9px sans-serif`
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = canUndo ? 'rgba(255,255,255,0.90)' : 'rgba(160,190,220,0.60)'
    ctx.fillText(`×${logic.undoLeft}`, undoX + undoBtnSz - 3, undoY + undoBtnSz - 2)
    ctx.restore()
    this._undoBtn = { x: undoX, y: undoY, w: undoBtnSz, h: undoBtnSz }

    // ── 数据行下方渐变分隔线（彩虹渐变细线，与数据行保留间距）──
    const divY = capCenterY + 78
    ctx.save()
    const divGrad = ctx.createLinearGradient(padX, divY, width - padX, divY)
    divGrad.addColorStop(0,    'rgba(255,100,100,0.0)')
    divGrad.addColorStop(0.08, '#FF6B6B')
    divGrad.addColorStop(0.30, '#FFD700')
    divGrad.addColorStop(0.55, '#4FC3F7')
    divGrad.addColorStop(0.78, '#81C784')
    divGrad.addColorStop(0.92, '#CE93D8')
    divGrad.addColorStop(1,    'rgba(206,147,216,0.0)')
    ctx.strokeStyle = divGrad
    ctx.lineWidth   = 2.5
    ctx.beginPath()
    ctx.moveTo(padX, divY)
    ctx.lineTo(width - padX, divY)
    ctx.stroke()
    ctx.restore()
  }

  _drawDivider(ctx, width, logic) {
    const y = this.slotTop - 16
    const slotText = `${logic.slot.length}/${logic.slotMax}`
    const isWarn   = logic.slot.length >= logic.slotMax
    const warnBlink = isWarn && this.frame % 30 < 15

    ctx.save()
    ctx.font = '11px sans-serif'          // ← 必须先设 font，measureText 才准确
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 测量文字宽度，计算两侧线的端点
    const textW   = ctx.measureText(slotText).width
    const textPad = 8
    const textCX  = width / 2
    const lineL   = textCX - textW / 2 - textPad
    const lineR   = textCX + textW / 2 + textPad

    // 左侧虚线
    ctx.strokeStyle = 'rgba(100,180,230,0.28)'
    ctx.lineWidth   = 1
    ctx.setLineDash([4, 5])
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(lineL, y); ctx.stroke()
    // 右侧虚线
    ctx.beginPath(); ctx.moveTo(lineR, y); ctx.lineTo(width - 10, y); ctx.stroke()
    ctx.setLineDash([])

    // 数字（满槽时红色闪烁）
    ctx.fillStyle = isWarn
      ? (warnBlink ? 'rgba(220,60,60,0.90)' : 'rgba(220,60,60,0.50)')
      : 'rgba(60,130,180,0.75)'
    ctx.fillText(slotText, textCX, y)

    ctx.restore()
  }

  // ========== 棋盘格纹理背景 ==========
  _drawGridTexture(ctx) {
    const cols = CONFIG.BOARD_COLS
    const rows = CONFIG.BOARD_ROWS
    const sz   = this.cellSize
    const gap  = this.cellGap
    const bx   = this.boardLeft - gap
    const by   = this.boardTop  - gap
    const bw   = cols * (sz + gap) + gap
    const bh   = rows * (sz + gap) + gap
    const r    = 14  // 圆角

    ctx.save()

    // ── 棋盘底板（半透明深蓝，无全局阴影）──
    ctx.fillStyle = 'rgba(175, 208, 241, 0.1)'
    roundRect(ctx, bx, by, bw, bh, r); ctx.fill()

    // 内渐变（轻微明暗变化）
    const panelG = ctx.createLinearGradient(bx, by, bx, by + bh)
    panelG.addColorStop(0, 'rgba(255,255,255,0.06)')
    panelG.addColorStop(1, 'rgba(0,0,0,0.06)')
    ctx.fillStyle = panelG
    roundRect(ctx, bx, by, bw, bh, r); ctx.fill()
  
    // 外边框（白色半透明细线）
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth   = 1.5
    roundRect(ctx, bx, by, bw, bh, r); ctx.stroke()

    ctx.restore()
  }

  // ========== 车块棋盘（亮色主题）==========
  _drawBoard(ctx, logic) {
    // 先画棋盘背景面板
    this._drawGridTexture(ctx)
    const sz = this.cellSize
    for (let r = 0; r < CONFIG.BOARD_ROWS; r++) {
      for (let c = 0; c < CONFIG.BOARD_COLS; c++) {
        const { x, y } = this.cellXY(r, c)
        const depth   = logic.getStackDepth(r, c)
        const topCar  = logic.getTopCar(r, c)
        const blocked = depth > 0 && logic.isBlocked(r, c)
        const canTap  = depth > 0 && !blocked

        // 空格底板：浅蓝半透明，融入天蓝背景
        if (!topCar) {
          ctx.save()
          // 底色：天蓝色，低透明度（与背景融合）
          ctx.fillStyle = 'rgba(150,215,245,0.22)'
          roundRect(ctx, x, y, sz, sz, 10); ctx.fill()
          // 顶部浅白渐变（玻璃反光）
          const emptyHg = ctx.createLinearGradient(x, y, x, y + sz * 0.45)
          emptyHg.addColorStop(0,   'rgba(255,255,255,0.52)')
          emptyHg.addColorStop(0.6, 'rgba(255,255,255,0.12)')
          emptyHg.addColorStop(1,   'rgba(255,255,255,0.00)')
          ctx.fillStyle = emptyHg
          roundRect(ctx, x, y, sz, sz * 0.45, { tl:10, tr:10, bl:0, br:0 }); ctx.fill()
          // 左侧亮边
          const emptyL = ctx.createLinearGradient(x, y, x + sz*0.18, y)
          emptyL.addColorStop(0, 'rgba(255,255,255,0.22)')
          emptyL.addColorStop(1, 'rgba(255,255,255,0.00)')
          ctx.fillStyle = emptyL
          roundRect(ctx, x, y, sz*0.18, sz, { tl:10, tr:0, bl:10, br:0 }); ctx.fill()
          // 右侧亮边
          const emptyR = ctx.createLinearGradient(x + sz, y, x + sz - sz*0.14, y)
          emptyR.addColorStop(0, 'rgba(255,255,255,0.14)')
          emptyR.addColorStop(1, 'rgba(255,255,255,0.00)')
          ctx.fillStyle = emptyR
          roundRect(ctx, x + sz - sz*0.14, y, sz*0.14, sz, { tl:0, tr:10, bl:0, br:10 }); ctx.fill()
          // 底部反光
          const emptyB = ctx.createLinearGradient(x, y + sz, x, y + sz - sz*0.18)
          emptyB.addColorStop(0, 'rgba(255,255,255,0.16)')
          emptyB.addColorStop(1, 'rgba(255,255,255,0.00)')
          ctx.fillStyle = emptyB
          roundRect(ctx, x, y + sz - sz*0.18, sz, sz*0.18, { tl:0, tr:0, bl:10, br:10 }); ctx.fill()
          // 外细边框：浅蓝白
          ctx.strokeStyle = 'rgba(200,235,255,0.50)'
          ctx.lineWidth   = 1.5
          roundRect(ctx, x, y, sz, sz, 10); ctx.stroke()
          ctx.restore()
          continue
        }

        // 有车格子：饱和底色 + 强顶部高光，纯渐变做果冻感，无 shadow
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        roundRect(ctx, x, y, sz, sz, 10); ctx.fill()
        ctx.restore()

        const isSel = this.selectedCell &&
          this.selectedCell.r === r && this.selectedCell.c === c

        ctx.save()
        ctx.translate(x + sz / 2, y + sz / 2)
        if (isSel) ctx.scale(1.09, 1.09)

        // 彩色底色（饱和，无 shadow 不渗色）
        ctx.fillStyle = topCar.color
        roundRect(ctx, -sz/2, -sz/2, sz, sz, 12); ctx.fill()

        // 顶部超亮白色高光（果冻感核心：上45%大面积亮白渐变）
        const hg = ctx.createLinearGradient(0, -sz/2, 0, -sz/2 + sz * 0.45)
        hg.addColorStop(0,    'rgba(255,255,255,0.78)')
        hg.addColorStop(0.45, 'rgba(255,255,255,0.22)')
        hg.addColorStop(1,    'rgba(255,255,255,0.00)')
        ctx.fillStyle = hg
        roundRect(ctx, -sz/2, -sz/2, sz, sz * 0.45, { tl:12, tr:12, bl:0, br:0 }); ctx.fill()

        // 左侧亮边（侧光感）
        const sideG = ctx.createLinearGradient(-sz/2, 0, -sz/2 + sz*0.18, 0)
        sideG.addColorStop(0, 'rgba(255,255,255,0.28)')
        sideG.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = sideG
        roundRect(ctx, -sz/2, -sz/2, sz*0.18, sz, { tl:12, tr:0, bl:12, br:0 }); ctx.fill()

        // 右侧亮边（对称侧光）
        const sideGR = ctx.createLinearGradient(sz/2, 0, sz/2 - sz*0.14, 0)
        sideGR.addColorStop(0, 'rgba(255,255,255,0.18)')
        sideGR.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = sideGR
        roundRect(ctx, sz/2 - sz*0.14, -sz/2, sz*0.14, sz, { tl:0, tr:12, bl:0, br:12 }); ctx.fill()

        // 底部反光（模拟糖果底部折射，较弱）
        const botG = ctx.createLinearGradient(0, sz/2, 0, sz/2 - sz*0.18)
        botG.addColorStop(0, 'rgba(255,255,255,0.22)')
        botG.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = botG
        roundRect(ctx, -sz/2, sz/2 - sz*0.18, sz, sz*0.18, { tl:0, tr:0, bl:12, br:12 }); ctx.fill()

        // 车型 emoji
        ctx.font = `${sz * 0.46}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(topCar.icon, 0, 0)

        // 堆叠数（右上角白色）
        if (depth > 1) {
          ctx.font = `bold ${Math.max(9, sz * 0.21)}px sans-serif`
          ctx.textAlign = 'right'; ctx.textBaseline = 'top'
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.fillText(`×${depth}`, sz/2 - 2, -sz/2 + 2)
        }

        // 遮挡：仅锁图标（右下角角标，半透明）
        if (blocked) {
          const lockSz = sz * 0.20
          ctx.font = `${lockSz}px sans-serif`
          ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
          ctx.globalAlpha = 0.55
          ctx.fillText('🔒', sz/2 - 2, sz/2 - 2)
          ctx.globalAlpha = 1
        }

        ctx.restore()   // filter/alpha 复位

        // 可点击：浅白外框
        if (canTap && !isSel) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.60)'
          ctx.lineWidth   = 1.5
          ctx.shadowColor = 'rgba(255,255,255,0.30)'
          ctx.shadowBlur  = 4
          roundRect(ctx, x, y, sz, sz, 12); ctx.stroke()
          ctx.restore()
        }

        // 选中高亮：亮白强描边
        if (isSel && !blocked) {
          ctx.save()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth   = 3
          ctx.shadowColor = 'rgba(255,255,255,0.85)'
          ctx.shadowBlur  = 12
          roundRect(ctx, x, y, sz, sz, 12); ctx.stroke()
          ctx.restore()
        }
      }
    }
  }

  _drawSlot(ctx, logic) {
    const sz      = this.cellSize
    const slotMax = logic.slotMax
    const W       = this.game.width

    // ── 棋盘与槽位之间的分隔线 ──
    const divY = this.slotTop - 14
    ctx.save()
    const divGrad = ctx.createLinearGradient(0, divY, W, divY)
    divGrad.addColorStop(0,    'rgba(255,255,255,0.00)')
    divGrad.addColorStop(0.10, 'rgba(255,255,255,0.55)')
    divGrad.addColorStop(0.50, 'rgba(160,220,255,0.80)')
    divGrad.addColorStop(0.90, 'rgba(255,255,255,0.55)')
    divGrad.addColorStop(1,    'rgba(255,255,255,0.00)')
    ctx.strokeStyle = divGrad
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.moveTo(12, divY)
    ctx.lineTo(W - 12, divY)
    ctx.stroke()
    ctx.restore()

    // 槽位标签（居中，两侧虚线）
    {
      const labelY    = this.slotTop - 11
      const slotFull  = logic.slot.length >= logic.slotMax
      const warnBlink = slotFull && this.frame % 30 < 15
      const slotText  = `${logic.slot.length}/${logic.slotMax}`

      ctx.save()
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'

      const textW   = ctx.measureText(slotText).width
      const textPad = 8
      const textCX  = W / 2
      const lineL   = textCX - textW / 2 - textPad
      const lineR   = textCX + textW / 2 + textPad

      // 两侧虚线
      ctx.strokeStyle = 'rgba(100,180,230,0.35)'
      ctx.lineWidth   = 1
      ctx.setLineDash([4, 5])
      ctx.beginPath(); ctx.moveTo(12, labelY); ctx.lineTo(lineL, labelY); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(lineR, labelY); ctx.lineTo(W - 12, labelY); ctx.stroke()
      ctx.setLineDash([])

      // 居中数字
      ctx.fillStyle = slotFull
        ? (warnBlink ? '#FF6060' : 'rgba(255,100,100,0.75)')
        : '#4FD4FF'
      ctx.fillText(slotText, textCX, labelY)
      ctx.restore()
    }

    for (let i = 0; i < slotMax; i++) {
      const { x, y } = this.slotXY(i)
      const car      = logic.slot[i]
      const isFlash  = (this._insertFlash > 0 && i === this._insertIdx)
      const isNewSlot = (slotMax === CONFIG.SLOT_MAX_EXPANDED && i === CONFIG.SLOT_MAX_EXPANDED - 1)
      const expandScale = isNewSlot && this._expandAnim > 0
        ? 0.6 + 0.4 * (1 - this._expandAnim / 18) : 1

      ctx.save()
      if (expandScale < 1) {
        ctx.translate(x + sz / 2, y + sz / 2)
        ctx.scale(expandScale, expandScale)
        ctx.translate(-(x + sz / 2), -(y + sz / 2))
      }

      if (car) {
        // 有车：彩色卡片（与棋盘相同风格）
        if (isFlash) ctx.globalAlpha = 0.85 + 0.15 * this._insertFlash / 14
        ctx.fillStyle = car.color
        roundRect(ctx, x, y, sz, sz, 8); ctx.fill()
        // 顶部高光
        const hg = ctx.createLinearGradient(x, y, x, y + sz * 0.38)
        hg.addColorStop(0, 'rgba(255,255,255,0.40)')
        hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = hg
        roundRect(ctx, x, y, sz, sz * 0.38, 8); ctx.fill()
        // 插入闪烁高亮边框
        if (isFlash) {
          ctx.strokeStyle = `rgba(255,255,255,${0.9 * this._insertFlash / 14})`
          ctx.lineWidth   = 2.5
          roundRect(ctx, x, y, sz, sz, 8); ctx.stroke()
        }
        ctx.font = `${sz * 0.44}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(car.icon, x + sz / 2, y + sz / 2)
      } else {
        // 空槽：白色半透明底板 + 白色虚线边框（对标设计图）
        ctx.fillStyle   = isNewSlot
          ? 'rgba(79,195,247,0.10)'
          : 'rgba(255,255,255,0.18)'
        ctx.strokeStyle = isNewSlot
          ? 'rgba(79,195,247,0.65)'
          : 'rgba(255,255,255,0.55)'
        ctx.lineWidth   = isNewSlot ? 2 : 1.5
        ctx.setLineDash([3, 3])
        roundRect(ctx, x, y, sz, sz, 8); ctx.fill(); ctx.stroke()
        ctx.setLineDash([])
        // 槽位序号
        ctx.font = `${Math.max(9, sz * 0.22)}px sans-serif`
        ctx.fillStyle   = isNewSlot ? 'rgba(79,195,247,0.7)' : 'rgba(255,255,255,0.38)'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(isNewSlot ? '＋' : `${i + 1}`, x + sz / 2, y + sz / 2)
      }
      ctx.restore()
    }
  }

  // ========== 道具按钮行（对标截图：卡片式，左侧图标圆，右侧文字）==========
  _drawPropBtns(ctx, width, logic) {
    const y    = this.propBtnTop
    const h    = this.propBtnH
    const gap  = 10
    const padX = 16
    const btnW = Math.floor((width - padX * 2 - gap) / 2)
    const startX = padX

    this._propBtns = []

    const defs = [
      {
        type:   'expand',
        icon:   '+',
        label:  '扩槽',
        sub:    logic.slotMax > CONFIG.SLOT_MAX ? '已激活' : `×${logic.expandLeft}`,
        left:   logic.expandLeft,
        maxed:  logic.slotMax >= CONFIG.SLOT_MAX_EXPANDED,
        // 蓝紫渐变
        c0: '#5EB8FF', c1: '#2D7FE8',
        ic0: '#82CFFF', ic1: '#4498FF',   // 图标圆渐变
        flash: '#A0CCFF',
      },
      {
        type:   'shuffle',
        icon:   '⇄',
        label:  '洗牌',
        sub:    `×${logic.shuffleLeft}`,
        left:   logic.shuffleLeft,
        maxed:  false,
        // 青绿渐变
        c0: '#2EE0B8', c1: '#0DB896',
        ic0: '#6EFFD8', ic1: '#18C8A0',
        flash: '#88FFD8',
      },
    ]

    defs.forEach((def, i) => {
      const x       = startX + i * (btnW + gap)
      const midY    = y + h / 2
      const empty   = def.left <= 0 || (def.type === 'expand' && def.maxed)
      const isFlash = this._propFlash && this._propFlash.type === def.type && this._propFlash.frame > 0

      this._propBtns.push({ type: def.type, x, y, w: btnW, h })

      ctx.save()

      // ── 卡片背景（大圆角，渐变）──
      const grad = ctx.createLinearGradient(x, y, x + btnW, y + h)
      if (empty) {
        grad.addColorStop(0, 'rgba(180,195,215,0.52)')
        grad.addColorStop(1, 'rgba(150,168,190,0.52)')
      } else if (isFlash) {
        grad.addColorStop(0, def.flash)
        grad.addColorStop(1, def.c1)
      } else {
        grad.addColorStop(0, def.c0)
        grad.addColorStop(1, def.c1)
      }
      ctx.fillStyle = grad
      if (!empty) {
        ctx.shadowColor = `${def.c1}88`
        ctx.shadowBlur  = 12
        ctx.shadowOffsetY = 3
      }
      roundRect(ctx, x, y, btnW, h, 18); ctx.fill()
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

      // 顶部高光条
      if (!empty) {
        const hl = ctx.createLinearGradient(x, y, x, y + h * 0.48)
        hl.addColorStop(0, 'rgba(255,255,255,0.40)')
        hl.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = hl
        roundRect(ctx, x, y, btnW, h * 0.48, { tl:18, tr:18, bl:0, br:0 }); ctx.fill()
      }

      // ── 左侧图标圆形背景 ──
      const circR  = h * 0.36
      const circX  = x + 18 + circR
      const circY  = midY
      // if (!empty) {
      //   const circG = ctx.createLinearGradient(circX - circR, circY - circR, circX + circR, circY + circR)
      //   circG.addColorStop(0, def.ic0)
      //   circG.addColorStop(1, def.ic1)
      //   ctx.fillStyle = circG
      //   ctx.shadowColor = 'rgba(0,0,0,0.20)'
      //   ctx.shadowBlur  = 6
      //   ctx.beginPath(); ctx.arc(circX, circY, circR, 0, Math.PI * 2); ctx.fill()
      //   ctx.shadowBlur  = 0
      //   // 圆内高光
      //   const circHL = ctx.createRadialGradient(circX - circR * 0.25, circY - circR * 0.25, 0, circX, circY, circR)
      //   circHL.addColorStop(0, 'rgba(255,255,255,0.45)')
      //   circHL.addColorStop(0.5, 'rgba(255,255,255,0.10)')
      //   circHL.addColorStop(1, 'rgba(255,255,255,0.00)')
      //   ctx.fillStyle = circHL
      //   ctx.beginPath(); ctx.arc(circX, circY, circR, 0, Math.PI * 2); ctx.fill()
      // } else {
      //   ctx.fillStyle = 'rgba(150,170,190,0.40)'
      //   ctx.beginPath(); ctx.arc(circX, circY, circR, 0, Math.PI * 2); ctx.fill()
      // }

      // 图标文字
      ctx.font = `bold ${Math.round(circR * 1.15)}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = empty ? 'rgba(120,140,160,0.70)' : '#FFFFFF'
      ctx.fillText(def.icon, circX, circY + 1)

      ctx.restore()

      // ── 右侧文字区 ──
      ctx.save()
      ctx.globalAlpha = empty ? 0.50 : 1
      const textX = x + 18 + circR * 2 + 10

      // 主标签（大字）
      ctx.font = 'bold 17px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(def.label, textX, midY - 9)

      // 数量/状态（小字）
      ctx.font = '12px sans-serif'
      ctx.fillStyle = empty ? 'rgba(120,140,160,0.80)' : 'rgba(255,255,255,0.85)'
      ctx.fillText(empty ? '已用完' : def.sub, textX, midY + 10)

      ctx.restore()

      // ── 用完时：+获取 角标（右侧）──
      if (empty) {
        const tagW = 44, tagH = 22
        const tagX = x + btnW - tagW - 10
        const tagY = midY - tagH / 2
        ctx.save()
        ctx.fillStyle   = 'rgba(255,160,0,0.16)'
        ctx.strokeStyle = 'rgba(230,140,0,0.70)'
        ctx.lineWidth   = 1.2
        roundRect(ctx, tagX, tagY, tagW, tagH, 10); ctx.fill(); ctx.stroke()
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = '#D07000'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
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
    // 亮色半透明白色遮罩
    ctx.fillStyle = 'rgba(220,245,255,0.78)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    // 大 emoji
    ctx.font = 'bold 56px sans-serif'
    ctx.fillText('🎉', width/2, height/2 - 62)
    // 标题
    ctx.font = 'bold 34px sans-serif'
    ctx.fillStyle = '#1a6ea8'
    ctx.shadowColor = 'rgba(30,120,200,0.30)'
    ctx.shadowBlur  = 12
    ctx.fillText('本关通过！', width/2, height/2 - 4)
    ctx.shadowBlur  = 0
    // 副标
    ctx.font = '18px sans-serif'
    ctx.fillStyle = '#3a9ad0'
    ctx.fillText('进入下一关…', width/2, height/2 + 38)
    ctx.restore()
  }

  _drawGameOver(ctx, width, height) {
    ctx.save()
    ctx.fillStyle = 'rgba(255,230,220,0.80)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 52px sans-serif'
    ctx.fillText('💔', width/2, height/2 - 62)
    ctx.font = 'bold 30px sans-serif'
    ctx.fillStyle = '#C03030'
    ctx.shadowColor = 'rgba(200,50,50,0.28)'
    ctx.shadowBlur  = 10
    ctx.fillText('本关失败…', width/2, height/2 - 4)
    ctx.shadowBlur  = 0
    ctx.font = '17px sans-serif'
    ctx.fillStyle = '#A04040'
    ctx.fillText('别灰心，重新挑战！', width/2, height/2 + 38)
    ctx.restore()
  }

  // ========== 触摸 ==========
  _hitTest(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  onTouchEnd(x, y) {
    // ── ① 成就弹窗优先消费 ──
    if (this._achPopup && this._achPopup.visible) {
      this._achPopup.onTouchEnd(x, y)
      return
    }

    // ── ② 道具获取弹层优先消费 ──
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
        this._sessionUndos++   // 成就计数
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
        this._sessionShuffles++   // 成就计数
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
      success: () => {
        this._sessionShares++   // 成就计数
        this._grantProp(propType, '分享')
      },
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

  // ========== 底部信息面板（亮色主题）==========
  _drawBottomPanel(ctx, width, height, logic) {
    const panelTop = this.bottomPanelTop
    if (panelTop >= height - 30) return

    const safeBottom = 34
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
      ctx.fillStyle = '#E05010'
      ctx.shadowColor = 'rgba(255,120,30,0.55)'
      ctx.shadowBlur = 10
      const pulse = 1 + Math.sin(this.frame * 0.15) * 0.05
      ctx.translate(cx, comboY)
      ctx.scale(pulse, pulse)
      ctx.fillText(`连消 x${logic.combo}！`, 0, 0)
      ctx.restore()
    }

    // 提示文字
    const tips = [
      '点击未被加锁的车块放入槽中',
      '集齐3辆同款即可赢得！',
      '槽位满且无法消除则失败',
      '顶层有车时下方格被加锁',
    ]
    const tipIdx = Math.floor(this.frame / 180) % tips.length
    const tipY   = panelTop + (logic.combo > 1 ? 58 : 22)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(20,80,140,0.38)'
    ctx.fillText(tips[tipIdx], cx, tipY)

    // 已收集进度展示
    this._drawCollectionProgress(ctx, width, panelTop + (logic.combo > 1 ? 76 : 40), logic)

    // 底部装饰小车
    if (panelH > 100) {
      const iconY   = height - safeBottom - 18
      const icons   = CONFIG.CAR_ICONS.slice(0, 7)
      const iconGap = width / (icons.length + 1)
      ctx.font = '14px sans-serif'
      ctx.textBaseline = 'middle'
      icons.forEach((icon, i) => {
        const ix     = iconGap * (i + 1)
        const bounce = Math.sin(this.frame * 0.06 + i * 0.9) * 3
        ctx.globalAlpha = 0.10 + (i % 3) * 0.04
        ctx.textAlign = 'center'
        ctx.fillText(icon, ix, iconY + bounce)
      })
    }

    ctx.restore()
  }

  // ========== 已收集进度小条（亮色主题）==========
  _drawCollectionProgress(ctx, width, startY, logic) {
    const slotCount = {}
    for (const car of logic.slot) {
      slotCount[car.type] = (slotCount[car.type] || 0) + 1
    }

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

      // 小圆角底板（亮色：浅白或淡彩）
      ctx.fillStyle = inSlot > 0
        ? `rgba(${hexToRgb(CONFIG.COLORS[type])},0.22)`
        : 'rgba(255,255,255,0.40)'
      roundRect(ctx, x, y, sz, sz, 6); ctx.fill()

      // 有车时轻描边
      if (inSlot > 0) {
        ctx.strokeStyle = `rgba(${hexToRgb(CONFIG.COLORS[type])},0.55)`
        ctx.lineWidth   = 1
        roundRect(ctx, x, y, sz, sz, 6); ctx.stroke()
      }

      ctx.font = `${sz * 0.48}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = inSlot > 0 ? 1 : 0.38
      ctx.fillText(CONFIG.CAR_ICONS[type], x + sz / 2, y + sz / 2)
      ctx.globalAlpha = 1

      // 底部进度点
      const dotY = y + sz + 5
      for (let d = 0; d < CONFIG.MATCH_COUNT; d++) {
        const filled = d < inSlot
        const dotX   = x + sz / 2 + (d - 1) * 8
        ctx.beginPath()
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2)
        ctx.fillStyle = filled ? CONFIG.COLORS[type] : 'rgba(100,160,200,0.20)'
        ctx.fill()
      }
    })
    ctx.restore()
  }
}
