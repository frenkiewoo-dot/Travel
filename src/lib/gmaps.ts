// ============================================================
// 生成 Google Maps 多站导航链接
// 在 iPhone 上点开会跳到 Google Maps App（装了的话），否则打开网页版
// ============================================================

// Google Maps 一次最多 9 个途经点（加上起点终点共 11 站）
export const GMAPS_MAX_WAYPOINTS = 9

// 一个站点（只需要坐标）
interface Point {
  lat: number
  lng: number
}

// 生成导航链接
// fromCurrentLocation = true：从“我的位置”出发，所有站点都是目的地
// fromCurrentLocation = false：第一个站点是起点
export function googleMapsDirections(points: Point[], fromCurrentLocation: boolean, travelmode: 'walking' | 'transit' = 'walking'): string {
  // 没有站点就打开 Google Maps 首页
  if (points.length === 0) return 'https://www.google.com/maps'
  // 坐标转成 “纬度,经度”
  const ll = (p: Point) => `${p.lat},${p.lng}`
  // 参数
  const q = new URLSearchParams({ api: '1', travelmode })
  // 终点是最后一个站点
  q.set('destination', ll(points[points.length - 1]))
  // 中间的站点
  let middle: Point[]
  // 从我的位置出发：不设起点（Google Maps 会用当前位置），除最后一个外都是途经点
  if (fromCurrentLocation) middle = points.slice(0, -1)
  // 否则第一个站点是起点
  else {
    // 只有一个站点时，它就是终点，不设起点
    if (points.length > 1) q.set('origin', ll(points[0]))
    // 去掉首尾就是途经点
    middle = points.slice(1, -1)
  }
  // 公交模式不支持途经点；步行模式最多 9 个
  if (travelmode === 'walking' && middle.length > 0) q.set('waypoints', middle.slice(0, GMAPS_MAX_WAYPOINTS).map(ll).join('|'))
  // 返回完整链接
  return `https://www.google.com/maps/dir/?${q.toString()}`
}
