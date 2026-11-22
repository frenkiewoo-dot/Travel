// ============================================================
// 往地图上加 / 更新图层的小工具
// ============================================================

// 引入 MapLibre 类型
import type { GeoJSONSource, LayerSpecification, Map as MLMap } from 'maplibre-gl'
// 引入 GeoJSON 类型
import type { Feature, FeatureCollection, Geometry } from 'geojson'
// 引入坐标类型
import { distanceMeters, type LngLat } from '../lib/geo'
// 引入 3D 建筑图层名和数据源名
import { VECTOR_SOURCE } from './mapStyle'

// 设置（或更新）一个 GeoJSON 数据源
export function setGeoJSON(map: MLMap, id: string, data: FeatureCollection) {
  // 查找已有的数据源
  const src = map.getSource(id) as GeoJSONSource | undefined
  // 已有就更新数据
  if (src) src.setData(data)
  // 没有就新建
  else map.addSource(id, { type: 'geojson', data })
}

// 添加图层（已存在就跳过）；默认放在第一个文字图层下面，这样地名不会被线挡住
export function ensureLayer(map: MLMap, layer: LayerSpecification, beforeId: string | null = firstSymbolLayer(map)) {
  // 已经有了就不重复添加
  if (map.getLayer(layer.id)) return
  // 添加到指定图层下面（beforeId 为空时放在最上面）
  map.addLayer(layer, beforeId ?? undefined)
}

// 找到第一个文字图层的 ID
export function firstSymbolLayer(map: MLMap): string | null {
  // 遍历所有图层
  for (const l of map.getStyle().layers) {
    // 第一个 symbol（文字/图标）图层
    if (l.type === 'symbol') return l.id
  }
  // 没有文字图层
  return null
}

// 把一串坐标变成一条线的 GeoJSON
export function lineFeature(coords: LngLat[], props: Record<string, unknown> = {}): Feature<Geometry> {
  // 返回线要素
  return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } }
}

// 把多个要素包成集合
export function collection(features: Feature<Geometry>[]): FeatureCollection {
  // 返回要素集合
  return { type: 'FeatureCollection', features }
}

// 高亮景点建筑：找到景点附近 40 米内的建筑（包括塔楼、穹顶等分段），染成淡金色
// 返回一个清理函数（离开页面时调用）
export function highlightLandmarks(map: MLMap, points: LngLat[]): () => void {
  // 已经处理完的景点（按下标记录）
  const donePoints = new Set<number>()
  // 检查并高亮
  const run = () => {
    // 缩放不够大时没有建筑数据
    if (map.getZoom() < 14) return
    // 矢量数据源不存在（例如离线样式）
    if (!map.getSource(VECTOR_SOURCE)) return
    // 还没处理的景点
    const pending = points.map((p, i) => [p, i] as const).filter(([, i]) => !donePoints.has(i))
    // 都处理完了
    if (pending.length === 0) return
    // 取出已加载的所有建筑数据（直接查数据，不受视角和倾斜影响）
    const feats = map.querySourceFeatures(VECTOR_SOURCE, { sourceLayer: 'building' })
    // 逐个景点处理
    for (const [p, i] of pending) {
      // 这个景点附近有没有找到建筑
      let found = false
      // 遍历建筑
      for (const f of feats) {
        // 没有 ID 的楼没法单独标记
        if (f.id === undefined) continue
        // 不在 40 米内就跳过
        if (!isNear(f.geometry, p, 40)) continue
        // 打上标记，楼会变成淡金色
        map.setFeatureState({ source: VECTOR_SOURCE, sourceLayer: 'building', id: f.id }, { landmark: true })
        // 找到了
        found = true
      }
      // 找到了就不用再找（找不到的下次地图停下时再试，可能数据还没加载）
      if (found) donePoints.add(i)
    }
  }
  // 地图停下来（加载完新数据）时检查
  map.on('idle', run)
  // 样式切换后标记会丢失，需要重新处理
  const reset = () => donePoints.clear()
  // 监听样式加载
  map.on('style.load', reset)
  // 返回清理函数
  return () => {
    // 取消监听
    map.off('idle', run)
    map.off('style.load', reset)
  }
}

// 判断一个建筑轮廓是否在某点附近：点在轮廓里面，或者轮廓上有顶点离它不到 radius 米
function isNear(geometry: Geometry, p: LngLat, radius: number): boolean {
  // 取出所有多边形（单个多边形也统一成数组）
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  // 逐个多边形检查
  for (const poly of polygons) {
    // 外轮廓
    const ring = poly[0] as LngLat[]
    // 点在轮廓里面
    if (pointInRing(p, ring)) return true
    // 轮廓上有顶点离得很近
    if (ring.some((v) => distanceMeters(v, p) < radius)) return true
  }
  // 都不满足
  return false
}

// 射线法判断点是否在多边形里
function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  // 是否在里面
  let inside = false
  // 逐条边检查
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    // 这条边的两个端点
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    // 从点向右的射线穿过这条边，就翻转一次
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  // 穿过奇数次就在里面
  return inside
}
