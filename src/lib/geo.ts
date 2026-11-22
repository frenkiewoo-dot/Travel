// ============================================================
// 地理计算小工具：距离、路线顺序优化、曲线、解码路线
// ============================================================

// 一个经纬度点（注意顺序：经度在前，纬度在后，和地图引擎保持一致）
export type LngLat = [number, number]

// 两点间的直线距离（米），用球面公式计算
export function distanceMeters(a: LngLat, b: LngLat): number {
  // 地球半径（米）
  const R = 6371000
  // 角度转弧度
  const toRad = (deg: number) => (deg * Math.PI) / 180
  // 纬度差（弧度）
  const dLat = toRad(b[1] - a[1])
  // 经度差（弧度）
  const dLng = toRad(b[0] - a[0])
  // 球面公式的中间量
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  // 返回距离
  return 2 * R * Math.asin(Math.sqrt(h))
}

// 没网时估算步行距离（米）：直线距离 × 1.3（街道不是直的，要绕路）
export function estimateWalkMeters(a: LngLat, b: LngLat): number {
  // 估算并取整
  return Math.round(distanceMeters(a, b) * 1.3)
}

// 没网时估算步行时间（秒）：估算距离 ÷ 步速 1.25 米/秒（约每小时 4.5 公里）
export function estimateWalkSeconds(a: LngLat, b: LngLat): number {
  // 估算并取整
  return Math.round(estimateWalkMeters(a, b) / 1.25)
}

