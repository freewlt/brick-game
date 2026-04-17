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

  // ✅ 关卡配置（难度升级版）
  // carTypes: 车的种类数
  // layerMax: 每格最多堆叠层数
  // setCount: 每种车放几组（每组=MATCH_COUNT张），总块数 = carTypes × setCount × MATCH_COUNT
  // maxMoves: 本关最多可操作步数（超出即失败），0=不限步数
  LEVELS: [
    { carTypes: 3, layerMax: 2, setCount: 3, maxMoves: 45 },  // 第1关：27辆，步均1.67，入门有压力
    { carTypes: 4, layerMax: 2, setCount: 3, maxMoves: 50 },  // 第2关：36辆，步均1.39
    { carTypes: 4, layerMax: 3, setCount: 3, maxMoves: 52 },  // 第3关：36辆，加3层堆叠
    { carTypes: 5, layerMax: 2, setCount: 3, maxMoves: 52 },  // 第4关：45辆，步均1.16
    { carTypes: 5, layerMax: 3, setCount: 3, maxMoves: 56 },  // 第5关：45辆，3层堆叠
    { carTypes: 5, layerMax: 3, setCount: 4, maxMoves: 75 },  // 第6关：60辆，步均1.25
    { carTypes: 6, layerMax: 3, setCount: 3, maxMoves: 68 },  // 第7关：54辆，步均1.26
    { carTypes: 6, layerMax: 3, setCount: 4, maxMoves: 90 },  // 第8关：72辆，步均1.25
    { carTypes: 7, layerMax: 3, setCount: 4, maxMoves: 103 }, // 第9关：84辆，步均1.23
    { carTypes: 8, layerMax: 3, setCount: 4, maxMoves: 116 }, // 第10关：96辆，步均1.21，高难
  ],

  // 积分
  SCORE_PER_MATCH: 100,
  SCORE_COMBO_BONUS: 50,
}
