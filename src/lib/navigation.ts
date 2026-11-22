// ============================================================
// App 内步行导航
//   - getNavRoute：请求带“逐步指引”的步行路线
//   - 把每一步翻译成中文：左转/右转、进入哪条街、第几个路口
//   - trackProgress：根据当前位置，算出走到哪一步、离下个路口多远、有没有偏离路线
// ============================================================

// 引入地理工具
import { bearing, cumulativeDistances, decodePolyline, distanceMeters, projectToSegment, type LngLat } from './geo'

// 步行路线服务（和 routing.ts 同一个）
const OSRM_FOOT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

// 转向图标的种类
export type TurnIcon = 'depart' | 'straight' | 'left' | 'right' | 'slightLeft' | 'slightRight' | 'sharpLeft' | 'sharpRight' | 'uturn' | 'roundabout' | 'arrive'

// 导航中的一步：从这一步的起点（转向点）开始，沿着某条街走一段
export interface NavStep {
  // 转向类型（OSRM 原始值，例如 turn、depart、arrive）
  type: string
  // 转向方向（left、right、slight left 等）
  modifier?: string
  // 环岛出口编号
  exit?: number
  // 这一步走的街道名（可能为空）
  name: string
  // 这一步的坐标
  coords: LngLat[]
  // 每个坐标距这一步起点的累计距离
  cum: number[]
  // 这一步的总长度（米）
  length: number
  // 这一步途中经过的路口距起点的距离（不含起点本身）
  crossings: number[]
  // 属于第几段（第几个目的地之前）
  legIndex: number
}

// 完整的导航路线
export interface NavRoute {
  // 所有步骤
  steps: NavStep[]
  // 整条路线的坐标
  coords: LngLat[]
  // 总距离（米）
  distance: number
}

// OSRM 返回的单个步骤（只列出用到的字段）
interface OsrmStep {
  geometry: string
  name: string
  distance: number
  maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] }
  intersections: { location: [number, number] }[]
}

// 请求导航路线：points 依次为 起点、目的地1、目的地2……
export async function getNavRoute(points: LngLat[], signal?: AbortSignal): Promise<NavRoute> {
  // 拼接坐标
  const coordStr = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';')
  // 请求：steps=true 要逐步指引
  const res = await fetch(`${OSRM_FOOT}/${coordStr}?overview=full&geometries=polyline&steps=true`, { signal })
  // 失败
  if (!res.ok) throw new Error(`路线服务返回 ${res.status}`)
  // 解析
  const data = await res.json()
  // 没找到路线
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('没有找到步行路线')
  // 第一条路线
  const route = data.routes[0]
  // 结果步骤
  const steps: NavStep[] = []
  // 逐段（每个目的地一段）
  route.legs.forEach((leg: { steps: OsrmStep[] }, legIndex: number) => {
    // 逐步
    for (const s of leg.steps) {
      // 解码这一步的坐标
      const coords = decodePolyline(s.geometry)
      // 累计距离
      const cum = cumulativeDistances(coords)
      // 这一步的长度
      const length = cum[cum.length - 1] ?? 0
      // 途中经过的路口：跳过第一个（就是这一步的起点），算出每个路口在这一步上的位置
      const crossings = s.intersections.slice(1).map((it) => alongDistance(coords, cum, it.location))
      // 加入结果
      steps.push({
        type: s.maneuver.type,
        modifier: s.maneuver.modifier,
        exit: s.maneuver.exit,
        name: s.name ?? '',
        coords,
        cum,
        length,
        crossings,
        legIndex,
      })
    }
  })
  // 返回
  return { steps, coords: decodePolyline(route.geometry), distance: route.distance }
}

