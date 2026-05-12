// 工具函数
export function roundRect(ctx, x, y, w, h, r) {
  let tl, tr, bl, br
  if (r && typeof r === 'object') {
    tl = r.tl || 0; tr = r.tr || 0; bl = r.bl || 0; br = r.br || 0
  } else {
    tl = tr = bl = br = (r || 0)
  }
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  ctx.lineTo(x, y + tl)
  ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

// 绘制带阴影的圆角矩形
export function drawCard(ctx, x, y, w, h, r, fillColor, shadowColor = 'rgba(0,0,0,0.15)') {
  ctx.save()
  ctx.shadowColor = shadowColor
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 4
  ctx.fillStyle = fillColor
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.restore()
}

// 绘制文字（自动描边+填色）
export function drawText(ctx, text, x, y, fontSize, color, align = 'center', bold = false) {
  ctx.save()
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

// 剥掉 ️ 变体选择符，避免微信小游戏 Canvas 渲染成小方块
export function stripVS(str) {
  return String(str).replace(/️/g, '')
}

// 四向玻璃高光卡片（天蓝玻璃主题统一卡片底）
// opts:
//   sides:       'all' | 'top'        默认 'all'，只画顶部高光时设 'top'
//   topAlpha:    顶部高光起始 alpha    默认 0.62
//   midAlpha:    顶部高光中段 alpha    默认 0.18
//   sideAlpha:   左侧高光起始 alpha    默认 0.28
//   rightAlpha:  右侧高光起始 alpha    默认 0.16
//   bottomAlpha: 底部反光起始 alpha    默认 0.20
//   border:      外描边颜色            默认 'rgba(160,215,245,0.60)'
export function drawGlassCard(ctx, x, y, w, h, r, baseColor, opts = {}) {
  const {
    sides       = 'all',
    topAlpha    = 0.62,
    midAlpha    = 0.18,
    sideAlpha   = 0.28,
    rightAlpha  = 0.16,
    bottomAlpha = 0.20,
    border      = 'rgba(160,215,245,0.60)',
  } = opts

  ctx.save()
  ctx.fillStyle = baseColor
  roundRect(ctx, x, y, w, h, r); ctx.fill()

  // 顶部高光
  const tg = ctx.createLinearGradient(x, y, x, y + h * 0.44)
  tg.addColorStop(0,   `rgba(255,255,255,${topAlpha})`)
  tg.addColorStop(0.5, `rgba(255,255,255,${midAlpha})`)
  tg.addColorStop(1,   'rgba(255,255,255,0.00)')
  ctx.fillStyle = tg
  roundRect(ctx, x, y, w, h * 0.44, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()

  if (sides === 'all') {
    // 左侧
    const lg = ctx.createLinearGradient(x, y, x + w * 0.14, y)
    lg.addColorStop(0, `rgba(255,255,255,${sideAlpha})`)
    lg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = lg
    roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
    // 右侧
    const rg = ctx.createLinearGradient(x + w, y, x + w - w * 0.10, y)
    rg.addColorStop(0, `rgba(255,255,255,${rightAlpha})`)
    rg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = rg
    roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()
    // 底部反光
    const bg2 = ctx.createLinearGradient(x, y + h, x, y + h - h * 0.16)
    bg2.addColorStop(0, `rgba(255,255,255,${bottomAlpha})`)
    bg2.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = bg2
    roundRect(ctx, x, y + h - h * 0.16, w, h * 0.16, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()
  }

  // 边框
  ctx.strokeStyle = border
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}
