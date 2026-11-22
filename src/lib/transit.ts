// ============================================================
// 公交时间：调用免费的 Transitous 公共交通路线服务（基于 MOTIS，社区运营）
//   - 只在步行比较远（超过 15 分钟）时才查，节省请求
//   - 查到的结果存进手机（和步行路线一样的缓存表），断网时也能看
//   - 查不到（没网、服务不可用、太远的日期没有时刻表）就返回 null，界面只显示步行
// ============================================================

// 引入数据库
import { db } from '../db/db'
// 引入坐标类型
import type { LngLat } from './geo'
// 引入日期工具
import { toISODate } from './itinerary'

// Transitous 服务地址
const API = 'https://api.transitous.org/api/v1/plan'

// 一段公交行程的结果
export interface TransitLeg {
  // 总时间（秒），包括步行到站和等车
  duration: number
  // 简要说明，例如 “U5 → S3”
  summary: string
}

// 交通工具类型的中文（没有线路号时用）
const MODE_ZH: Record<string, string> = {
  SUBWAY: '地铁',
  BUS: '公交',
  TRAM: '电车',
  RAIL: '火车',
  REGIONAL_RAIL: '火车',
  SUBURBAN: '城铁',
  METRO: '地铁',
  FERRY: '渡轮',
  COACH: '大巴',
}

// Transitous 返回的一段（只列用到的字段）
interface MotisLeg {
  mode: string
  routeShortName?: string
}

// 查两点之间坐公交要多久；when 是出发时间（带时区的 ISO 字符串），不传就是现在
export async function getTransitLeg(a: LngLat, b: LngLat, when?: string): Promise<TransitLeg | null> {
  // 缓存 key：坐标 + 日期（同一天的结果可以复用）
  const key = `transit:${a[1].toFixed(5)},${a[0].toFixed(5)}>${b[1].toFixed(5)},${b[0].toFixed(5)}@${when?.slice(0, 10) ?? 'now'}`
  // 查缓存
  const cached = await db.routeCache.get(key)
  // 有缓存：空的 summary 表示“查过但没有合适的公交”
  if (cached) return cached.summary ? { duration: cached.legDurations[0], summary: cached.summary } : null
  try {
    // 请求参数：Transitous 用“纬度,经度”
    const q = new URLSearchParams({ fromPlace: `${a[1]},${a[0]}`, toPlace: `${b[1]},${b[0]}` })
    // 有出发时间就带上
    if (when) q.set('time', when)
    // 8 秒超时
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    // 发请求
    const res = await fetch(`${API}?${q}`, { signal: ctrl.signal })
    // 清掉计时器
    clearTimeout(timer)
    // 失败
    if (!res.ok) return null
    // 解析
    const data = (await res.json()) as { itineraries?: { duration: number; legs: MotisLeg[] }[] }
    // 只看真正坐了车的方案（全程步行的不算）
    const rides = (data.itineraries ?? []).filter((it) => it.legs.some((l) => l.mode !== 'WALK'))
    // 选最快的
    const best = rides.sort((x, y) => x.duration - y.duration)[0]
    // 简要说明：坐车的每一段用线路号，没有就用中文类型
    const summary = best
      ? best.legs
          .filter((l) => l.mode !== 'WALK')
          .map((l) => l.routeShortName || MODE_ZH[l.mode] || l.mode)
          .join(' → ')
      : ''
    // 存缓存（没有方案也存，避免反复查）
    await db.routeCache.put({ key, coords: [], legDistances: [], legDurations: [best?.duration ?? 0], summary, savedAt: Date.now() })
    // 返回
    return best ? { duration: best.duration, summary } : null
  } catch {
    // 没网或超时：不缓存，下次再试
    return null
  }
}

// 根据日程的日期和时间，生成出发时间
// 日期没定、已经过去或者太远（超过 60 天，还没有时刻表）时，用“明天”代替，
// 这样不会查到半夜的夜班车；时间没填就按上午 10 点；12 月德国、丹麦都是 UTC+1
export function departureTime(date: string | null, time?: string): string {
  // 这一天离今天多少天（没有日期当作很远）
  const days = date ? (new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86400000 : Infinity
  // 日期合适就用它，否则用明天
  const d = date && days >= -0.5 && days <= 60 ? date : toISODate(new Date(Date.now() + 86400000))
  // 拼成带时区的时间
  return `${d}T${time ?? '10:00'}:00+01:00`
}
