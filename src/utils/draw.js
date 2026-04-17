// 工具函数
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
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
