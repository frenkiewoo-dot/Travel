// ============================================================
// 行程计算：根据“出发日期 + 每个城市住几晚”，算出每一天在哪里
// 出发日期没定时，用“旅途第 N 天”来表示
// ============================================================

// 引入数据结构
import type { Segment, Stop, Trip } from '../db/schema'

// 一个城市在行程中的时间段
export interface StopSpan {
  // 这个地点
  stop: Stop
  // 第几天到达（从 1 开始）
  arriveDay: number
  // 第几天离开
  departDay: number
}

// 某一天的概况
export interface DayInfo {
  // 旅途第几天
  dayIndex: number
  // 具体日期 'YYYY-MM-DD'（出发日没定时为 null）
  date: string | null
  // 当天主要在哪个城市（晚上住的地方；最后一天是离开的城市）
  stop: Stop
  // 当天要坐的城际交通（可能没有）
  segments: Segment[]
}

// 本次路线上的地点（去掉“以后想去”的城市），按顺序排列
export function routeStops(stops: Stop[]): Stop[] {
  // 过滤并排序（复制一份，不改原数组）
  return stops.filter((s) => s.kind !== 'saved').sort((a, b) => a.order - b.order)
}

// 把地点按顺序排列，并算出每个地点的到达/离开日（只算本次路线上的）
export function computeSpans(stops: Stop[]): StopSpan[] {
  // 本次路线上的地点
  const sorted = routeStops(stops)
  // 当前是第几天，从第 1 天开始
  let cursor = 1
  // 结果数组
  const spans: StopSpan[] = []
  // 逐个地点计算
  for (const stop of sorted) {
    // 到达日 = 当前天
    const arriveDay = cursor
    // 住了几晚，就往后推几天
    cursor += stop.nights
    // 离开日 = 推完之后的那天
    spans.push({ stop, arriveDay, departDay: cursor })
  }
  // 返回结果
  return spans
}

// 整个旅行一共几天
export function totalDays(stops: Stop[]): number {
  // 本次路线上所有地点住的晚数加起来，再加 1（最后一天回家）
  return routeStops(stops).reduce((sum, s) => sum + s.nights, 0) + 1
}

// 给日期加上 n 天，返回 'YYYY-MM-DD'
export function addDays(isoDate: string, n: number): string {
  // 用中午 12 点构造日期，避免时区导致跨天
  const d = new Date(`${isoDate}T12:00:00`)
  // 加 n 天
  d.setDate(d.getDate() + n)
  // 转回 'YYYY-MM-DD'
  return toISODate(d)
}

// 把 Date 转成本地日期字符串 'YYYY-MM-DD'
export function toISODate(d: Date): string {
  // 年
  const y = d.getFullYear()
  // 月（补零）
  const m = String(d.getMonth() + 1).padStart(2, '0')
  // 日（补零）
  const day = String(d.getDate()).padStart(2, '0')
  // 拼起来
  return `${y}-${m}-${day}`
}

// 算出每一天的概况
export function computeDays(trip: Trip, stops: Stop[], segments: Segment[]): DayInfo[] {
  // 每个地点的时间段
  const spans = computeSpans(stops)
  // 总天数
  const n = totalDays(stops)
  // 结果
  const days: DayInfo[] = []
  // 第 1 天到第 n 天逐天计算
  for (let d = 1; d <= n; d++) {
    // 当天晚上住的城市：到达日 <= d < 离开日 的那个住宿城市
    const sleeping = spans.find((s) => s.stop.kind === 'stay' && s.arriveDay <= d && d < s.departDay)
    // 当天离开的住宿城市（最后一天没有过夜的地方时用它）
    const leaving = spans.find((s) => s.stop.kind === 'stay' && s.departDay === d)
    // 优先用过夜的城市，其次是离开的城市，再不行就用第一个地点
    const stop = sleeping?.stop ?? leaving?.stop ?? spans[0].stop
    // 当天的城际交通：出发地点的“离开日”等于今天
    const daySegments = segments.filter((seg) => {
      // 找到这段交通的出发地点
      const from = spans.find((s) => s.stop.id === seg.fromStopId)
      // 出发地点的离开日是今天，就算今天的交通
      return from?.departDay === d
    })
    // 按出发地点的顺序排列当天的交通
    daySegments.sort((a, b) => orderOf(stops, a.fromStopId) - orderOf(stops, b.fromStopId))
    // 具体日期：出发日已定就推算，没定就是 null
    const date = trip.startDate ? addDays(trip.startDate, d - 1) : null
    // 放进结果
    days.push({ dayIndex: d, date, stop, segments: daySegments })
  }
  // 返回每一天
  return days
}

// 查一个地点的顺序号（小工具）
function orderOf(stops: Stop[], id: string): number {
  // 找到就返回它的 order，找不到返回 0
  return stops.find((s) => s.id === id)?.order ?? 0
}

// “今天”在行程里的状态
export type TodayState =
  // 还没出发（或出发日未定）：显示第一天预览
  | { kind: 'before'; daysUntil: number | null }
  // 旅途中：今天是第几天
  | { kind: 'during'; dayIndex: number }
  // 已经结束
  | { kind: 'after' }

// 根据今天的日期判断行程状态
export function getTodayState(trip: Trip, total: number, now = new Date()): TodayState {
  // 出发日没定：一律算“还没出发”，倒计时未知
  if (!trip.startDate) return { kind: 'before', daysUntil: null }
  // 今天的日期字符串
  const today = toISODate(now)
  // 出发日到今天相差几天
  const diff = dayDiff(trip.startDate, today)
  // 今天在出发日之前：还没出发，返回倒计时
  if (diff < 0) return { kind: 'before', daysUntil: -diff }
  // 今天在行程范围内：旅途中
  if (diff < total) return { kind: 'during', dayIndex: diff + 1 }
  // 否则旅行已结束
  return { kind: 'after' }
}

// 两个日期相差几天（b - a）
export function dayDiff(a: string, b: string): number {
  // 都用中午 12 点，避免夏令时误差
  const ta = new Date(`${a}T12:00:00`).getTime()
  const tb = new Date(`${b}T12:00:00`).getTime()
  // 毫秒差换算成天并四舍五入
  return Math.round((tb - ta) / 86400000)
}

// 星期几的中文
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 某一天的显示文字：日期已定显示 “12月23日 周三”，否则 “旅途第一天”
export function dayLabel(day: Pick<DayInfo, 'dayIndex' | 'date'>): string {
  // 有具体日期
  if (day.date) {
    // 转成 Date
    const d = new Date(`${day.date}T12:00:00`)
    // 拼成 “12月23日 周三”
    return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`
  }
  // 没有日期：旅途第 N 天
  return `旅途第${chineseNumber(day.dayIndex)}天`
}

// 1~99 的数字转中文（一、二……十一……）
export function chineseNumber(n: number): string {
  // 个位数字对应的中文
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  // 0~9 直接查表
  if (n < 10) return digits[n]
  // 10~19：十、十一……
  if (n < 20) return `十${n % 10 === 0 ? '' : digits[n % 10]}`
  // 20~99：二十、二十一……
  if (n < 100) return `${digits[Math.floor(n / 10)]}十${n % 10 === 0 ? '' : digits[n % 10]}`
  // 更大的数字直接用阿拉伯数字
  return String(n)
}

// 交通方式的中文名
export const MODE_LABEL: Record<Segment['mode'], string> = {
  train: '火车',
  bus: '大巴',
  flight: '飞机',
  ferry: '轮渡',
  car: '汽车',
  tbd: '待选',
}