// 某个点在折线上的位置（离起点多少米）：找最近的线段
function alongDistance(coords: LngLat[], cum: number[], p: LngLat): number {
  // 最近距离
  let best = Infinity
  // 对应的沿线距离
  let along = 0
  // 逐段检查
  for (let i = 1; i < coords.length; i++) {
    // 投影到这一段
    const pr = projectToSegment(p, coords[i - 1], coords[i])
    // 更近就记下
    if (pr.dist < best) {
      best = pr.dist
      along = cum[i - 1] + (cum[i] - cum[i - 1]) * pr.t
    }
  }
  // 返回
  return along
}

// ---------- 把转向翻译成中文 ----------

// 转向方向的中文
const MOD_TEXT: Record<string, string> = {
  left: '左转',
  right: '右转',
  'slight left': '向左前方走',
  'slight right': '向右前方走',
  'sharp left': '向左后方急转',
  'sharp right': '向右后方急转',
  straight: '直行',
  uturn: '掉头',
}

// 转向方向对应的图标
const MOD_ICON: Record<string, TurnIcon> = {
  left: 'left',
  right: 'right',
  'slight left': 'slightLeft',
  'slight right': 'slightRight',
  'sharp left': 'sharpLeft',
  'sharp right': 'sharpRight',
  straight: 'straight',
  uturn: 'uturn',
}

// 一个转向的描述
export interface Maneuver {
  // 图标
  icon: TurnIcon
  // 动作，例如“左转”
  action: string
  // 进入的街道（可能为空）
  street: string
  // 是不是真正需要拐弯（直行、出发、到达不算）
  isTurn: boolean
}

// 描述某一步开头的转向；destName 是这一段的目的地名字（到达时用）
export function describeManeuver(step: NavStep, destName = '目的地'): Maneuver {
  // 方向
  const mod = step.modifier ?? ''
  // 街道
  const street = step.name
  // 按类型处理
  switch (step.type) {
    // 出发
    case 'depart':
      return { icon: 'depart', action: '出发', street, isTurn: false }
    // 到达
    case 'arrive': {
      // 目的地在左边还是右边
      const side = mod.includes('left') ? '（在左手边）' : mod.includes('right') ? '（在右手边）' : ''
      return { icon: 'arrive', action: `到达 ${destName}${side}`, street: '', isTurn: false }
    }
    // 岔路口
    case 'fork':
      return {
        icon: mod.includes('left') ? 'slightLeft' : mod.includes('right') ? 'slightRight' : 'straight',
        action: mod.includes('left') ? '在岔路口靠左' : mod.includes('right') ? '在岔路口靠右' : '在岔路口直行',
        street,
        isTurn: mod !== 'straight',
      }
    // 环岛
    case 'roundabout':
    case 'rotary':
      return { icon: 'roundabout', action: `进入环岛，从第 ${step.exit ?? 1} 个出口出去`, street, isTurn: true }
    // 离开环岛
    case 'exit roundabout':
    case 'exit rotary':
      return { icon: 'roundabout', action: '离开环岛', street, isTurn: true }
    // 路的尽头
    case 'end of road':
      return { icon: MOD_ICON[mod] ?? 'straight', action: `在路的尽头${MOD_TEXT[mod] ?? '转弯'}`, street, isTurn: true }
    // 换了街名 / 继续
    case 'new name':
    case 'continue':
      // 直行（或没有方向）
      if (!mod || mod === 'straight') return { icon: 'straight', action: '继续直行', street, isTurn: false }
      // 有方向就按转弯处理
      return { icon: MOD_ICON[mod] ?? 'straight', action: MOD_TEXT[mod] ?? '继续前进', street, isTurn: true }
    // 其他（turn、merge 等）
    default:
      return { icon: MOD_ICON[mod] ?? 'straight', action: MOD_TEXT[mod] ?? '继续前进', street, isTurn: mod !== '' && mod !== 'straight' }
  }
}

// 把转向变成一句话，例如“左转，进入 Friedrichstraße”
export function maneuverSentence(m: Maneuver): string {
  // 有街名就加上“进入 xx”
  return m.street ? `${m.action}，进入 ${m.street}` : m.action
}

