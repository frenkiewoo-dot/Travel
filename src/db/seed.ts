// ============================================================
// 初始数据：第一次打开 App 时写进手机
// 注意：这里只放公开信息（城市、景点坐标），不放任何个人数据
// 景点等推荐信息在后面的“调研”步骤里会补充完整
// ============================================================

// 引入数据结构
import type { DayPlan, Place, Segment, Stop, Trip } from './schema'

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
    name: 'Berlin & København',
    // 副标题
    subtitle: 'Noël 2026',
    // 1 个人
    travelers: 1,
    // 出发日期还没定
    startDate: null,
    // 待定时的提示
    startDateHint: '12/20–12/23 之间出发',
    // 统一用欧元
    baseCurrency: 'EUR',
    // 创建时间
    createdAt: now,
    // 修改时间
    updatedAt: now,
  }

  // 行程中的地点（按顺序）
  const stops: Stop[] = [
    // 0：从格罗宁根出发
    { id: 'stop-gro-start', tripId: TRIP_ID, order: 0, kind: 'home', name: 'Groningen', nameZh: '格罗宁根', country: 'NL', lat: 53.2194, lng: 6.5665, nights: 0 },
    // 1：柏林，住 2 晚
    { id: 'stop-berlin', tripId: TRIP_ID, order: 1, kind: 'stay', name: 'Berlin', nameZh: '柏林', country: 'DE', lat: 52.52, lng: 13.405, nights: 2 },
    // 2：哥本哈根，住 3 晚
    { id: 'stop-copenhagen', tripId: TRIP_ID, order: 2, kind: 'stay', name: 'København', nameZh: '哥本哈根', country: 'DK', lat: 55.6761, lng: 12.5683, nights: 3 },
    // 3：阿姆斯特丹史基浦机场，只是中转
    { id: 'stop-ams', tripId: TRIP_ID, order: 3, kind: 'transit', name: 'Amsterdam Schiphol', nameZh: '阿姆斯特丹机场', country: 'NL', lat: 52.3105, lng: 4.7683, nights: 0 },
    // 4：回到格罗宁根
    { id: 'stop-gro-end', tripId: TRIP_ID, order: 4, kind: 'home', name: 'Groningen', nameZh: '格罗宁根', country: 'NL', lat: 53.2194, lng: 6.5665, nights: 0 },
  ]

  // 城际交通（交通方式的详细比较在后面的“交通”步骤里补充）
  const segments: Segment[] = [
    // 格罗宁根 → 柏林：方式待选
    { id: 'seg-gro-ber', tripId: TRIP_ID, fromStopId: 'stop-gro-start', toStopId: 'stop-berlin', mode: 'tbd', booked: false, note: '火车或大巴，待选' },
    // 柏林 → 哥本哈根：上午出发，方式待选
    { id: 'seg-ber-cph', tripId: TRIP_ID, fromStopId: 'stop-berlin', toStopId: 'stop-copenhagen', mode: 'tbd', timeOfDay: '上午', booked: false, note: '火车或大巴，待选' },
    // 哥本哈根 → 阿姆斯特丹：下午坐飞机
    { id: 'seg-cph-ams', tripId: TRIP_ID, fromStopId: 'stop-copenhagen', toStopId: 'stop-ams', mode: 'flight', timeOfDay: '下午', booked: false },
    // 阿姆斯特丹 → 格罗宁根：火车
    { id: 'seg-ams-gro', tripId: TRIP_ID, fromStopId: 'stop-ams', toStopId: 'stop-gro-end', mode: 'train', booked: false },
  ]

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

  // 示例日程：用来演示“今日旅程”的地图和路线，你随时可以改或删
  const dayPlans: DayPlan[] = [
    {
      // 第 1 天：到达柏林后走一走
      id: `${TRIP_ID}:1`,
      tripId: TRIP_ID,
      dayIndex: 1,
      items: [pick('pl-ber-hbf'), pick('pl-ber-dom'), pick('pl-ber-tor'), pick('pl-ber-gendarmenmarkt')].map((p) => item(p)),
      isSample: true,
    },
    {
      // 第 4 天：哥本哈根市中心
      id: `${TRIP_ID}:4`,
      tripId: TRIP_ID,
      dayIndex: 4,
      items: [pick('pl-cph-h'), pick('pl-cph-rosenborg'), pick('pl-cph-amalienborg'), pick('pl-cph-nyhavn')].map((p) => item(p)),
      isSample: true,
    },
  ]

  // 返回所有初始数据
  return { trip, stops, segments, places, dayPlans }
}
