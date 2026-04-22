// 成就解锁庆祝弹窗 - 赢了个赢
// 横向3卡轮播，用于通关后展示新成就
import { roundRect } from '../utils/draw.js'

function e(str) { return str.replace(/\uFE0F/g, '') }

// 四向玻璃高光卡片底（独立 helper）
function drawGlassCard(ctx, x, y, w, h, r, baseColor) {
  ctx.save()
  ctx.fillStyle = baseColor
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  // 顶部
  const tg = ctx.createLinearGradient(x, y, x, y + h * 0.46)
  tg.addColorStop(0,   'rgba(255,255,255,0.68)')
  tg.addColorStop(0.5, 'rgba(255,255,255,0.20)')
  tg.addColorStop(1,   'rgba(255,255,255,0.00)')
  ctx.fillStyle = tg
  roundRect(ctx, x, y, w, h * 0.46, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()
  // 左侧
  const lg = ctx.createLinearGradient(x, y, x + w * 0.14, y)
  lg.addColorStop(0, 'rgba(255,255,255,0.30)')
  lg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = lg
  roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
  // 右侧
  const rg = ctx.createLinearGradient(x + w, y, x + w - w * 0.10, y)
  rg.addColorStop(0, 'rgba(255,255,255,0.16)')
  rg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = rg
  roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()
  // 底部
  const bg = ctx.createLinearGradient(x, y + h, x, y + h - h * 0.16)
  bg.addColorStop(0, 'rgba(255,255,255,0.20)')
  bg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = bg
  roundRect(ctx, x, y + h - h * 0.16, w, h * 0.16, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()
  // 边框
  ctx.strokeStyle = 'rgba(200,235,255,0.72)'
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}

export default class AchievementUnlockPopup {
  constructor() {
    // 待展示的新成就列表（外部调用 show() 设置）
    this._achievements = []
    this._visible      = false
    this._focusIdx     = 0
    this._frame        = 0
    this._slideAnim    = 0
    // 触摸
    this._touchStartX  = 0
    this._touchStartY  = 0
    // 回调：关闭时调用
    this._onClose      = null
    // 按钮区域
    this._closeBtn     = null
    this._bgRect       = null
  }

  // 展示弹窗
  // achievements: 成就对象数组（CONFIG.ACHIEVEMENTS 的条目）
  // onClose: 关闭回调
  show(achievements, onClose = null) {
    if (!achievements || achievements.length === 0) return
    this._achievements = achievements
    this._focusIdx     = 0
    this._frame        = 0
    this._slideAnim    = 0
    this._visible      = true
    this._onClose      = onClose
  }

  hide() {
    this._visible = false
    if (this._onClose) this._onClose()
  }

  get visible() { return this._visible }

  update() {
    if (!this._visible) return
    this._frame++
    // 卡片切换弹性动画
    if (Math.abs(this._slideAnim) > 0.5) {
      this._slideAnim *= 0.70
    } else {
      this._slideAnim = 0
    }
  }

  draw(ctx, W, H) {
    if (!this._visible) return

    // ── 半透明遮罩 ──
    ctx.save()
    ctx.fillStyle = 'rgba(10,40,80,0.70)'
    ctx.fillRect(0, 0, W, H)
    this._bgRect = { x: 0, y: 0, w: W, h: H }

    // ── 弹窗卡片外框 ──
    const pw   = Math.min(W - 32, 360)
    const ph   = H * 0.66
    const px   = (W - pw) / 2
    const py   = (H - ph) / 2

    // 外框玻璃底（深蓝渐变背景）
    const popBg = ctx.createLinearGradient(px, py, px, py + ph)
    popBg.addColorStop(0, 'rgba(28,80,160,0.97)')
    popBg.addColorStop(1, 'rgba(10,40,100,0.97)')
    ctx.fillStyle = popBg
    roundRect(ctx, px, py, pw, ph, 28); ctx.fill()
    // 顶部亮边
    const popTg = ctx.createLinearGradient(px, py, px, py + ph * 0.35)
    popTg.addColorStop(0, 'rgba(255,255,255,0.22)')
    popTg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = popTg
    roundRect(ctx, px, py, pw, ph * 0.35, { tl: 28, tr: 28, bl: 0, br: 0 }); ctx.fill()
    // 外框描边
    ctx.strokeStyle = 'rgba(100,180,255,0.55)'
    ctx.lineWidth   = 1.5
    roundRect(ctx, px, py, pw, ph, 28); ctx.stroke()
    ctx.restore()

    // ── 装饰：散落小星星 ──
    ctx.save()
    ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip()
    const stars = [
      { rx: 0.07, ry: 0.08, s: 8 },  { rx: 0.90, ry: 0.06, s: 6 },
      { rx: 0.94, ry: 0.20, s: 5 },  { rx: 0.05, ry: 0.30, s: 5 },
      { rx: 0.85, ry: 0.55, s: 6 },  { rx: 0.10, ry: 0.65, s: 4 },
      { rx: 0.92, ry: 0.80, s: 5 },  { rx: 0.06, ry: 0.88, s: 4 },
    ]
    for (const st of stars) {
      const flicker = 0.45 + 0.35 * Math.sin(this._frame * 0.07 + st.rx * 12)
      ctx.globalAlpha = flicker
      ctx.fillStyle   = '#aadcff'
      const sx = px + st.rx * pw
      const sy = py + st.ry * ph
      const ss = st.s
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(this._frame * 0.015)
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        const b = a + Math.PI / 4
        ctx.lineTo(Math.cos(a) * ss, Math.sin(a) * ss)
        ctx.lineTo(Math.cos(b) * (ss * 0.32), Math.sin(b) * (ss * 0.32))
      }
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }
    ctx.restore()

    // ── 标题区 ──
    const titleCY = py + 36
    ctx.save()
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(e('🎉 成就达成！'), W / 2, titleCY)
    ctx.restore()

    const achs = this._achievements
    const focusIdx = this._focusIdx
    const prevIdx  = (focusIdx - 1 + achs.length) % achs.length
    const nextIdx  = (focusIdx + 1) % achs.length

    // ── 三卡轮播 ──
    const cardsTop = py + 58
    const cardH    = ph * 0.50

    const bigW    = pw * 0.46
    const smallW  = pw * 0.24
    const gap     = 8
    const bigX    = px + (pw - bigW) / 2 + this._slideAnim * W * 0.008
    const leftX   = bigX - smallW - gap
    const rightX  = bigX + bigW + gap

    if (achs.length > 1) {
      this._drawSmallCard(ctx, achs[prevIdx],  leftX,  cardsTop, smallW, cardH)
      this._drawSmallCard(ctx, achs[nextIdx],  rightX, cardsTop, smallW, cardH)
    }
    this._drawBigCard(ctx, achs[focusIdx], bigX, cardsTop, bigW, cardH)

    // ── 点状指示器 ──
    const dotY     = cardsTop + cardH + 16
    const dotR     = 4
    const dotGap   = 12
    const dotCount = Math.min(achs.length, 8)
    const dotStartX = W / 2 - ((dotCount - 1) * (dotR * 2 + dotGap)) / 2
    ctx.save()
    for (let i = 0; i < dotCount; i++) {
      const isFocus = i === focusIdx % dotCount
      ctx.beginPath()
      ctx.arc(dotStartX + i * (dotR * 2 + dotGap), dotY, isFocus ? dotR + 1 : dotR * 0.65, 0, Math.PI * 2)
      ctx.fillStyle = isFocus ? '#7EE8FF' : 'rgba(100,160,210,0.40)'
      ctx.fill()
    }
    ctx.restore()

    // ── 关闭按钮 ──
    const closeBtnW = pw * 0.60
    const closeBtnH = 48
    const closeBtnX = px + (pw - closeBtnW) / 2
    const closeBtnY = py + ph - closeBtnH - 20

    ctx.save()
    const cg = ctx.createLinearGradient(closeBtnX, closeBtnY, closeBtnX, closeBtnY + closeBtnH)
    cg.addColorStop(0, '#3DBEF5')
    cg.addColorStop(1, '#1890D0')
    ctx.fillStyle = cg
    roundRect(ctx, closeBtnX, closeBtnY, closeBtnW, closeBtnH, closeBtnH / 2)
    ctx.fill()
    // 高光
    const chg = ctx.createLinearGradient(closeBtnX, closeBtnY, closeBtnX, closeBtnY + closeBtnH * 0.5)
    chg.addColorStop(0, 'rgba(255,255,255,0.30)')
    chg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = chg
    roundRect(ctx, closeBtnX, closeBtnY, closeBtnW, closeBtnH * 0.5, { tl: closeBtnH / 2, tr: closeBtnH / 2, bl: 0, br: 0 })
    ctx.fill()
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('太棒了，继续！', W / 2, closeBtnY + closeBtnH / 2)
    ctx.restore()
    this._closeBtn = { x: closeBtnX, y: closeBtnY, w: closeBtnW, h: closeBtnH }
  }

  // 大卡（聚焦）
  _drawBigCard(ctx, ach, x, y, w, h) {
    const r = 20
    const baseColor = ach.color || '#2BAEE0'
    drawGlassCard(ctx, x, y, w, h, r, baseColor)

    // 名称标签
    const tagH = 24, tagPad = 12
    ctx.save()
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const tagW = ctx.measureText(ach.name).width + tagPad * 2
    const tagX = x + (w - tagW) / 2
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    roundRect(ctx, tagX, y + 10, tagW, tagH, tagH / 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(ach.name, x + w / 2, y + 10 + tagH / 2)
    ctx.restore()

    // 大图标
    ctx.save()
    ctx.font = `${w * 0.38}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(e(ach.icon), x + w / 2, y + h * 0.56)
    ctx.restore()

    // 底部描述
    ctx.save()
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillText(ach.desc, x + w / 2, y + h - 16)
    ctx.restore()

    // ✅ 右上角
    ctx.save()
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(e('✅'), x + w - 8, y + 8)
    ctx.restore()
  }

  // 小卡（侧边）
  _drawSmallCard(ctx, ach, x, y, w, h) {
    const r = 16
    drawGlassCard(ctx, x, y, w, h, r, 'rgba(40,100,200,0.55)')

    ctx.save()
    ctx.globalAlpha = 0.75
    ctx.font = `${w * 0.40}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(e(ach.icon), x + w / 2, y + h * 0.46)
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = 0.80
    ctx.font = `bold ${Math.max(8, w * 0.12)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#cce8ff'
    let name = ach.name
    if (ctx.measureText(name).width > w - 8) name = name.slice(0, 4) + '…'
    ctx.fillText(name, x + w / 2, y + h - 18)
    ctx.restore()
  }

  onTouchStart(x, y) {
    this._touchStartX = x
    this._touchStartY = y
  }

  onTouchMove(_x, _y) {}

  onTouchEnd(x, y) {
    if (!this._visible) return false

    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    // 关闭按钮
    if (hit(this._closeBtn)) {
      this.hide()
      return true
    }

    // 水平滑动切换卡片
    const dx = x - this._touchStartX
    const dy = y - this._touchStartY
    if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy) * 0.7) {
      const total = this._achievements.length
      if (total > 1) {
        if (dx < 0) {
          this._focusIdx = (this._focusIdx + 1) % total
          this._slideAnim = -16
        } else {
          this._focusIdx = (this._focusIdx - 1 + total) % total
          this._slideAnim = 16
        }
      }
      return true
    }

    // 点击遮罩任意处（非弹窗区域）也可关闭
    const pw = Math.min(this._bgRect ? this._bgRect.w - 32 : 328, 360)
    const ph = this._bgRect ? this._bgRect.h * 0.66 : 400
    const px = ((this._bgRect ? this._bgRect.w : 375) - pw) / 2
    const py = ((this._bgRect ? this._bgRect.h : 667) - ph) / 2
    const inPopup = x >= px && x <= px + pw && y >= py && y <= py + ph
    if (!inPopup) {
      this.hide()
    }

    return true
  }
}
