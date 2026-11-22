// ============================================================
// 在地图上画步行路线（今日旅程、地图标签、导航共用）
// 真实街道路线是实线；没网时的直线估算是虚线
// ============================================================

// 引入 MapLibre 类型
import type { Map as MLMap } from 'maplibre-gl'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入图层工具
import { collection, ensureLayer, lineFeature, setGeoJSON } from './layers'
// 引入颜色变量读取
import { cssVar } from './tripRoute'

// 画（或更新）步行路线；prefix 区分不同页面的图层
export function drawWalkRoute(map: MLMap, prefix: string, coords: LngLat[], isReal: boolean) {
  // 数据源名字
  const src = `${prefix}-route`
  // 少于两个点就清空
  setGeoJSON(map, src, collection(coords.length > 1 ? [lineFeature(coords, { real: isReal ? 1 : 0 })] : []))
  // 衬底线（让路线更醒目）
  ensureLayer(map, {
    id: `${src}-casing`,
    type: 'line',
    source: src,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': cssVar('--card'), 'line-width': 9, 'line-opacity': 0.9 },
  })
  // 真实路线：实线
  ensureLayer(map, {
    id: `${src}-line`,
    type: 'line',
    source: src,
    filter: ['==', ['get', 'real'], 1],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': cssVar('--accent'), 'line-width': 4.5 },
  })
  // 估算路线：虚线
  ensureLayer(map, {
    id: `${src}-estimate`,
    type: 'line',
    source: src,
    filter: ['==', ['get', 'real'], 0],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': cssVar('--accent'), 'line-width': 3.5, 'line-dasharray': [1.5, 1.5] },
  })
}
