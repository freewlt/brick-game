import { describe, it, expect, vi } from 'vitest'
import { measureCached, drawGlassCard } from '../src/utils/draw.js'

function makeCtx(measureMap = {}) {
  return {
    save: vi.fn(), restore: vi.fn(),
    font: '',
    measureText: vi.fn((text) => ({ width: measureMap[text] ?? text.length * 7 })),
  }
}

describe('measureCached', () => {
  it('首次调用时透传到 ctx.measureText 并写入缓存', () => {
    const ctx = makeCtx({ '第1关': 86 })
    const cache = new Map()
    const w = measureCached(ctx, 'bold 28px sans-serif', '第1关', cache)
    expect(w).toBe(86)
    expect(ctx.measureText).toHaveBeenCalledTimes(1)
    expect(cache.size).toBe(1)
  })

  it('同 font + text 的第二次调用走缓存，不再调 measureText', () => {
    const ctx = makeCtx({ '第1关': 86 })
    const cache = new Map()
    measureCached(ctx, 'bold 28px sans-serif', '第1关', cache)
    const w2 = measureCached(ctx, 'bold 28px sans-serif', '第1关', cache)
    expect(w2).toBe(86)
    expect(ctx.measureText).toHaveBeenCalledTimes(1)   // 第二次未触发
  })

  it('不同 font 视为不同 key，会重新测量', () => {
    const ctx = makeCtx({ '目标': 26 })
    const cache = new Map()
    measureCached(ctx, 'bold 13px sans-serif', '目标', cache)
    measureCached(ctx, 'bold 14px sans-serif', '目标', cache)
    expect(ctx.measureText).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(2)
  })

  it('不同 text 视为不同 key', () => {
    const ctx = makeCtx({ '第1关': 86, '第10关': 102 })
    const cache = new Map()
    measureCached(ctx, 'bold 28px sans-serif', '第1关', cache)
    measureCached(ctx, 'bold 28px sans-serif', '第10关', cache)
    expect(ctx.measureText).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(2)
  })

  it('save/restore 保护 ctx.font，调用后不留副作用', () => {
    const ctx = makeCtx()
    const cache = new Map()
    measureCached(ctx, 'bold 28px sans-serif', 'X', cache)
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })
})

// ── drawGlassCard cache 测试 ──
function makeGradCtx() {
  const gradients = []
  const ctx = {
    save: vi.fn(), restore: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    fill: vi.fn(), stroke: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(), closePath: vi.fn(),
    createLinearGradient: vi.fn((...args) => {
      const g = { addColorStop: vi.fn(), _args: args }
      gradients.push(g)
      return g
    }),
  }
  return { ctx, gradients }
}

describe('drawGlassCard cache', () => {
  it('不传 cache 时每次调用都创建新渐变', () => {
    const { ctx, gradients } = makeGradCtx()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000')
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000')
    expect(gradients.length).toBe(8)   // 每次 4 个，共 8 个
  })

  it('传入 cache 时第二次调用命中缓存，不再创建渐变', () => {
    const { ctx, gradients } = makeGradCtx()
    const cache = new Map()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    expect(gradients.length).toBe(4)   // 第二次全部命中，只创建了 4 个
    expect(cache.size).toBe(4)
  })

  it('不同 color 不共享缓存', () => {
    const { ctx, gradients } = makeGradCtx()
    const cache = new Map()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#00ff00', {}, cache)
    expect(gradients.length).toBe(8)
    expect(cache.size).toBe(8)
  })

  it('不同尺寸不共享缓存', () => {
    const { ctx, gradients } = makeGradCtx()
    const cache = new Map()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    drawGlassCard(ctx, 0, 0, 60, 60, 8, '#ff0000', {}, cache)
    expect(gradients.length).toBe(8)
  })
})
