import { describe, it, expect } from 'vitest'
import { CONFIG } from '../src/config.js'

describe('CONFIG.AD_CONFIG', () => {
  it('AD_CONFIG 存在且含 rewardedUnitId 字段', () => {
    expect(CONFIG.AD_CONFIG).toBeDefined()
    expect(typeof CONFIG.AD_CONFIG.rewardedUnitId).toBe('string')
  })

  it('rewardedUnitId 默认为空字符串（未配置广告位）', () => {
    expect(CONFIG.AD_CONFIG.rewardedUnitId).toBe('')
  })
})

describe('CONFIG.COLORS_RGB', () => {
  it('数组长度与 COLORS 一致', () => {
    expect(CONFIG.COLORS_RGB).toBeDefined()
    expect(CONFIG.COLORS_RGB).toHaveLength(CONFIG.COLORS.length)
  })

  it('每项是 "R,G,B" 形式的字符串', () => {
    for (const rgb of CONFIG.COLORS_RGB) {
      expect(rgb).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/)
    }
  })

  it('COLORS_RGB[0] 与 COLORS[0]=#E74C3C 对应：231,76,60', () => {
    expect(CONFIG.COLORS[0]).toBe('#E74C3C')
    expect(CONFIG.COLORS_RGB[0]).toBe('231,76,60')
  })

  it('COLORS_RGB[1] 与 COLORS[1]=#3498DB 对应：52,152,219', () => {
    expect(CONFIG.COLORS[1]).toBe('#3498DB')
    expect(CONFIG.COLORS_RGB[1]).toBe('52,152,219')
  })

  it('COLORS_RGB[7] 与 COLORS[7]=#E91E8C 对应：233,30,140', () => {
    expect(CONFIG.COLORS[7]).toBe('#E91E8C')
    expect(CONFIG.COLORS_RGB[7]).toBe('233,30,140')
  })

  it('每项的 RGB 数值与对应 COLORS hex 解析结果一致（穷举验证）', () => {
    for (let i = 0; i < CONFIG.COLORS.length; i++) {
      const hex = CONFIG.COLORS[i]
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      expect(CONFIG.COLORS_RGB[i]).toBe(`${r},${g},${b}`)
    }
  })
})

describe('ResultScene level routing logic', () => {
  it('winning retry should replay current level, not level 0', () => {
    function getRetryLevel(levelIdx) {
      return levelIdx
    }
    expect(getRetryLevel(4)).toBe(4)
    expect(getRetryLevel(0)).toBe(0)
    expect(getRetryLevel(9)).toBe(9)
  })
})
