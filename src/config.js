// 游戏常量配置
export const CONFIG = {
  // 画布尺寸（逻辑尺寸，实际由屏幕决定）
  WIDTH: 375,
  HEIGHT: 667,

  // 棋盘配置
  BOARD_COLS: 7,
  BOARD_ROWS: 7,
  SLOT_MAX: 6,       // 底部槽最大容量（从7缩到6，操作容错更低）

  // 每轮消除需要相同数量
  MATCH_COUNT: 3,

  // 颜色主题（汽车颜色）
  COLORS: [
    '#E74C3C', // 红色跑车
    '#3498DB', // 蓝色SUV
    '#2ECC71', // 绿色越野
    '#F39C12', // 黄色豪华
    '#9B59B6', // 紫色超跑
    '#1ABC9C', // 青色电车
    '#E67E22', // 橙色卡车
    '#E91E8C', // 粉色跑车
  ],

  // 车型图标
  CAR_ICONS: ['🚗', '🚙', '🚕', '🏎️', '🚓', '🚑', '🚐', '🛻'],

  // ✅ 关卡配置
  // carTypes: 车的种类数（影响消除难度）
  // layerMax: 每格最多堆叠层数（影响遮挡复杂度）
  // setCount: 每种车放几组（每组=MATCH_COUNT张），总块数 = carTypes × setCount × MATCH_COUNT
  // maxMoves: 本关最多可操作步数（超出即失败），0=不限步数
  // 步均容差 = maxMoves / (carTypes * setCount)，越低越难，建议 1.15~1.7
  LEVELS: (() => {
    // ── 手工精调的前10关（入门曲线）──
    const hand = [
      { carTypes: 3, layerMax: 2, setCount: 3, maxMoves: 45 },  // 1：27辆，步均1.67，轻松入门
      { carTypes: 4, layerMax: 2, setCount: 3, maxMoves: 50 },  // 2：36辆，步均1.39
      { carTypes: 4, layerMax: 3, setCount: 3, maxMoves: 52 },  // 3：36辆，加3层堆叠
      { carTypes: 5, layerMax: 2, setCount: 3, maxMoves: 52 },  // 4：45辆，步均1.16
      { carTypes: 5, layerMax: 3, setCount: 3, maxMoves: 56 },  // 5：45辆，3层堆叠
      { carTypes: 5, layerMax: 3, setCount: 4, maxMoves: 75 },  // 6：60辆，步均1.25
      { carTypes: 6, layerMax: 3, setCount: 3, maxMoves: 68 },  // 7：54辆，步均1.26
      { carTypes: 6, layerMax: 3, setCount: 4, maxMoves: 90 },  // 8：72辆，步均1.25
      { carTypes: 7, layerMax: 3, setCount: 4, maxMoves: 103 }, // 9：84辆，步均1.23
      { carTypes: 8, layerMax: 3, setCount: 4, maxMoves: 116 }, // 10：96辆，步均1.21，高难
    ]

    // ── 算法生成第11~30关（难度持续爬升）──
    // 分3个阶段：进阶(11-16) / 硬核(17-23) / 地狱(24-30)
    const generated = []

    // 阶段一：进阶（11-16）carTypes 5-7，layerMax 3，setCount 4-5，步均 1.18~1.22
    const phase1 = [
      { carTypes: 5, layerMax: 3, setCount: 5, ratio: 1.22 },
      { carTypes: 6, layerMax: 3, setCount: 5, ratio: 1.20 },
      { carTypes: 6, layerMax: 4, setCount: 4, ratio: 1.20 },
      { carTypes: 7, layerMax: 3, setCount: 5, ratio: 1.19 },
      { carTypes: 7, layerMax: 4, setCount: 4, ratio: 1.19 },
      { carTypes: 8, layerMax: 3, setCount: 5, ratio: 1.18 },
    ]

    // 阶段二：硬核（17-23）carTypes 6-8，layerMax 4，setCount 5，步均 1.16~1.18
    const phase2 = [
      { carTypes: 6, layerMax: 4, setCount: 5, ratio: 1.18 },
      { carTypes: 7, layerMax: 4, setCount: 5, ratio: 1.17 },
      { carTypes: 7, layerMax: 4, setCount: 6, ratio: 1.17 },
      { carTypes: 8, layerMax: 4, setCount: 5, ratio: 1.17 },
      { carTypes: 8, layerMax: 4, setCount: 6, ratio: 1.16 },
      { carTypes: 8, layerMax: 4, setCount: 6, ratio: 1.16 },
      { carTypes: 8, layerMax: 4, setCount: 7, ratio: 1.16 },
    ]

    // 阶段三：地狱（24-30）carTypes 8，layerMax 4-5，setCount 7-8，步均 1.15
    const phase3 = [
      { carTypes: 8, layerMax: 5, setCount: 6, ratio: 1.15 },
      { carTypes: 8, layerMax: 5, setCount: 7, ratio: 1.15 },
      { carTypes: 8, layerMax: 5, setCount: 7, ratio: 1.15 },
      { carTypes: 8, layerMax: 5, setCount: 8, ratio: 1.15 },
      { carTypes: 8, layerMax: 5, setCount: 8, ratio: 1.15 },
      { carTypes: 8, layerMax: 5, setCount: 8, ratio: 1.15 },
      { carTypes: 8, layerMax: 5, setCount: 8, ratio: 1.15 },
    ]

    for (const p of [...phase1, ...phase2, ...phase3]) {
      // maxMoves = ceil(carTypes × setCount × ratio)，确保是整数
      const maxMoves = Math.ceil(p.carTypes * p.setCount * p.ratio)
      generated.push({ carTypes: p.carTypes, layerMax: p.layerMax, setCount: p.setCount, maxMoves })
    }

    return [...hand, ...generated]
  })(),

  // 积分
  SCORE_PER_MATCH: 100,
  SCORE_COMBO_BONUS: 50,

  // 道具配置
  PROPS_PER_LEVEL: { expand: 1, shuffle: 1 },  // 每关固定配发
  SLOT_MAX_EXPANDED: 7,                         // 扩槽后的上限
}
