// ============================================================
// 整条旅行路线：城市之间画弧线（火车/大巴实线，飞机点线）
// 首页和“未来旅程”页共用
// ============================================================

// 引入 MapLibre 类型
import type { Map as MLMap } from 'maplibre-gl'
// 引入数据结构
import type { Segment, Stop } from '../db/schema'
// 引入弧线工具
import { arc, type LngLat } from '../lib/geo'
// 引入图层工具
import { collection, ensureLayer, lineFeature, setGeoJSON } from './layers'

// 读取 CSS 颜色变量（让地图线条颜色和界面主题一致）
export function cssVar(name: string): string {
  // 从 <html> 上读取变量值并去掉空格
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// 画（或更新）旅行路线；prefix 用来区分不同页面的图层名
export function drawTripRoute(map: MLMap, stops: Stop[], segments: Segment[], prefix = 'trip') {
  // 按 ID 找地点的小工具
  const byId = new Map(stops.map((s) => [s.id, s]))
  // 每段交通变成一条弧线
  const features = segments.flatMap((seg) => {
    // 出发地
    const a = byId.get(seg.fromStopId)
    // 目的地
    const b = byId.get(seg.toStopId)
    // 找不到就跳过
    if (!a || !b) return []
    // 飞机的弧度大一点，看起来像航线
    const bend = seg.mode === 'flight' ? 0.22 : 0.12
    // 生成弧线
    const coords = arc([a.lng, a.lat] as LngLat, [b.lng, b.lat] as LngLat, bend)
    // 返回线要素，带上交通方式和交通段 ID（长按路线时用来找到是哪一段）
    return [lineFeature(coords, { mode: seg.mode, segId: seg.id })]
  })
  // 写入数据源
  setGeoJSON(map, `${prefix}-route`, collection(features))
  // 读取当前主题的颜色
  const accent = cssVar('--accent')
  const card = cssVar('--card')
  // 看不见的粗线：手指按在路线附近也能选中（首页长按路线打开那段交通）
  ensureLayer(map, {
    id: `${prefix}-route-hit`,
    type: 'line',
    source: `${prefix}-route`,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#000000', 'line-width': 26, 'line-opacity': 0.001 },
  })
  // 白色衬底线（让路线在地图上更醒目），飞机段不加
  ensureLayer(map, {
    id: `${prefix}-route-casing`,
    type: 'line',
    source: `${prefix}-route`,
    filter: ['!=', ['get', 'mode'], 'flight'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': card, 'line-width': 7, 'line-opacity': 0.85 },
  })
  // 火车/大巴：酒红实线
  ensureLayer(map, {
    id: `${prefix}-route-line`,
    type: 'line',
    source: `${prefix}-route`,
    filter: ['!=', ['get', 'mode'], 'flight'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': accent, 'line-width': 2.8 },
  })
  // 飞机：酒红圆点线
  ensureLayer(map, {
    id: `${prefix}-route-flight`,
    type: 'line',
    source: `${prefix}-route`,
    filter: ['==', ['get', 'mode'], 'flight'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': accent, 'line-width': 3, 'line-dasharray': [0.1, 2.2] },
  })
}

// 去重后的城市列表（格罗宁根出发和回来是同一个点，只显示一次）
export function uniqueCities(stops: Stop[]): Stop[] {
  // 已经出现过的坐标
  const seen = new Set<string>()
  // 过滤
  return stops.filter((s) => {
    // 用坐标作为判断依据
    const key = `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`
    // 出现过就去掉
    if (seen.has(key)) return false
    // 记下来
    seen.add(key)
    // 保留
    return true
  })
}
