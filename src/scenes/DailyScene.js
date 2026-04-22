// 每日挑战场景 - 赢了个赢（天蓝玻璃主题）
// 功能：
//  1. 用今天日期（YYYYMMDD）作为随机种子，生成当日固定关卡参数
//  2. 每天只能挑战一次（played 状态持久化）
//  3. 通关/失败后更新连击天数、总赢次数，检测并解锁专属成就
//  4. "已完成今日挑战"状态下展示结果摘要，禁止重入游戏

function e(str) { return str.replace(/\uFE0F/g, '') }

import { roundRect } from '../utils/draw.js'
import { CONFIG } from '../config.js'
import {
  getDailyState,
  completeDailyChallenge,
  getAchievementStats,
  saveAchievementStats,
  checkAndUnlockAchievements,
} from '../utils/storage.js'

// ── 四向玻璃高光卡片 ──
function drawGlassCard(ctx, x, y, w, h, r, baseColor) {
  ctx.save()
  ctx.fillStyle = baseColor
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  const tg = ctx.createLinearGradient(x, y, x, y + h * 0.44)
  tg.addColorStop(0,   'rgba(255,255,255,0.62)')
  tg.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  tg.addColorStop(1,   'rgba(255,255,255,0.00)')
  ctx.fillStyle = tg
  roundRect(ctx, x, y, w, h * 0.44, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()
  const lg = ctx.createLinearGradient(x, y, x + w * 0.14, y)
  lg.addColorStop(0, 'rgba(255,255,255,0.28)')
  lg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = lg
  roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
  const rg = ctx.createLinearGradient(x + w, y, x + w - w * 0.10, y)
  rg.addColorStop(0, 'rgba(255,255,255,0.16)')
  rg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = rg
  roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()
  const bg2 = ctx.createLinearGradient(x, y + h, x, y + h - h * 0.16)
  bg2.addColorStop(0, 'rgba(255,255,255,0.20)')
  bg2.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = bg2
  roundRect(ctx, x, y + h - h * 0.16, w, h * 0.16, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()
  ctx.strokeStyle = 'rgba(160,215,245,0.60)'
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}

// ── 伪随机工具（LCG，只依赖种子，不用 Math.random） ──
function seededRng(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xFFFFFFFF
  }
}

// 用日期字符串生成当日关卡参数
function buildDailyLevel(dateStr) {
  const rng  = seededRng(dateStr)
  const pool = CONFIG.DAILY_CHALLENGE
  const idx  = Math.floor(rng() * pool.carTypesPool.length)
  const carTypes  = pool.carTypesPool[idx]
  const layerMax  = pool.layerMaxPool[idx]
  const setCount  = pool.setCountPool[idx]
  const ratio     = pool.ratioPool[idx]
  const maxMoves  = Math.ceil(carTypes * setCount * ratio)
  return { carTypes, layerMax, setCount, maxMoves }
}

// 今天日期字符串 YYYYMMDD
function todayStr() {
  const d   = new Date()
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export default class DailyScene {
  constructor(game) {
    this.game       = game
    this.frame      = 0
    this.dateStr    = todayStr()
    this.levelCfg   = buildDailyLevel(this.dateStr)
    this.dailyState = getDailyState()

    // 按钮
    this.startBtn = null
    this.homeBtn  = null

    // 成就弹窗（通关后短暂展示）
    this._newAchievements = []
    this._achFrame        = 0
  }

  init() {
    // 若今天已经玩过，刷新状态（可能是从 GameScene 结果跳回来）
    this.dailyState = getDailyState()
  }

  // ── 由 game.js 在每日关卡结束后调用 ──
  onDailyResult(isWin) {
    const newState = completeDailyChallenge(isWin)
    this.dailyState = newState

    const stats = getAchievementStats()
    stats.dailyWins   = newState.dailyWins
    stats.dailyStreak = newState.streak
    saveAchievementStats(stats)

    const newAch = checkAndUnlockAchievements(CONFIG.ACHIEVEMENTS, stats)
    if (newAch.length > 0) {
      this._newAchievements = newAch
      this._achFrame        = 0
    }
  }

  update() {
    this.frame++
    if (this._newAchievements.length > 0) this._achFrame++
  }

  draw() {
    const { ctx, width: W, height: H } = this.game
    const safeTop = this.game.safeTop || 0
    const cx      = W / 2
    const padX    = 16

    // ── 背景：天蓝渐变 ──
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,    '#5BC8F5')
    bg.addColorStop(0.42, '#7DD6F8')
    bg.addColorStop(0.72, '#A8E6FF')
    bg.addColorStop(1,    '#C5F0FF')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── 顶部导航栏 ──
    const navH  = safeTop + 52
    const navBg = ctx.createLinearGradient(0, 0, 0, navH)
    navBg.addColorStop(0, 'rgba(91,200,245,0.97)')
    navBg.addColorStop(1, 'rgba(91,200,245,0.85)')
    ctx.save()
    ctx.fillStyle = navBg
    ctx.fillRect(0, 0, W, navH)
    ctx.restore()

    // 返回按钮
    const btnY = safeTop + 10, btnH0 = 32, btnW0 = 68
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.55)'
    ctx.strokeStyle = 'rgba(255,255,255,0.80)'
    ctx.lineWidth   = 1
    roundRect(ctx, padX, btnY, btnW0, btnH0, btnH0 / 2)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a6090'
    ctx.fillText('← 返回', padX + btnW0 / 2, btnY + btnH0 / 2)
    ctx.restore()
    this._navBackBtn = { x: padX, y: btnY, w: btnW0, h: btnH0 }

    // 页面标题
    ctx.save()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(e('📅 每日挑战'), cx, safeTop + 26)
    ctx.restore()

    // ── 日期副标题 ──
    ctx.save()
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(this._formatDate(), cx, navH - 10)
    ctx.restore()

    // ── 关卡参数卡片组 ──
    const gridTop = navH + 16
    this._drawInfoGrid(ctx, W, padX, gridTop, this.levelCfg)

    // ── 连击 / 赢次统计卡片 ──
    const streakTop = gridTop + 2 * (60 + 10) + 12
    this._drawStreakRow(ctx, W, padX, streakTop)

    // ── 今日状态区 ──
    const stateTop = streakTop + 80 + 36
    if (this.dailyState.played) {
      this._drawDoneState(ctx, W, H, padX, stateTop)
    } else {
      this._drawStartState(ctx, W, H, padX, stateTop)
    }

    // ── 成就解锁弹窗 ──
    if (this._newAchievements.length > 0 && this._achFrame < 180) {
      this._drawAchievementPopup(ctx, W, H)
    }
  }

  _formatDate() {
    const s = this.dateStr
    return `${s.slice(0, 4)} 年 ${s.slice(4, 6)} 月 ${s.slice(6, 8)} 日`
  }

  // 2×2 关卡参数网格
  _drawInfoGrid(ctx, W, padX, topY, cfg) {
    const items = [
      { label: '车型种类', value: `${cfg.carTypes} 种` },
      { label: '最多步数', value: `${cfg.maxMoves} 步` },
      { label: '堆叠层数', value: `${cfg.layerMax} 层` },
      { label: '每种组数', value: `${cfg.setCount} 组` },
    ]
    const gapX = 10, gapY = 10
    const gW   = (W - padX * 2 - gapX) / 2
    const gH   = 60

    for (let i = 0; i < 4; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const gx  = padX + col * (gW + gapX)
      const gy  = topY + row * (gH + gapY)

      drawGlassCard(ctx, gx, gy, gW, gH, 14, 'rgba(220,242,255,0.75)')

      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '11px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.55)'
      ctx.fillText(items[i].label, gx + gW / 2, gy + 18)
      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = '#1a6090'
      ctx.fillText(items[i].value, gx + gW / 2, gy + 42)
      ctx.restore()
    }
  }

  // 连续天数 + 累计通关 横排卡片
  _drawStreakRow(ctx, W, padX, topY) {
    const cardW = W - padX * 2
    const cardH = 72
    drawGlassCard(ctx, padX, topY, cardW, cardH, 16, 'rgba(220,242,255,0.75)')

    const cx = W / 2
    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

    // 连续天数
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(200,120,20,0.75)'
    ctx.fillText(e('🔥 连续挑战'), cx - 72, topY + 22)
    ctx.font = 'bold 24px sans-serif'
    ctx.fillStyle = '#C8860A'
    ctx.fillText(`${this.dailyState.streak} 天`, cx - 72, topY + 50)

    // 分割线
    ctx.strokeStyle = 'rgba(100,180,220,0.30)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(cx, topY + 12); ctx.lineTo(cx, topY + 60)
    ctx.stroke()

    // 累计通关
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(20,140,80,0.70)'
    ctx.fillText(e('🏆 累计通关'), cx + 72, topY + 22)
    ctx.font = 'bold 24px sans-serif'
    ctx.fillStyle = '#1a7a40'
    ctx.fillText(`${this.dailyState.dailyWins} 次`, cx + 72, topY + 50)

    ctx.restore()
  }

  // 未挑战状态
  _drawStartState(ctx, W, H, padX, topY) {
    const cx  = W / 2
    const bw  = W - padX * 2
    const btnH = 50
    const btnR = btnH / 2

    // 难度提示
    ctx.save()
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(200,100,20,0.75)'
    ctx.fillText(e('⚠️ 高难度关卡 · 每天仅限挑战 1 次'), cx, topY)
    ctx.restore()

    // 开始按钮（橙金色，与结算页下一关一致）
    const bY = topY + 24
    ctx.save()
    const scale = 1 + Math.sin(this.frame * 0.08) * 0.022
    ctx.translate(cx, bY + btnH / 2)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -(bY + btnH / 2))
    const g = ctx.createLinearGradient(padX, bY, padX, bY + btnH)
    g.addColorStop(0, '#FFB020'); g.addColorStop(1, '#FF7800')
    ctx.fillStyle = g
    roundRect(ctx, padX, bY, bw, btnH, btnR); ctx.fill()
    const hg = ctx.createLinearGradient(padX, bY, padX, bY + btnH * 0.50)
    hg.addColorStop(0, 'rgba(255,255,255,0.30)'); hg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = hg
    roundRect(ctx, padX, bY, bw, btnH * 0.50, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 4
    ctx.fillText(e('🚀 开始今日挑战'), cx, bY + btnH / 2)
    ctx.restore()
    this.startBtn = { x: padX, y: bY, w: bw, h: btnH }

    // 返回首页（玻璃胶囊）
    const hy = bY + btnH + 10
    drawGlassCard(ctx, padX, hy, bw, btnH, btnR, 'rgba(220,240,255,0.62)')
    ctx.save()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a5070'
    ctx.fillText(e('🏠 返回首页'), cx, hy + btnH / 2)
    ctx.restore()
    this.homeBtn = { x: padX, y: hy, w: bw, h: btnH }
  }

  // 已完成状态
  _drawDoneState(ctx, W, H, padX, topY) {
    const cx   = W / 2
    const bw   = W - padX * 2
    const btnH = 50
    const btnR = btnH / 2

    // 结果图标
    const bounce = this.dailyState.won ? Math.sin(this.frame * 0.09) * 5 : 0
    ctx.save()
    ctx.font = '56px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(this.dailyState.won ? e('🏆') : e('😔'), cx, topY + bounce)
    ctx.restore()

    // 结果文字
    ctx.save()
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (this.dailyState.won) {
      const g = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0)
      g.addColorStop(0, '#C8860A'); g.addColorStop(1, '#FFD740')
      ctx.fillStyle = g
      ctx.shadowColor = 'rgba(200,150,0,0.35)'; ctx.shadowBlur = 6
    } else {
      ctx.fillStyle = '#2a6080'
    }
    ctx.fillText(this.dailyState.won ? '今日挑战成功！' : '今日挑战失败', cx, topY + 60)
    ctx.restore()

    ctx.save()
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(30,90,140,0.55)'
    ctx.fillText('明天再来挑战新的每日关卡', cx, topY + 86)
    ctx.restore()

    // 返回首页按钮
    const hy = topY + 112
    drawGlassCard(ctx, padX, hy, bw, btnH, btnR, 'rgba(220,240,255,0.62)')
    ctx.save()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a5070'
    ctx.fillText(e('🏠 返回首页'), cx, hy + btnH / 2)
    ctx.restore()
    this.homeBtn  = { x: padX, y: hy, w: bw, h: btnH }
    this.startBtn = null
  }

  // 成就解锁小浮窗（天蓝玻璃风格）
  _drawAchievementPopup(ctx, W, H) {
    const ach   = this._newAchievements[0]
    const alpha = this._achFrame < 150
      ? Math.min(1, this._achFrame / 20)
      : Math.max(0, 1 - (this._achFrame - 150) / 30)

    const pw = 280, ph = 72
    const px = (W - pw) / 2
    const py = H * 0.80

    ctx.save()
    ctx.globalAlpha = alpha
    drawGlassCard(ctx, px, py, pw, ph, 18, ach.color ? ach.color + 'cc' : 'rgba(43,174,224,0.88)')
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.80)'
    ctx.fillText(e('🎉 新成就解锁'), W / 2, py + 20)
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText(`${e(ach.icon)} ${ach.name}`, W / 2, py + 48)
    ctx.restore()

    if (this._achFrame >= 180) {
      this._newAchievements.shift()
      this._achFrame = 0
    }
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    if (hit(this.startBtn)) {
      this.game.showDailyGame(this.levelCfg, this)
      return
    }
    if (hit(this.homeBtn) || hit(this._navBackBtn)) {
      this.game.showStart()
    }
  }
}
