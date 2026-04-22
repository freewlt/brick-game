// 结算场景 - 赢了个赢（天蓝玻璃主题）
import { roundRect } from '../utils/draw.js'
import { spendLife, getLives, getRecoverSecondsLeft, shareForLife, saveProgress } from '../utils/storage.js'
import { CONFIG } from '../config.js'

// 剥掉 \uFE0F 变体选择符，避免微信小游戏 Canvas 渲染成小方块
function e(str) {
  return str.replace(/\uFE0F/g, '')
}

// 四向玻璃高光（复用 SettingsScene / AchievementScene 同款）
function drawGlassCard(ctx, x, y, w, h, r, baseColor) {
  ctx.save()
  ctx.fillStyle = baseColor
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  // 顶部高光
  const tg = ctx.createLinearGradient(x, y, x, y + h * 0.44)
  tg.addColorStop(0,   'rgba(255,255,255,0.62)')
  tg.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  tg.addColorStop(1,   'rgba(255,255,255,0.00)')
  ctx.fillStyle = tg
  roundRect(ctx, x, y, w, h * 0.44, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()
  // 左侧
  const lg = ctx.createLinearGradient(x, y, x + w * 0.14, y)
  lg.addColorStop(0, 'rgba(255,255,255,0.28)')
  lg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = lg
  roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
  // 右侧
  const rg = ctx.createLinearGradient(x + w, y, x + w - w * 0.10, y)
  rg.addColorStop(0, 'rgba(255,255,255,0.16)')
  rg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = rg
  roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()
  // 底部反光
  const bg2 = ctx.createLinearGradient(x, y + h, x, y + h - h * 0.16)
  bg2.addColorStop(0, 'rgba(255,255,255,0.20)')
  bg2.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = bg2
  roundRect(ctx, x, y + h - h * 0.16, w, h * 0.16, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()
  // 边框
  ctx.strokeStyle = 'rgba(160,215,245,0.60)'
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}

export default class ResultScene {
  // onClose: 可选回调，每日挑战模式下点"返回"时触发（替代跳下一关逻辑）
  constructor(game, score, carsWon, levelIdx, isWin, stars = 3, onClose = null) {
    this.game     = game
    this.score    = score
    this.carsWon  = carsWon
    this.levelIdx = levelIdx   // 0-based 当前关卡索引；每日挑战传 -1
    this.isWin    = isWin      // true=过关，false=失败
    this._onClose = onClose    // 每日挑战专用：结算后返回 DailyScene
    this.frame    = 0
    // ④ 星级从 GameScene 传入，非自算
    this.stars    = isWin ? stars : 0
    this.nextBtn  = null
    this.retryBtn = null
    this.homeBtn  = null
    this.shareBtn = null
    this.displayScore = 0
    this.displayCars  = 0
    this.confetti = []
    this._initConfetti()
    // 机会系统
    this.lives        = 3         // 扣完后的剩余机会
    this._lifeSpent   = false     // 失败只扣一次
  }

  _initConfetti() {
    if (!this.isWin) return
    const w = this.game.width
    const icons = [e('🚗'), e('🏎️'), e('🚙'), e('🛻'), e('🚕'), e('⭐'), e('🏆')]
    for (let i = 0; i < 20; i++) {
      this.confetti.push({
        x: Math.random() * w,
        y: Math.random() * -250 - 10,
        vy: 1.2 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 1.2,
        icon: icons[Math.floor(Math.random() * icons.length)],
        size: 16 + Math.random() * 16,
        alpha: 0.5 + Math.random() * 0.5,
        angle: 0,
        spin: (Math.random() - 0.5) * 0.08,
      })
    }
  }

  init() {
    const isDaily = this._onClose !== null   // 每日挑战模式
    if (!this.isWin && !this._lifeSpent && !isDaily) {
      this._lifeSpent = true
      this.lives = spendLife()   // 失败扣1次机会（每日模式不扣）
    }
    if (this.isWin) {
      if (!isDaily) {
        // 普通模式：上传排行榜数据（已通关数 = levelIdx + 1）
        saveProgress(this.levelIdx + 1)
      }
      this.lives = getLives()
      // 最后一关通关：1.2秒后自动跳到全通关彩蛋页（每日模式不触发）
      if (!isDaily && this.levelIdx >= (CONFIG.LEVELS.length - 1)) {
        setTimeout(() => {
          this.game.showAllClear()
        }, 1200)
      }
    }
  }

  update() {
    this.frame++
    // 数字滚动
    if (this.displayScore < this.score)
      this.displayScore = Math.min(this.score, this.displayScore + Math.ceil(this.score / 50) + 1)
    if (this.displayCars < this.carsWon)
      this.displayCars = Math.min(this.carsWon, this.displayCars + 1)

    // 彩屑下落
    const h = this.game.height
    const w = this.game.width
    for (const p of this.confetti) {
      p.x += p.vx; p.y += p.vy; p.angle += p.spin
      if (p.y > h + 30) { p.y = -30; p.x = Math.random() * w }
    }
  }

  draw() {
    const { ctx, width: W, height: H } = this.game
    const { isWin, levelIdx } = this
    const levelNum  = levelIdx + 1
    const isLastLvl = levelIdx >= (CONFIG.LEVELS.length - 1)
    const safeTop   = this.game.safeTop || 0
    const cx        = W / 2
    const padX      = 16

    // ── 背景：天蓝渐变 ──
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,    '#5BC8F5')
    bg.addColorStop(0.42, '#7DD6F8')
    bg.addColorStop(0.72, '#A8E6FF')
    bg.addColorStop(1,    '#C5F0FF')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── 彩屑（胜利时） ──
    for (const p of this.confetti) {
      ctx.save()
      ctx.globalAlpha = p.alpha * 0.80
      ctx.translate(p.x, p.y); ctx.rotate(p.angle)
      ctx.font = `${p.size}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(p.icon, 0, 0)
      ctx.restore()
    }

    // ── 主内容区起点（留出安全区） ──
    let cy = safeTop + 28

    // ── 大图标 ──
    const iconY   = cy + 36
    ctx.save()
    ctx.font = '64px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (isWin) {
      // 胜利：上下弹跳
      const bounce = Math.sin(this.frame * 0.09) * 5
      ctx.fillText(e('🏆'), cx, iconY + bounce)
    } else {
      // 失败：缓慢呼吸缩放（周期约3秒，幅度 ±3%）
      const breathScale = 1 + Math.sin(this.frame * 0.035) * 0.03
      ctx.translate(cx, iconY)
      ctx.scale(breathScale, breathScale)
      ctx.fillText(e('😔'), 0, 0)
    }
    ctx.restore()
    cy = iconY + 52

    // ── 关卡标题 ──
    ctx.save()
    ctx.font = 'bold 26px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (isWin) {
      // 金色描边文字
      const g = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0)
      g.addColorStop(0, '#E8A000')
      g.addColorStop(0.5, '#FFD740')
      g.addColorStop(1, '#E8A000')
      ctx.fillStyle = g
      ctx.shadowColor = 'rgba(255,200,0,0.45)'
      ctx.shadowBlur  = 8
      ctx.fillText(isLastLvl ? '全部通关！太强了！' : `第 ${levelNum} 关通过！`, cx, cy)
    } else {
      ctx.fillStyle = '#2a6080'
      ctx.fillText(`第 ${levelNum} 关失败`, cx, cy)
    }
    ctx.restore()
    cy += 36

    // ── 星级评定（通关时） ──
    if (isWin) {
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const litCount = Math.min(this.stars, Math.floor(this.frame / 30) + 1)
      for (let i = 0; i < 3; i++) {
        const lit = i < litCount
        ctx.globalAlpha = lit ? 1 : 0.22
        const sb       = (lit && i === 1) ? Math.sin(this.frame * 0.10) * 4 : 0
        const justLit  = i === litCount - 1 && this.frame < litCount * 30 + 12
        const scale    = justLit ? 1 + Math.sin((this.frame - (litCount - 1) * 30) / 12 * Math.PI) * 0.36 : 1
        ctx.save()
        ctx.translate(cx - 44 + i * 44, cy + sb)
        ctx.scale(scale, scale)
        ctx.font = '34px sans-serif'
        ctx.fillText(lit ? e('⭐') : '☆', 0, 0)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      ctx.restore()
      cy += 52
    }

    // ── 失败时：剩余机会 ──
    if (!isWin) {
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(40,90,130,0.65)'
      ctx.fillText('剩余机会', cx, cy)
      ctx.font = '28px sans-serif'
      ctx.fillStyle = '#2a6080'
      const hearts = '\u2665'.repeat(this.lives) + '\u2661'.repeat(Math.max(0, 3 - this.lives))
      ctx.fillText(hearts, cx, cy + 26)
      ctx.restore()
      cy += 54
    }

    // ── 两格数据卡片 ──
    const cardW  = W - padX * 2
    const halfW  = (cardW - 12) / 2
    const dataH  = 72
    const dataY  = cy

    // 左：赢车数
    drawGlassCard(ctx, padX, dataY, halfW, dataH, 14, 'rgba(220,242,255,0.75)')
    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(30,100,160,0.60)'
    ctx.fillText(e('🚗 赢得车辆'), padX + halfW / 2, dataY + 22)
    ctx.font = 'bold 24px sans-serif'
    ctx.fillStyle = '#1a6090'
    ctx.fillText(`${this.displayCars} 辆`, padX + halfW / 2, dataY + 50)
    ctx.restore()

    // 右：得分
    const rx = padX + halfW + 12
    drawGlassCard(ctx, rx, dataY, halfW, dataH, 14, 'rgba(220,242,255,0.75)')
    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(30,100,160,0.60)'
    ctx.fillText(e('💰 本关得分'), rx + halfW / 2, dataY + 22)
    ctx.font = 'bold 24px sans-serif'
    ctx.fillStyle = '#1a6090'
    ctx.fillText(`${this.displayScore}`, rx + halfW / 2, dataY + 50)
    ctx.restore()

    cy = dataY + dataH + 16

    // ── 励志语 ──
    const tips = isWin
      ? ['太棒了！继续赢下去！', '车到成功！再接再厉！', '人生赢家！继续冲！']
      : ['失败是成功之母，再来！', '调整策略，下关必赢！', '加油！车子等你来拿！']
    ctx.save()
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(30,90,140,0.55)'
    ctx.fillText(tips[Math.floor(this.frame / 200) % tips.length], cx, cy)
    ctx.restore()
    cy += 28

    // ── 按钮区 ──
    const btnH = 50
    const btnR = btnH / 2

    if (isWin && !isLastLvl) {
      // ① 主按钮：🚀 下一关（橙金色渐变，全宽，脉冲缩放）
      const scale  = 1 + Math.sin(this.frame * 0.08) * 0.025
      const nbw    = cardW
      const nbx    = padX
      ctx.save()
      ctx.translate(cx, cy + btnH / 2)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -(cy + btnH / 2))
      const ng = ctx.createLinearGradient(nbx, cy, nbx, cy + btnH)
      ng.addColorStop(0, '#FFB020')
      ng.addColorStop(1, '#FF7800')
      ctx.fillStyle = ng
      roundRect(ctx, nbx, cy, nbw, btnH, btnR); ctx.fill()
      // 顶部高光
      const nhg = ctx.createLinearGradient(nbx, cy, nbx, cy + btnH * 0.50)
      nhg.addColorStop(0, 'rgba(255,255,255,0.32)')
      nhg.addColorStop(1, 'rgba(255,255,255,0.00)')
      ctx.fillStyle = nhg
      roundRect(ctx, nbx, cy, nbw, btnH * 0.50, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.20)'; ctx.shadowBlur = 4
      ctx.fillText(e('🚀 下一关'), cx, cy + btnH / 2)
      ctx.restore()
      this.nextBtn = { x: nbx, y: cy, w: nbw, h: btnH }
      cy += btnH + 10

      // ② 第二行：重玩本关 + 首页（浅玻璃胶囊）
      const bw2 = (cardW - 12) / 2
      // 重玩
      drawGlassCard(ctx, padX, cy, bw2, btnH, btnR, 'rgba(220,240,255,0.62)')
      ctx.save()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#1a5070'
      ctx.fillText(e('🔄 重玩本关'), padX + bw2 / 2, cy + btnH / 2)
      ctx.restore()
      this.retryBtn = { x: padX, y: cy, w: bw2, h: btnH }

      // 首页
      const hx = padX + bw2 + 12
      drawGlassCard(ctx, hx, cy, bw2, btnH, btnR, 'rgba(220,240,255,0.62)')
      ctx.save()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#1a5070'
      ctx.fillText(e('🏠 首页'), hx + bw2 / 2, cy + btnH / 2)
      ctx.restore()
      this.homeBtn = { x: hx, y: cy, w: bw2, h: btnH }

    } else if (isWin && isLastLvl) {
      // 最终通关：查看彩蛋 + 首页
      const bw2  = (cardW - 12) / 2
      const btn1X = padX
      const btn2X = padX + bw2 + 12

      const ng = ctx.createLinearGradient(btn1X, cy, btn1X, cy + btnH)
      ng.addColorStop(0, '#FFB020'); ng.addColorStop(1, '#FF7800')
      ctx.save()
      ctx.fillStyle = ng
      roundRect(ctx, btn1X, cy, bw2, btnH, btnR); ctx.fill()
      const nhg = ctx.createLinearGradient(btn1X, cy, btn1X, cy + btnH * 0.50)
      nhg.addColorStop(0, 'rgba(255,255,255,0.30)'); nhg.addColorStop(1, 'rgba(255,255,255,0.00)')
      ctx.fillStyle = nhg
      roundRect(ctx, btn1X, cy, bw2, btnH * 0.50, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.fillText(e('🎉 查看彩蛋'), btn1X + bw2 / 2, cy + btnH / 2)
      ctx.restore()
      this.nextBtn  = { x: btn1X, y: cy, w: bw2, h: btnH }
      this.retryBtn = null

      drawGlassCard(ctx, btn2X, cy, bw2, btnH, btnR, 'rgba(220,240,255,0.62)')
      ctx.save()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#1a5070'
      ctx.fillText(e('🏠 首页'), btn2X + bw2 / 2, cy + btnH / 2)
      ctx.restore()
      this.homeBtn = { x: btn2X, y: cy, w: bw2, h: btnH }

    } else {
      // 失败：再试一次 / 分享得机会 + 首页
      const bw2  = (cardW - 12) / 2
      const btn1X = padX
      const btn2X = padX + bw2 + 12

      ctx.save()
      if (this.lives > 0) {
        // 有机会：橙红主按钮
        const g = ctx.createLinearGradient(btn1X, cy, btn1X, cy + btnH)
        g.addColorStop(0, '#FF8040'); g.addColorStop(1, '#E74C3C')
        ctx.fillStyle = g
        roundRect(ctx, btn1X, cy, bw2, btnH, btnR); ctx.fill()
        const hg = ctx.createLinearGradient(btn1X, cy, btn1X, cy + btnH * 0.50)
        hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = hg
        roundRect(ctx, btn1X, cy, bw2, btnH * 0.50, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        ctx.fillText(e('🔄 再试一次'), btn1X + bw2 / 2, cy + btnH / 2)
        this.retryBtn = { x: btn1X, y: cy, w: bw2, h: btnH }
        this.shareBtn = null
      } else {
        // 无机会：分享获得机会（绿色微信风）
        const g = ctx.createLinearGradient(btn1X, cy, btn1X, cy + btnH)
        g.addColorStop(0, '#07C160'); g.addColorStop(1, '#06a353')
        ctx.fillStyle = g
        roundRect(ctx, btn1X, cy, bw2, btnH, btnR); ctx.fill()
        const hg = ctx.createLinearGradient(btn1X, cy, btn1X, cy + btnH * 0.50)
        hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = hg
        roundRect(ctx, btn1X, cy, bw2, btnH * 0.50, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        ctx.fillText(e('📣 分享得机会'), btn1X + bw2 / 2, cy + btnH / 2)
        this.shareBtn  = { x: btn1X, y: cy, w: bw2, h: btnH }
        this.retryBtn  = null
      }
      ctx.restore()

      // 首页
      drawGlassCard(ctx, btn2X, cy, bw2, btnH, btnR, 'rgba(220,240,255,0.62)')
      ctx.save()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#1a5070'
      ctx.fillText(e('🏠 首页'), btn2X + bw2 / 2, cy + btnH / 2)
      ctx.restore()
      this.homeBtn = { x: btn2X, y: cy, w: bw2, h: btnH }
      cy += btnH + 10

      // 等待恢复提示（仅机会=0时）
      if (this.lives <= 0) {
        const secs = getRecoverSecondsLeft()
        const mm   = String(Math.floor(secs / 60)).padStart(2, '0')
        const ss   = String(secs % 60).padStart(2, '0')
        drawGlassCard(ctx, padX, cy, cardW, 44, 12, 'rgba(210,235,255,0.50)')
        ctx.save()
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(30,90,140,0.60)'
        ctx.fillText(e(`⏰ ${mm}:${ss} 后恢复 1 次机会`), cx, cy + 22)
        ctx.restore()
      }
    }
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    const isDaily   = this._onClose !== null
    const isLastLvl = !isDaily && this.levelIdx >= (CONFIG.LEVELS.length - 1)

    if (hit(this.nextBtn)) {
      if (isDaily) {
        this._onClose()    // 每日模式：返回 DailyScene
      } else if (isLastLvl) {
        this.game.showAllClear()   // 最终关：手动也可跳彩蛋
      } else {
        this.game.showGame(this.levelIdx + 1)
      }
      return
    }
    if (hit(this.retryBtn)) {
      if (isDaily) {
        this._onClose()   // 每日模式重玩也只回 DailyScene（已played，不能再进）
      } else {
        const lvl = this.isWin ? 0 : this.levelIdx
        this.game.showGame(lvl)
      }
      return
    }
    if (hit(this.shareBtn)) {
      // 分享成功后机会+1，刷新当前场景状态
      shareForLife((next) => {
        if (next !== null) {
          this.lives    = next
          this.shareBtn = null  // 触发重绘时切换回"再试一次"按钮
        }
      })
      return
    }
    if (hit(this.homeBtn)) {
      if (isDaily) {
        this._onClose()   // 每日模式首页按钮也返回 DailyScene
      } else {
        this.game.showStart()
      }
    }
  }
}
