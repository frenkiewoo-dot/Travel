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

// ---------- 查路线（城市详情「交通」里的搜索） ----------

// 路线里的一段
export interface PlanLeg {
  // 交通方式（Transitous 的类型，例如 SUBWAY、BUS、REGIONAL_RAIL、HIGHSPEED_RAIL、WALK）
  mode: string
  // 线路号，例如 “M3”“RE51”“FR 9527”
  line?: string
  // 运营商，例如 “ATM”“Trenord”“TRENITALIA”
  agency?: string
  // 开往哪里（方向）
  headsign?: string
  // 上车站 / 下车站
  from: string
  to: string
  // 出发 / 到达时间（ISO）
  dep: string
  arr: string
  // 用时（秒）
  duration: number
}

// 一个方案
export interface PlanOption {
  // 总用时（秒）
  duration: number
  // 出发 / 到达（ISO）
  dep: string
  arr: string
  // 换乘次数
  transfers: number
  // 每一段
  legs: PlanLeg[]
}

// Transitous 返回的一段（完整一点的字段）
interface MotisFullLeg {
  mode: string
  routeShortName?: string
  agencyName?: string
  headsign?: string
  from?: { name?: string }
  to?: { name?: string }
  startTime: string
  endTime: string
  duration: number
}

// 查两地之间的公共交通方案（市内、机场进城、城市之间的火车都可以）；when = 出发时间（ISO）
export async function planRoutes(a: { lat: number; lng: number }, b: { lat: number; lng: number }, when?: string): Promise<PlanOption[]> {
  // 请求参数（Transitous 用“纬度,经度”）
  const q = new URLSearchParams({ fromPlace: `${a.lat},${a.lng}`, toPlace: `${b.lat},${b.lng}` })
  if (when) q.set('time', when)
  // 15 秒超时
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`${API}?${q}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { itineraries?: { duration: number; startTime: string; endTime: string; transfers: number; legs: MotisFullLeg[] }[] }
    // 转换；只要真正坐了车的方案
    return (data.itineraries ?? [])
      .filter((it) => it.legs.some((l) => l.mode !== 'WALK'))
      .slice(0, 6)
      .map((it) => ({
        duration: it.duration,
        dep: it.startTime,
        arr: it.endTime,
        transfers: it.transfers,
        legs: it.legs.map((l) => ({
          mode: l.mode,
          line: l.routeShortName || undefined,
          agency: l.agencyName || undefined,
          headsign: l.headsign || undefined,
          from: cleanStop(l.from?.name),
          to: cleanStop(l.to?.name),
          dep: l.startTime,
          arr: l.endTime,
          duration: l.duration,
        })),
      }))
  } finally {
    clearTimeout(timer)
  }
}

// 站名整理：START / END 是起点终点（不是真的站名）
function cleanStop(name?: string): string {
  if (!name || name === 'START') return '出发地'
  if (name === 'END') return '目的地'
  return name
}

// 交通方式的中文
export function modeZh(mode: string): string {
  return (
    {
      WALK: '步行',
      BUS: '公交',
      COACH: '大巴',
      TRAM: '电车',
      SUBWAY: '地铁',
      METRO: '地铁',
      SUBURBAN: '城铁',
      RAIL: '火车',
      REGIONAL_RAIL: '大区火车',
      REGIONAL_FAST_RAIL: '大区快车',
      LONG_DISTANCE: '长途火车',
      HIGHSPEED_RAIL: '高铁',
      NIGHT_RAIL: '夜车',
      FERRY: '渡轮',
      AIRPLANE: '飞机',
      FUNICULAR: '缆车',
      AERIAL_LIFT: '索道',
    } as Record<string, string>
  )[mode] ?? mode
}

// 交通方式的图标名
export function modeIcon(mode: string): 'walk' | 'bus' | 'train' | 'plane' {
  if (mode === 'WALK') return 'walk'
  if (mode === 'BUS' || mode === 'COACH' || mode === 'FERRY') return 'bus'
  if (mode === 'AIRPLANE') return 'plane'
  return 'train'
}

// ISO 时间 → “09:10”（手机当地时间）
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}
