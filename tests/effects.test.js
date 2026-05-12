import { describe, it, expect, beforeEach, vi } from 'vitest'
import FloatText from '../src/effects/FloatText.js'
import MatchParticle from '../src/effects/MatchParticle.js'

// Canvas API mock：只关心调用了哪些方法，不关心实际像素
function makeCtxMock() {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    globalAlpha: 1, font: '', textAlign: '', textBaseline: '', fillStyle: '',
  }
}

describe('FloatText', () => {
  it('可以从 src/effects/FloatText.js 默认导入', () => {
    expect(typeof FloatText).toBe('function')
  })

  it('构造时设默认 color=#FFD700、alpha=1、vy=-2、life=60', () => {
    const t = new FloatText('+3', 10, 20)
    expect(t.text).toBe('+3')
    expect(t.x).toBe(10)
    expect(t.y).toBe(20)
    expect(t.color).toBe('#FFD700')
    expect(t.alpha).toBe(1)
    expect(t.vy).toBe(-2)
    expect(t.life).toBe(60)
  })

  it('update 让 y 上移、life 递减、alpha 衰减到 0', () => {
    const t = new FloatText('hi', 0, 100)
    for (let i = 0; i < 60; i++) t.update()
    expect(t.life).toBe(0)
    expect(t.alpha).toBe(0)
    expect(t.isDead()).toBe(true)
  })

  it('draw 调用 ctx.fillText 输出文本', () => {
    const t = new FloatText('+10', 50, 60, '#FF0000')
    const ctx = makeCtxMock()
    t.draw(ctx)
    expect(ctx.fillText).toHaveBeenCalledWith('+10', 50, 60)
  })
})

describe('MatchParticle', () => {
  it('可以从 src/effects/MatchParticle.js 默认导入', () => {
    expect(typeof MatchParticle).toBe('function')
  })

  it('构造时 alpha=1、life=40、半径在 4-8 之间', () => {
    const p = new MatchParticle(0, 0, '#FF0000')
    expect(p.alpha).toBe(1)
    expect(p.life).toBe(40)
    expect(p.r).toBeGreaterThanOrEqual(4)
    expect(p.r).toBeLessThanOrEqual(8)
  })

  it('update 让 vy 受重力影响 (vy += 0.3)、life 递减', () => {
    const p = new MatchParticle(0, 0, '#FF0000')
    const vyBefore = p.vy
    p.update()
    expect(p.vy).toBeCloseTo(vyBefore + 0.3, 5)
    expect(p.life).toBe(39)
  })

  it('40 次 update 后 isDead 为 true', () => {
    const p = new MatchParticle(0, 0, '#FF0000')
    for (let i = 0; i < 40; i++) p.update()
    expect(p.isDead()).toBe(true)
  })

  it('draw 调用 ctx.arc 画圆', () => {
    const p = new MatchParticle(10, 20, '#00FF00')
    const ctx = makeCtxMock()
    p.draw(ctx)
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
  })
})
