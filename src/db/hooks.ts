// ============================================================
// 读取数据的 React 钩子：数据库内容变化时，页面会自动刷新
// ============================================================

// 引入 Dexie 的“实时查询”钩子
import { useLiveQuery } from 'dexie-react-hooks'
// 引入 React 的缓存计算钩子
import { useMemo } from 'react'
// 引入数据库
import { ACTIVE_TRIP_KEY, db } from './db'
// 引入行程计算
import { computeDays, getTodayState, totalDays } from '../lib/itinerary'

// 读取当前旅行的全部数据（加载中返回 undefined，没有旅行返回 null）
export function useTripData() {
  // 实时查询：任何相关表变化时都会重新执行
  return useLiveQuery(async () => {
    // 读取“当前旅行”设置
    const setting = await db.settings.get(ACTIVE_TRIP_KEY)
    // 设置里有就用设置里的，否则取第一个旅行
    const tripId = (setting?.value as string | undefined) ?? (await db.trips.toCollection().first())?.id
    // 一个旅行都没有
    if (!tripId) return null
    // 同时读取这次旅行的各类数据
    const [trip, stops, segments, places, dayPlans, tickets] = await Promise.all([
      // 旅行本身
      db.trips.get(tripId),
      // 地点（按顺序）
      db.stops.where('[tripId+order]').between([tripId, -Infinity], [tripId, Infinity]).toArray(),
      // 交通
      db.segments.where('tripId').equals(tripId).toArray(),
      // 酒店景点
      db.places.where('tripId').equals(tripId).toArray(),
      // 日程
      db.dayPlans.where('tripId').equals(tripId).toArray(),
      // 车票（只有文字信息，文件另外按需读取）
      db.tickets.where('tripId').equals(tripId).toArray(),
    ])
    // 旅行被删了
    if (!trip) return null
    // 返回所有数据
    return { trip, stops, segments, places, dayPlans, tickets }
  })
}

// 行程数据的类型（从上面的钩子推导出来）
export type TripData = NonNullable<ReturnType<typeof useTripData>>

// 在旅行数据基础上，算出每天概况和“今天”的状态
export function useItinerary(data: TripData | null | undefined) {
  // 只有数据变化时才重新计算
  return useMemo(() => {
    // 没数据就返回 null
    if (!data) return null
    // 每天的概况
    const days = computeDays(data.trip, data.stops, data.segments)
    // 总天数
    const total = totalDays(data.stops)
    // 今天的状态
    const today = getTodayState(data.trip, total)
    // “今日旅程”要显示第几天：旅途中显示当天，否则显示第一天（预览）
    const todayIndex = today.kind === 'during' ? today.dayIndex : 1
    // 返回结果
    return { days, total, today, todayIndex }
  }, [data])
}