// 导航用的距离文字：100 米以内按 10 米取整，1 公里以上用公里
export function navDistance(m: number): string {
  // 很近
  if (m < 15) return '现在'
  // 1 公里以内
  if (m < 1000) return `${Math.round(m / 10) * 10} 米`
  // 1 公里以上
  return `${(m / 1000).toFixed(1)} 公里`
}

// ---------- 实时进度 ----------

// 当前进度
export interface NavProgress {
  // 现在走在第几步上
  stepIndex: number
  // 在这一步上已经走了多少米
  along: number
  // 离路线的距离（米），太远说明偏离了
  offRoute: number
  // 吸附到路线上的位置
  snapped: LngLat
  // 路线在这里的方向（地图朝向用）
  heading: number
  // 离下一个转向点还有多少米
  toNext: number
  // 到下一个转向前，还要经过几个路口
  crossingsAhead: number
  // 离当前这一段的目的地还有多少米
  toLegEnd: number
  // 离终点还有多少米
  toEnd: number
}

// 根据当前位置算进度；hint 是上次所在的步骤（优先在附近找，避免往返路线时跳错）
export function trackProgress(route: NavRoute, pos: LngLat, hint = 0): NavProgress {
  // 在某个范围的步骤里找离 pos 最近的线段
  const search = (from: number, to: number) => {
    // 最好的结果
    let best = { step: from, seg: 1, t: 0, dist: Infinity }
    // 逐步
    for (let si = Math.max(0, from); si <= Math.min(route.steps.length - 1, to); si++) {
      // 这一步的坐标
      const c = route.steps[si].coords
      // 逐段（只有一个点的步骤，例如“到达”，跳过）
      for (let i = 1; i < c.length; i++) {
        // 投影
        const pr = projectToSegment(pos, c[i - 1], c[i])
        // 更近就记下
        if (pr.dist < best.dist) best = { step: si, seg: i, t: pr.t, dist: pr.dist }
      }
    }
    // 返回
    return best
  }
  // 先在上次步骤附近找（往回 1 步、往前 6 步）
  let best = search(hint - 1, hint + 6)
  // 附近都离得很远，再全程找一遍
  if (best.dist > 35) {
    // 全程搜索
    const all = search(0, route.steps.length - 1)
    // 全程的结果更近就用它
    if (all.dist < best.dist) best = all
  }
  // 所在的步骤
  const step = route.steps[best.step]
  // 这一段线段的两个端点
  const a = step.coords[best.seg - 1] ?? step.coords[0]
  const b = step.coords[best.seg] ?? step.coords[0]
  // 在这一步上走了多少米
  const along = (step.cum[best.seg - 1] ?? 0) + ((step.cum[best.seg] ?? 0) - (step.cum[best.seg - 1] ?? 0)) * best.t
  // 吸附后的位置
  const snapped: LngLat = [a[0] + (b[0] - a[0]) * best.t, a[1] + (b[1] - a[1]) * best.t]
  // 离下一个转向点
  const toNext = Math.max(0, step.length - along)
  // 前方还有几个路口（不算终点那个转向路口）
  const crossingsAhead = step.crossings.filter((d) => d > along + 5 && d < step.length - 5).length
  // 这一段剩下的距离：本步剩余 + 同一段后面的步骤
  let toLegEnd = toNext
  // 到终点剩下的距离
  let toEnd = toNext
  // 累加后面的步骤
  for (let i = best.step + 1; i < route.steps.length; i++) {
    // 全程累加
    toEnd += route.steps[i].length
    // 同一段的才算进这一段
    if (route.steps[i].legIndex === step.legIndex) toLegEnd += route.steps[i].length
  }
  // 返回进度
  return {
    stepIndex: best.step,
    along,
    offRoute: best.dist,
    snapped,
    // 线段方向
    heading: distanceMeters(a, b) > 0.5 ? bearing(a, b) : 0,
    toNext,
    crossingsAhead,
    toLegEnd,
    toEnd,
  }
}
