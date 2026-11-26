// ============================================================
// 初始数据：第一次打开 App 时写进手机
// 注意：这里只放公开信息（城市、景点坐标），不放任何个人数据
// 景点等推荐信息在后面的“调研”步骤里会补充完整
// ============================================================

// 引入数据结构
import type { DayPlan, Place, Segment, Stop, Trip } from './schema'
// 引入新的行程结构
import { NEW_PLAN } from '../data/content'

// 初始旅行的固定 ID（固定 ID 方便以后做数据迁移）
const TRIP_ID = 'trip-noel-2026'

// 生成全部初始数据
export function buildSeed() {
  // 当前时间
  const now = Date.now()

  // 旅行本身
  const trip: Trip = {
    // 固定 ID
    id: TRIP_ID,
    // 名称
    name: NEW_PLAN.name,
    // 副标题
    subtitle: 'Noël 2026',
    // 1 个人
    travelers: 1,
    // 旅途第一天
    startDate: NEW_PLAN.startDate,
    // 统一用欧元
    baseCurrency: 'EUR',
    // 创建时间
    createdAt: now,
    // 修改时间
    updatedAt: now,
  }

  // 行程中的地点（按顺序；最后的柏林是“以后想去”）
  const stops: Stop[] = NEW_PLAN.stops.map((def, i) => ({ ...def, tripId: TRIP_ID, order: i }))

  // 城际交通：路线上每两个相邻地点之间一段（交通方式见 NEW_PLAN.modes）
  const route = stops.filter((s) => s.kind !== 'saved')
  // 生成交通段
  const segments: Segment[] = route.slice(0, -1).map((from, i) => ({
    // 固定 ID：seg-出发-到达
    id: `seg-${from.id}-${route[i + 1].id}`,
    tripId: TRIP_ID,
    fromStopId: from.id,
    toStopId: route[i + 1].id,
    // 交通方式
    mode: NEW_PLAN.modes[`${from.id}>${route[i + 1].id}`] ?? 'tbd',
    // 还没订
    booked: false,
  }))

  // 几个著名景点（公开坐标；完整的推荐清单在后面的调研步骤补充）
  const places: Place[] = [
    // 柏林中央火车站
    { id: 'pl-ber-hbf', tripId: TRIP_ID, stopId: 'stop-berlin', category: 'station', name: 'Berlin Hauptbahnhof', nameZh: '柏林中央火车站', lat: 52.5251, lng: 13.3694, status: 'candidate', source: 'recommended' },
    // 勃兰登堡门
    { id: 'pl-ber-tor', tripId: TRIP_ID, stopId: 'stop-berlin', category: 'attraction', name: 'Brandenburger Tor', nameZh: '勃兰登堡门', lat: 52.5163, lng: 13.3777, status: 'candidate', source: 'recommended' },
    // 御林广场（圣诞市场所在地）
    { id: 'pl-ber-gendarmenmarkt', tripId: TRIP_ID, stopId: 'stop-berlin', category: 'market', name: 'Gendarmenmarkt', nameZh: '御林广场', lat: 52.5137, lng: 13.3926, status: 'candidate', source: 'recommended' },
    // 柏林大教堂
    { id: 'pl-ber-dom', tripId: TRIP_ID, stopId: 'stop-berlin', category: 'attraction', name: 'Berliner Dom', nameZh: '柏林大教堂', lat: 52.5191, lng: 13.4011, status: 'candidate', source: 'recommended' },
    // 新港
    { id: 'pl-cph-nyhavn', tripId: TRIP_ID, stopId: 'stop-copenhagen', category: 'attraction', name: 'Nyhavn', nameZh: '新港', lat: 55.6798, lng: 12.5911, status: 'candidate', source: 'recommended' },
    // 阿美琳堡宫
    { id: 'pl-cph-amalienborg', tripId: TRIP_ID, stopId: 'stop-copenhagen', category: 'attraction', name: 'Amalienborg', nameZh: '阿美琳堡宫', lat: 55.684, lng: 12.5934, status: 'candidate', source: 'recommended' },
    // 罗森堡宫
    { id: 'pl-cph-rosenborg', tripId: TRIP_ID, stopId: 'stop-copenhagen', category: 'attraction', name: 'Rosenborg Slot', nameZh: '罗森堡宫', lat: 55.6858, lng: 12.5773, status: 'candidate', source: 'recommended' },
    // 哥本哈根中央车站
    { id: 'pl-cph-h', tripId: TRIP_ID, stopId: 'stop-copenhagen', category: 'station', name: 'København H', nameZh: '哥本哈根中央车站', lat: 55.6727, lng: 12.5643, status: 'candidate', source: 'recommended' },
  ]

  // 把地点转成日程里的一站（小工具函数）
  const item = (p: Place, time?: string) => ({
    // 日程项 ID
    id: `item-${p.id}`,
    // 关联地点
    placeId: p.id,
    // 名称
    name: p.name,
    // 坐标
    lat: p.lat,
    lng: p.lng,
    // 时间
    time,
  })
  // 按 ID 找地点（小工具函数）
  const pick = (id: string) => places.find((p) => p.id === id)!

  // 示例日程：用来演示地图和路线，你随时可以改或删
  const dayPlans: DayPlan[] = [
    {
      // 第 2 天：哥本哈根市中心
      id: `${TRIP_ID}:2`,
      tripId: TRIP_ID,
      dayIndex: 2,
      items: [pick('pl-cph-h'), pick('pl-cph-rosenborg'), pick('pl-cph-amalienborg'), pick('pl-cph-nyhavn')].map((p) => item(p)),
      isSample: true,
    },
  ]

  // 返回所有初始数据
  return { trip, stops, segments, places, dayPlans }
}
