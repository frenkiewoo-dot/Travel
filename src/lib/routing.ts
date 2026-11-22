// ============================================================
// 步行路线：调用免费的 OSRM 路线服务（routing.openstreetmap.de）
// 算好的路线会存进手机，断网时也能显示
// 没网又没缓存时，退回“直线 + 估算时间”
// ============================================================

// 引入数据库
import { db } from '../db/db'
// 引入坐标类型和估算工具
import { decodePolyline, estimateWalkMeters, estimateWalkSeconds, type LngLat } from './geo'

// 路线结果
export interface WalkRoute {
  // 路线坐标串
  coords: LngLat[]
  // 每两站之间的距离（米）
  legDistances: number[]
  // 每两站之间的时间（秒）
  legDurations: number[]
  // true = 真实街道路线；false = 没网时的直线估算
  isReal: boolean
}

// 步行路线服务的地址（OpenStreetMap 德国社区提供的免费服务）
const OSRM_FOOT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

// 把途经点变成缓存用的 key（坐标保留 5 位小数，约 1 米精度）
function cacheKey(points: LngLat[]): string {
  // 每个点变成 “经度,纬度”，用分号连接
  return 'foot:' + points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';')
}

// 直线估算的路线（没网时用）
function straightRoute(points: LngLat[]): WalkRoute {
  // 每段的估算距离
  const legDistances = points.slice(1).map((p, i) => estimateWalkMeters(points[i], p))
  // 每段的估算时间
  const legDurations = points.slice(1).map((p, i) => estimateWalkSeconds(points[i], p))
  // 路线就是把点直接连起来
  return { coords: points, legDistances, legDurations, isReal: false }
}

// 获取步行路线（先查缓存，再联网，最后退回直线）
export async function getWalkRoute(points: LngLat[]): Promise<WalkRoute> {
  // 少于两个点画不了线
  if (points.length < 2) return { coords: points, legDistances: [], legDurations: [], isReal: false }
  // 生成缓存 key
  const key = cacheKey(points)
  // 查缓存
  const cached = await db.routeCache.get(key)
  // 有缓存就直接用（路线不会经常变）
  if (cached) return { coords: cached.coords, legDistances: cached.legDistances, legDurations: cached.legDurations, isReal: true }
  // 没缓存：尝试联网
  try {
    // 拼请求地址：所有点用分号连接；overview=full 要完整路线；geometries=polyline 压缩坐标
    const url = `${OSRM_FOOT}/${points.map((p) => `${p[0]},${p[1]}`).join(';')}?overview=full&geometries=polyline`
    // 设置 8 秒超时，网差时不至于一直等
    const ctrl = new AbortController()
    // 8 秒后取消请求
    const timer = setTimeout(() => ctrl.abort(), 8000)
    // 发请求
    const res = await fetch(url, { signal: ctrl.signal })
    // 拿到响应后清掉计时器
    clearTimeout(timer)
    // 状态码不对就当失败处理
    if (!res.ok) throw new Error(`路线服务返回 ${res.status}`)
    // 解析返回的 JSON
    const data = await res.json()
    // 服务说没找到路线也当失败
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('没有找到路线')
    // 取第一条路线
    const route = data.routes[0]
    // 解码路线坐标
    const coords = decodePolyline(route.geometry)
    // 每段的距离
    const legDistances: number[] = route.legs.map((l: { distance: number }) => l.distance)
    // 每段的时间
    const legDurations: number[] = route.legs.map((l: { duration: number }) => l.duration)
    // 存进缓存
    await db.routeCache.put({ key, coords, legDistances, legDurations, savedAt: Date.now() })
    // 返回真实路线
    return { coords, legDistances, legDurations, isReal: true }
  } catch {
    // 联网失败：退回直线估算
    return straightRoute(points)
  }
}