// 路线顺序优化：起点固定，找一条总距离尽量短的顺序（返回新顺序的下标数组）
export function optimizeOrder(points: LngLat[]): number[] {
  // 少于 3 个点不需要优化
  if (points.length < 3) return points.map((_, i) => i)
  // 第一步：最近邻法，从起点出发每次走到最近的没去过的点
  const order = [0]
  // 还没去过的点
  const rest = new Set(points.map((_, i) => i).slice(1))
  // 直到所有点都去过
  while (rest.size > 0) {
    // 当前所在点
    const last = points[order[order.length - 1]]
    // 记录最近的点
    let best = -1
    // 记录最近距离
    let bestD = Infinity
    // 遍历没去过的点
    for (const i of rest) {
      // 计算距离
      const d = distanceMeters(last, points[i])
      // 更近就记下来
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    // 走到最近的点
    order.push(best)
    // 标记为去过
    rest.delete(best)
  }
  // 第二步：2-opt 优化，反复尝试把一段路线倒过来，如果总距离变短就保留
  let improved = true
  // 一直优化到没有改进为止
  while (improved) {
    // 先假设这一轮没有改进
    improved = false
    // 起点（下标 0）不动，从 1 开始尝试
    for (let i = 1; i < order.length - 1; i++) {
      // 第二个切点
      for (let j = i + 1; j < order.length; j++) {
        // 切点前一个点
        const a = points[order[i - 1]]
        // 第一段的开头
        const b = points[order[i]]
        // 第二段的结尾
        const c = points[order[j]]
        // 切点后一个点（如果有）
        const d = j + 1 < order.length ? points[order[j + 1]] : null
        // 原来的距离：a→b 加 c→d
        const before = distanceMeters(a, b) + (d ? distanceMeters(c, d) : 0)
        // 倒过来之后的距离：a→c 加 b→d
        const after = distanceMeters(a, c) + (d ? distanceMeters(b, d) : 0)
        // 变短了超过 1 米就采用
        if (after + 1 < before) {
          // 把 i 到 j 这一段倒过来
          const reversed = order.slice(i, j + 1).reverse()
          // 替换回去
          order.splice(i, j - i + 1, ...reversed)
          // 标记有改进，继续下一轮
          improved = true
        }
      }
    }
  }
  // 返回新顺序
  return order
}

// 在两点之间画一条弧线（城际路线用，比直线好看）
export function arc(a: LngLat, b: LngLat, bend = 0.18, steps = 48): LngLat[] {
  // 中点
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  // 两点连线的方向
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  // 控制点：从中点往垂直方向偏移一点，形成弧度
  const cx = mx - dy * bend
  const cy = my + dx * bend
  // 结果点列表
  const pts: LngLat[] = []
  // 按二次贝塞尔曲线公式逐点计算
  for (let i = 0; i <= steps; i++) {
    // 进度 0~1
    const t = i / steps
    // 贝塞尔公式的三个权重
    const w0 = (1 - t) ** 2
    const w1 = 2 * (1 - t) * t
    const w2 = t ** 2
    // 计算这一点的坐标
    pts.push([w0 * a[0] + w1 * cx + w2 * b[0], w0 * a[1] + w1 * cy + w2 * b[1]])
  }
  // 返回弧线
  return pts
}

// 解码路线服务返回的压缩坐标串（Google 的 polyline 格式，精度 5 位）
export function decodePolyline(str: string, precision = 5): LngLat[] {
  // 结果
  const coords: LngLat[] = []
  // 当前读取位置
  let index = 0
  // 累计的纬度和经度
  let lat = 0
  let lng = 0
  // 精度系数
  const factor = 10 ** precision
  // 读完整个字符串
  while (index < str.length) {
    // 依次解出纬度变化量和经度变化量
    for (const which of [0, 1]) {
      // 位移量
      let shift = 0
      // 累计值
      let result = 0
      // 当前字节
      let byte: number
      // 每 5 位一组读取，直到最高位为 0
      do {
        // 读一个字符并减去 63
        byte = str.charCodeAt(index++) - 63
        // 取低 5 位拼进结果
        result |= (byte & 0x1f) << shift
        // 下一组左移 5 位
        shift += 5
      } while (byte >= 0x20)
      // 最低位是符号位，还原成正负数
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      // 第一个是纬度，第二个是经度
      if (which === 0) lat += delta
      else lng += delta
    }
    // 存成 [经度, 纬度]
    coords.push([lng / factor, lat / factor])
  }
  // 返回坐标数组
  return coords
}

// 一组点的边界框 [[最小经度, 最小纬度], [最大经度, 最大纬度]]
export function boundsOf(points: LngLat[]): [LngLat, LngLat] {
  // 所有经度
  const lngs = points.map((p) => p[0])
  // 所有纬度
  const lats = points.map((p) => p[1])
  // 返回左下角和右上角
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

// 把秒数变成 “约 12 分钟” / “约 1 小时 5 分”
export function formatDuration(seconds: number): string {
  // 换算成分钟（至少 1 分钟）
  const min = Math.max(1, Math.round(seconds / 60))
  // 不到一小时
  if (min < 60) return `${min} 分钟`
  // 小时数
  const h = Math.floor(min / 60)
  // 剩余分钟
  const m = min % 60
  // 拼接
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

// 把米变成 “850 米” / “1.2 公里”
export function formatDistance(m: number): string {
  // 不到 1 公里用米，按 10 米取整
  if (m < 1000) return `${Math.round(m / 10) * 10} 米`
  // 否则用公里，保留一位小数
  return `${(m / 1000).toFixed(1)} 公里`
}

// 从 a 走向 b 的方位角（0 = 正北，90 = 正东），用于让地图朝向前进方向
export function bearing(a: LngLat, b: LngLat): number {
  // 角度转弧度
  const toRad = (d: number) => (d * Math.PI) / 180
  // 两点纬度（弧度）
  const φ1 = toRad(a[1])
  const φ2 = toRad(b[1])
  // 经度差（弧度）
  const Δλ = toRad(b[0] - a[0])
  // 球面方位角公式
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  // 转成 0~360 度
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// 一条折线每个点距起点的累计距离（米）
export function cumulativeDistances(coords: LngLat[]): number[] {
  // 第一个点是 0
  const cum = [0]
  // 逐段累加
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distanceMeters(coords[i - 1], coords[i]))
  // 返回
  return cum
}

// 点到线段的投影结果
export interface SegmentProjection {
  // 点到线段的最短距离（米）
  dist: number
  // 投影点在线段上的比例（0 = 起点，1 = 终点）
  t: number
}

// 计算点 p 到线段 a-b 的最短距离（小范围内把经纬度近似成平面，误差很小）
export function projectToSegment(p: LngLat, a: LngLat, b: LngLat): SegmentProjection {
  // 当地 1 度经度约多少米
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180)
  // 1 度纬度约多少米
  const ky = 110540
  // 以 p 为原点，把 a、b 换算成米
  const ax = (a[0] - p[0]) * kx
  const ay = (a[1] - p[1]) * ky
  const bx = (b[0] - p[0]) * kx
  const by = (b[1] - p[1]) * ky
  // 线段方向
  const dx = bx - ax
  const dy = by - ay
  // 线段长度的平方
  const len2 = dx * dx + dy * dy
  // 投影比例（限制在 0~1 之间）
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
  // 投影点坐标
  const x = ax + t * dx
  const y = ay + t * dy
  // 返回距离和比例
  return { dist: Math.hypot(x, y), t }
}

// 沿折线走 d 米之后所在的位置（模拟行走用）
export function pointAlong(coords: LngLat[], cum: number[], d: number): LngLat {
  // 超出终点就返回终点
  if (d >= cum[cum.length - 1]) return coords[coords.length - 1]
  // 找到 d 落在哪一段
  let i = 1
  while (i < cum.length && cum[i] < d) i++
  // 这一段的长度
  const seg = cum[i] - cum[i - 1]
  // 在这一段里的比例
  const t = seg === 0 ? 0 : (d - cum[i - 1]) / seg
  // 线性插值
  return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t]
}
