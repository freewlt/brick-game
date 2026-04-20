// 结算场景 - 赢了个赢（关卡制）
import { roundRect } from '../utils/draw.js'
import { spendLife, getLives, getRecoverSecondsLeft, shareForLife, saveProgress } from '../utils/storage.js'
import { CONFIG } from '../config.js'

export default class ResultScene {
  constructor(game, score, carsWon, levelIdx, isWin, stars = 3) {
    this.game     = game
    this.score    = score
    this.carsWon  = carsWon
    this.levelIdx = levelIdx   // 0-based 当前关卡索引
    this.isWin    = isWin      // true=过关，false=失败
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
    const icons = ['🚗', '🏎️', '🚙', '🛻', '🚕', '⭐', '🏆']
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
    if (!this.isWin && !this._lifeSpent) {
      this._lifeSpent = true
      this.lives = spendLife()   // 失败扣1次机会
    }
    if (this.isWin) {
      // 通关：上传排行榜数据（已通关数 = levelIdx + 1）
      saveProgress(this.levelIdx + 1)
      this.lives = getLives()
      // 最后一关通关：1.2秒后自动跳到全通关彩蛋页
      if (this.levelIdx >= (CONFIG.LEVELS.length - 1)) {
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
    const { ctx, width, height } = this.game
    const { isWin, levelIdx } = this
    const levelNum   = levelIdx + 1
    const isLastLvl  = levelIdx >= (CONFIG.LEVELS.length - 1)

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, height)
    if (isWin) {
      bg.addColorStop(0, '#0d1f10'); bg.addColorStop(1, '#0f3460')
    } else {
      bg.addColorStop(0, '#1a0a0a'); bg.addColorStop(1, '#2d1515')
    }
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // 彩屑（胜利时）
    for (const p of this.confetti) {
      ctx.save()
      ctx.globalAlpha = p.alpha * 0.75
      ctx.translate(p.x, p.y); ctx.rotate(p.angle)
      ctx.font = `${p.size}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(p.icon, 0, 0)
      ctx.restore()
    }

    // 主卡片
    const cardX = 20, cardY = 55, cardW = width - 40, cardH = height - 55 - 16
    ctx.save()
    ctx.fillStyle = 'rgba(15,25,45,0.96)'
    roundRect(ctx, cardX, cardY, cardW, cardH, 22); ctx.fill()
    ctx.strokeStyle = isWin ? 'rgba(255,215,0,0.45)' : 'rgba(200,60,60,0.4)'
    ctx.lineWidth = 1.5
    roundRect(ctx, cardX, cardY, cardW, cardH, 22); ctx.stroke()
    ctx.restore()

    const cx = width / 2

    // 结果大图标
    const iconY = cardY + 52
    const bounce = Math.sin(this.frame * 0.09) * 6
    ctx.save()
    ctx.font = '56px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(isWin ? '🏆' : '😔', cx, iconY + bounce)
    ctx.restore()

    // 标题
    ctx.save()
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (isWin) {
      const g = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0)
      g.addColorStop(0, '#FFD700'); g.addColorStop(1, '#FFA500')
      ctx.fillStyle = g
      ctx.fillText(isLastLvl ? '全部通关！太强了！' : `第 ${levelNum} 关通过！`, cx, iconY + 68)
    } else {
      ctx.fillStyle = '#FF6B6B'
      ctx.fillText(`第 ${levelNum} 关失败`, cx, iconY + 68)
    }
    ctx.restore()

    // 星级（通关才显示）—— 逐颗延迟亮起（每30帧点亮一颗）
    const starY = iconY + 110
    if (isWin) {
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      // 已亮颗数：frame每30帧+1颗，最多到 this.stars
      const litCount = Math.min(this.stars, Math.floor(this.frame / 30) + 1)
      for (let i = 0; i < 3; i++) {
        const lit = i < litCount
        ctx.globalAlpha = lit ? 1 : 0.2
        // 中间颗加弹跳
        const sb = (lit && i === 1) ? Math.sin(this.frame * 0.1) * 4 : 0
        // 刚点亮时做一个缩放弹出效果
        const justLit = i === litCount - 1 && this.frame < litCount * 30 + 12
        const scale   = justLit ? 1 + Math.sin((this.frame - (litCount - 1) * 30) / 12 * Math.PI) * 0.35 : 1
        ctx.save()
        ctx.translate(cx - 40 + i * 40, starY + sb)
        ctx.scale(scale, scale)
        ctx.font = '32px sans-serif'
        ctx.fillText(lit ? '⭐' : '☆', 0, 0)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // ---- 失败时：剩余机会显示 ----
    if (!isWin) {
      const livesY = iconY + 100
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(255,180,180,0.6)'
      ctx.fillText('剩余机会', cx, livesY)
      ctx.font = '28px sans-serif'
      const hearts = '❤️'.repeat(this.lives) + '🖤'.repeat(Math.max(0, 3 - this.lives))
      ctx.fillText(hearts, cx, livesY + 26)
      ctx.restore()
    }

    // 数据两格
    const dataY  = isWin ? starY + 46 : iconY + 148
    const halfW  = (cardW - 48) / 2
    const dataH  = 64

    // 左：赢车数
    ctx.save()
    ctx.fillStyle = 'rgba(255,215,0,0.07)'
    roundRect(ctx, cardX + 16, dataY, halfW, dataH, 12); ctx.fill()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,215,0,0.65)'
    ctx.fillText('🚗 赢得车辆', cardX + 16 + halfW / 2, dataY + 18)
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#FFD700'
    ctx.fillText(`${this.displayCars} 辆`, cardX + 16 + halfW / 2, dataY + 44)
    ctx.restore()

    // 右：得分
    const rx = cardX + 16 + halfW + 16
    ctx.save()
    ctx.fillStyle = 'rgba(100,200,255,0.07)'
    roundRect(ctx, rx, dataY, halfW, dataH, 12); ctx.fill()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(160,216,239,0.65)'
    ctx.fillText('💰 本关得分', rx + halfW / 2, dataY + 18)
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#a0d8ef'
    ctx.fillText(`${this.displayScore}`, rx + halfW / 2, dataY + 44)
    ctx.restore()

    // 励志语
    const tipY = dataY + dataH + 22
    const tips = isWin
      ? ['太棒了！继续赢下去！', '车到成功！再接再厉！', '人生赢家！继续冲！']
      : ['失败是成功之母，再来！', '调整策略，下关必赢！', '加油！车子等你来拿！']
    ctx.save()
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(200,220,255,0.55)'
    ctx.fillText(tips[Math.floor(this.frame / 200) % tips.length], cx, tipY)
    ctx.restore()

    // ===== 按钮区 =====
    const btnAreaTop = cardY + cardH - (isWin ? 120 : 160)
    const btnH = 48
    const btnR = 24

    if (isWin && !isLastLvl) {
      // 下一关（主按钮，全宽）
      const bx = cardX + 16, bw = cardW - 32
      ctx.save()
      const g = ctx.createLinearGradient(bx, btnAreaTop, bx, btnAreaTop + btnH)
      g.addColorStop(0, '#FFD700'); g.addColorStop(1, '#FF8C00')
      ctx.fillStyle = g
      roundRect(ctx, bx, btnAreaTop, bw, btnH, btnR); ctx.fill()
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1a1a2e'
      ctx.fillText('🚀 下一关', cx, btnAreaTop + btnH / 2)
      this.nextBtn = { x: bx, y: btnAreaTop, w: bw, h: btnH }
      ctx.restore()

      // 第二行：重玩 + 首页
      const btn2Y = btnAreaTop + btnH + 10
      const bw2   = (cardW - 32 - 12) / 2
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
      roundRect(ctx, cardX + 16, btn2Y, bw2, btnH, btnR); ctx.fill(); ctx.stroke()
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
      ctx.fillText('🔄 重玩本关', cardX + 16 + bw2 / 2, btn2Y + btnH / 2)
      this.retryBtn = { x: cardX + 16, y: btn2Y, w: bw2, h: btnH }
      ctx.restore()

      const hx2 = cardX + 16 + bw2 + 12
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
      roundRect(ctx, hx2, btn2Y, bw2, btnH, btnR); ctx.fill(); ctx.stroke()
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
      ctx.fillText('🏠 首页', hx2 + bw2 / 2, btn2Y + btnH / 2)
      this.homeBtn = { x: hx2, y: btn2Y, w: bw2, h: btnH }
      ctx.restore()

    } else if (isWin && isLastLvl) {
      // 最终通关：显示"即将进入彩蛋页"提示 + 手动按钮作为备选
      const bw2   = (cardW - 32 - 12) / 2
      const btn1X = cardX + 16, btn2X = cardX + 16 + bw2 + 12

      // 主按钮：进入彩蛋
      ctx.save()
      const g = ctx.createLinearGradient(btn1X, btnAreaTop, btn1X, btnAreaTop + btnH)
      g.addColorStop(0, '#FFD700'); g.addColorStop(1, '#FF8C00')
      ctx.fillStyle = g
      roundRect(ctx, btn1X, btnAreaTop, bw2, btnH, btnR); ctx.fill()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1a1a2e'
      ctx.fillText('🎉 查看彩蛋', btn1X + bw2 / 2, btnAreaTop + btnH / 2)
      this.nextBtn  = { x: btn1X, y: btnAreaTop, w: bw2, h: btnH }   // 复用 nextBtn 跳转
      this.retryBtn = null
      ctx.restore()

      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5
      roundRect(ctx, btn2X, btnAreaTop, bw2, btnH, btnR); ctx.fill(); ctx.stroke()
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
      ctx.fillText('🏠 首页', btn2X + bw2 / 2, btnAreaTop + btnH / 2)
      this.homeBtn = { x: btn2X, y: btnAreaTop, w: bw2, h: btnH }
      ctx.restore()

    } else {
      // 失败：三行按钮
      const bw2 = (cardW - 32 - 12) / 2

      // 第1行：重试 or 分享获得机会
      const btn1X = cardX + 16, btn2X = cardX + 16 + bw2 + 12
      ctx.save()
      if (this.lives > 0) {
        // 有机会：正常重试按钮（红色主色）
        const g = ctx.createLinearGradient(btn1X, btnAreaTop, btn1X, btnAreaTop + btnH)
        g.addColorStop(0, '#FF6B35'); g.addColorStop(1, '#E74C3C')
        ctx.fillStyle = g
        roundRect(ctx, btn1X, btnAreaTop, bw2, btnH, btnR); ctx.fill()
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
        ctx.fillText('🔄 再试一次', btn1X + bw2 / 2, btnAreaTop + btnH / 2)
        this.retryBtn = { x: btn1X, y: btnAreaTop, w: bw2, h: btnH }
        this.shareBtn = null
      } else {
        // 无机会：分享按钮（绿色微信风）
        const g = ctx.createLinearGradient(btn1X, btnAreaTop, btn1X, btnAreaTop + btnH)
        g.addColorStop(0, '#07C160'); g.addColorStop(1, '#06a353')
        ctx.fillStyle = g
        roundRect(ctx, btn1X, btnAreaTop, bw2, btnH, btnR); ctx.fill()
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
        ctx.fillText('📣 分享得机会', btn1X + bw2 / 2, btnAreaTop + btnH / 2)
        this.shareBtn  = { x: btn1X, y: btnAreaTop, w: bw2, h: btnH }
        this.retryBtn  = null
      }
      ctx.restore()

      // 首页按钮
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
      roundRect(ctx, btn2X, btnAreaTop, bw2, btnH, btnR); ctx.fill(); ctx.stroke()
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
      ctx.fillText('🏠 首页', btn2X + bw2 / 2, btnAreaTop + btnH / 2)
      this.homeBtn = { x: btn2X, y: btnAreaTop, w: bw2, h: btnH }
      ctx.restore()

      // 第2行：等待恢复（仅机会=0时）
      if (this.lives <= 0) {
        const waitY = btnAreaTop + btnH + 10
        const waitW = cardW - 32
        const secs  = getRecoverSecondsLeft()
        const mm    = String(Math.floor(secs / 60)).padStart(2, '0')
        const ss    = String(secs % 60).padStart(2, '0')
        ctx.save()
        ctx.fillStyle   = 'rgba(255,255,255,0.05)'
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
        roundRect(ctx, cardX + 16, waitY, waitW, btnH, btnR); ctx.fill(); ctx.stroke()
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(200,220,255,0.55)'
        ctx.fillText(`⏰ ${mm}:${ss} 后恢复 1 次机会`, cx, waitY + btnH / 2)
        ctx.restore()
      }
    }
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    const isLastLvl = this.levelIdx >= (CONFIG.LEVELS.length - 1)

    if (hit(this.nextBtn)) {
      if (isLastLvl) {
        this.game.showAllClear()   // 最终关：手动也可跳彩蛋
      } else {
        this.game.showGame(this.levelIdx + 1)
      }
      return
    }
    if (hit(this.retryBtn)) {
      const lvl = this.isWin ? 0 : this.levelIdx
      this.game.showGame(lvl)
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
      this.game.showStart()
    }
  }
}
