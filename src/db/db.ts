// ============================================================
// 本地数据库（IndexedDB，通过 Dexie 库来操作）
// 所有数据只存在你的手机里，不会上传到任何服务器
// ============================================================

// 引入 Dexie 和它的表类型
import Dexie, { type EntityTable } from 'dexie'
// 引入数据结构定义
import type { DayPlan, Expense, Place, RouteCache, Segment, Setting, Stop, Ticket, TicketFile, Trip } from './schema'
// 引入初始数据
import { buildSeed } from './seed'

// 定义数据库的类型：一个 Dexie 实例，加上下面这些表
type TravelDB = Dexie & {
  // 旅行表（主键 id）
  trips: EntityTable<Trip, 'id'>
  // 行程地点表
  stops: EntityTable<Stop, 'id'>
  // 城际交通表
  segments: EntityTable<Segment, 'id'>
  // 酒店/景点等地点表
  places: EntityTable<Place, 'id'>
  // 每日日程表
  dayPlans: EntityTable<DayPlan, 'id'>
  // 路线缓存表（主键 key）
  routeCache: EntityTable<RouteCache, 'key'>
  // 设置表（主键 key）
  settings: EntityTable<Setting, 'key'>
  // 车票表（第 2 版加入）
  tickets: EntityTable<Ticket, 'id'>
  // 车票文件表（第 2 版加入，存图片和 PDF）
  ticketFiles: EntityTable<TicketFile, 'id'>
  // 花费表（第 3 版加入）
  expenses: EntityTable<Expense, 'id'>
}

// 创建数据库，名字叫 noel-travel
export const db = new Dexie('noel-travel') as TravelDB

// 版本 1 的表结构：
// 每个字符串里第一个是主键，后面是需要按它查询的字段（索引）
db.version(1).stores({
  // 旅行：按 id 查
  trips: 'id, updatedAt',
  // 地点：按旅行查，并能按 “旅行+顺序” 排序
  stops: 'id, tripId, [tripId+order]',
  // 交通：按旅行查
  segments: 'id, tripId',
  // 酒店景点：按旅行、城市、分类查
  places: 'id, tripId, stopId, category',
  // 日程：按旅行、按 “旅行+第几天” 查
  dayPlans: 'id, tripId, [tripId+dayIndex]',
  // 路线缓存：按 key 查
  routeCache: 'key, savedAt',
  // 设置：按 key 查
  settings: 'key',
})

// 版本 2：加入票夹的两张表。只是新增表，旧数据不用改，所以不需要 upgrade 函数
// （Dexie 规定：新版本里要把所有表都写上，没变的表照抄）
db.version(2).stores({
  trips: 'id, updatedAt',
  stops: 'id, tripId, [tripId+order]',
  segments: 'id, tripId',
  places: 'id, tripId, stopId, category',
  dayPlans: 'id, tripId, [tripId+dayIndex]',
  routeCache: 'key, savedAt',
  settings: 'key',
  // 车票：按旅行、按交通段查
  tickets: 'id, tripId, segmentId, createdAt',
  // 车票文件：按车票查
  ticketFiles: 'id, ticketId',
})

// 版本 3：加入预算的花费表（同样只是新增表）
db.version(3).stores({
  trips: 'id, updatedAt',
  stops: 'id, tripId, [tripId+order]',
  segments: 'id, tripId',
  places: 'id, tripId, stopId, category',
  dayPlans: 'id, tripId, [tripId+dayIndex]',
  routeCache: 'key, savedAt',
  settings: 'key',
  tickets: 'id, tripId, segmentId, createdAt',
  ticketFiles: 'id, ticketId',
  // 花费：按旅行、按日期查
  expenses: 'id, tripId, date',
})

// 以后如果要改已有数据的格式，写法示例：
// db.version(4).stores({ ...所有表 }).upgrade(async (tx) => { ...把旧数据改成新格式 })

// 当前查看的旅行 ID 存在设置表里，用这个名字
export const ACTIVE_TRIP_KEY = 'activeTripId'

// 第一次打开 App 时，写入初始行程数据
export async function ensureSeeded(): Promise<void> {
  // 数一下已经有几次旅行
  const count = await db.trips.count()
  // 已经有数据了就什么都不做（不会覆盖你改过的内容）
  if (count > 0) return
  // 生成初始数据
  const seed = buildSeed()
  // 用一个事务一次性写入（要么全部成功，要么全部不写）
  await db.transaction('rw', [db.trips, db.stops, db.segments, db.places, db.dayPlans, db.settings], async () => {
    // 写入旅行
    await db.trips.add(seed.trip)
    // 写入城市
    await db.stops.bulkAdd(seed.stops)
    // 写入交通
    await db.segments.bulkAdd(seed.segments)
    // 写入地点
    await db.places.bulkAdd(seed.places)
    // 写入日程
    await db.dayPlans.bulkAdd(seed.dayPlans)
    // 把这次旅行设为当前查看的旅行
    await db.settings.put({ key: ACTIVE_TRIP_KEY, value: seed.trip.id })
  })
}

// 向浏览器申请“持久存储”：iPhone 上可以降低数据被系统自动清理的概率
export async function requestPersistentStorage(): Promise<boolean> {
  // 老浏览器不支持这个接口，直接返回 false
  if (!navigator.storage?.persist) return false
  // 已经是持久存储了就直接返回 true
  if (await navigator.storage.persisted()) return true
  // 申请持久存储（浏览器可能同意也可能不同意）
  return navigator.storage.persist()
}
