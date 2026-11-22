// ============================================================
// 修改行程的操作（所有写数据库的地方集中在这里）
//   - 改旅行信息（名称、出发日期、人数）
//   - 改城市列表（增删、排序、住几晚）：
//       · 城际交通段自动重新连接，已有的交通信息保留
//       · 每天的日程跟着城市一起挪，不会错位到别的城市
//   - 酒店 / 景点的增删改、状态、隐藏其余候选
//   - 把景点加进某一天的日程
// ============================================================

// 引入数据库
import { db } from './db'
// 引入数据结构
import type { DayPlan, Place, Segment, Stop, TransportOption, Trip } from './schema'
// 引入行程计算
import { computeSpans, totalDays } from '../lib/itinerary'
// 引入生成 ID 的工具
import { newId } from './pins'

// ---------- 旅行信息 ----------

// 修改旅行信息（只改传进来的字段）
export async function updateTrip(id: string, patch: Partial<Trip>) {
  // 同时更新修改时间
  await db.trips.update(id, { ...patch, updatedAt: Date.now() })
}

// ---------- 城市列表 ----------

// 保存新的城市列表（顺序按数组顺序），并自动整理交通段和日程
export async function saveStops(tripId: string, nextStops: Stop[]) {
  // 用事务：要么全部成功，要么全部不改
  await db.transaction('rw', [db.stops, db.segments, db.dayPlans, db.places, db.trips], async () => {
    // 旧的城市列表（按顺序）
    const oldStops = await db.stops.where('tripId').equals(tripId).sortBy('order')
    // 旧的交通段
    const oldSegs = await db.segments.where('tripId').equals(tripId).toArray()
    // 旧的日程
    const oldPlans = await db.dayPlans.where('tripId').equals(tripId).toArray()

    // 1. 重新编号顺序
    const stops = nextStops.map((s, i) => ({ ...s, tripId, order: i }))

    // 2. 交通段：每两个相邻城市之间一段；同样的两站之间原来有的就保留
    const segs: Segment[] = []
    // 逐对相邻城市
    for (let i = 0; i < stops.length - 1; i++) {
      // 出发
      const from = stops[i].id
      // 到达
      const to = stops[i + 1].id
      // 原来有没有这一段
      const keep = oldSegs.find((s) => s.fromStopId === from && s.toStopId === to)
      // 有就保留，没有就新建一段“待选”
      segs.push(keep ?? { id: newId('seg'), tripId, fromStopId: from, toStopId: to, mode: 'tbd', booked: false })
    }

    // 3. 日程跟着城市挪
    const plans = remapDayPlans(oldStops, stops, oldPlans)

    // 4. 被删掉的城市：它的酒店景点也删掉
    const removedIds = oldStops.filter((o) => !stops.some((s) => s.id === o.id)).map((o) => o.id)
    // 逐个删除
    for (const id of removedIds) await db.places.where('stopId').equals(id).delete()

    // 5. 写回数据库：先清空旧的，再写新的
    await db.stops.where('tripId').equals(tripId).delete()
    await db.stops.bulkPut(stops)
    await db.segments.where('tripId').equals(tripId).delete()
    await db.segments.bulkPut(segs)
    await db.dayPlans.where('tripId').equals(tripId).delete()
    await db.dayPlans.bulkPut(plans)
    // 更新旅行的修改时间
    await db.trips.update(tripId, { updatedAt: Date.now() })
  })
}

// 找出某一天属于哪个城市、是到达后的第几天
function locateDay(stops: Stop[], day: number): { stopId: string; offset: number } | null {
  // 每个城市的时间段
  const spans = computeSpans(stops)
  // 只看住宿城市
  const stays = spans.filter((s) => s.stop.kind === 'stay')
  // 当天晚上住在哪
  const sleeping = stays.find((s) => s.arriveDay <= day && day < s.departDay)
  // 找到了
  if (sleeping) return { stopId: sleeping.stop.id, offset: day - sleeping.arriveDay }
  // 最后一天（离开那天）
  const leaving = stays.find((s) => s.departDay === day)
  // 找到了：算作这个城市的“离开日”
  if (leaving) return { stopId: leaving.stop.id, offset: leaving.stop.nights }
  // 没有住宿城市的情况（例如只有出发和回家）
  return null
}

// 城市或住几晚变了以后，把每天的日程挪到新的日子
export function remapDayPlans(oldStops: Stop[], newStops: Stop[], plans: DayPlan[]): DayPlan[] {
  // 新的时间段
  const newSpans = computeSpans(newStops)
  // 新的总天数
  const total = totalDays(newStops)
  // 结果：按新的天数归类
  const byDay = new Map<number, DayPlan>()
  // 逐个日程处理
  for (const p of plans) {
    // 旧的日子属于哪个城市
    const loc = locateDay(oldStops, p.dayIndex)
    // 找不到城市：保持原来的天数（只要还在范围内）
    let target = p.dayIndex
    // 找到了
    if (loc) {
      // 这个城市在新列表里的时间段
      const span = newSpans.find((s) => s.stop.id === loc.stopId)
      // 城市被删了：这天的日程也不要了
      if (!span) continue
      // 新的天数 = 新的到达日 + 原来的偏移（超出就放在离开那天）
      target = span.arriveDay + Math.min(loc.offset, span.stop.nights)
    }
    // 超出总天数就放在最后一天
    target = Math.max(1, Math.min(target, total))
    // 这一天已经有别的日程挪过来了：合并站点
    const existing = byDay.get(target)
    if (existing) existing.items = [...existing.items, ...p.items]
    // 否则直接放进去（ID 跟着天数变）
    else byDay.set(target, { ...p, dayIndex: target, id: `${p.tripId}:${target}` })
  }
  // 返回所有日程
  return [...byDay.values()]
}

// 修改一段城际交通（方式、时段、是否已订、备注）
export async function updateSegment(id: string, patch: Partial<Segment>) {
  // 写入
  await db.segments.update(id, patch)
}

// 选定某一段交通的方式（再点一次取消）；同时把交通方式同步成这个选项的方式
export async function chooseOption(segId: string, optionId: string | null) {
  // 读这一段
  const seg = await db.segments.get(segId)
  // 不存在
  if (!seg) return
  // 选中的方式
  const opt = seg.options?.find((o) => o.id === optionId)
  // 写入：选中就同步方式，取消就只清空选择
  await db.segments.update(segId, opt ? { chosenOptionId: opt.id, mode: opt.mode } : { chosenOptionId: undefined })
}

// 给某一段交通添加一个自己的方式
export async function addUserOption(segId: string, opt: Omit<TransportOption, 'id' | 'source'>) {
  // 用事务：读 → 改 → 写
  await db.transaction('rw', db.segments, async () => {
    // 读这一段
    const seg = await db.segments.get(segId)
    // 不存在
    if (!seg) return
    // 加在最后
    await db.segments.update(segId, { options: [...(seg.options ?? []), { ...opt, id: newId('opt'), source: 'user' }] })
  })
}

// 删除某一段交通里自己添加的方式
export async function deleteOption(segId: string, optionId: string) {
  // 用事务：读 → 改 → 写
  await db.transaction('rw', db.segments, async () => {
    // 读这一段
    const seg = await db.segments.get(segId)
    // 不存在
    if (!seg) return
    // 去掉这个方式；如果它是选中的，也取消选中
    await db.segments.update(segId, {
      options: (seg.options ?? []).filter((o) => o.id !== optionId),
      chosenOptionId: seg.chosenOptionId === optionId ? undefined : seg.chosenOptionId,
    })
  })
}

// 修改城市的字段（例如自己的交通笔记）
export async function updateStop(id: string, patch: Partial<Stop>) {
  // 写入
  await db.stops.update(id, patch)
}

// ---------- 酒店 / 景点 ----------

// 新增一个地点（返回新 ID）
export async function addPlace(place: Omit<Place, 'id' | 'createdAt'>): Promise<string> {
  // 新 ID
  const id = newId('pl')
  // 写入
  await db.places.add({ ...place, id, createdAt: Date.now() })
  // 返回
  return id
}

// 修改一个地点
export async function updatePlace(id: string, patch: Partial<Place>) {
  // 写入修改
  await db.places.update(id, patch)
}

// 删除一个地点
export async function deletePlace(id: string) {
  // 删除
  await db.places.delete(id)
}

// 某个城市里，除了已选定/已预订的酒店，其余候选全部隐藏（或取消隐藏）
export async function setOtherHotelsHidden(stopId: string, hidden: boolean) {
  // 这个城市的酒店
  const hotels = await db.places.where('stopId').equals(stopId).filter((p) => p.category === 'hotel').toArray()
  // 逐个处理：只动“候选”状态的
  await db.transaction('rw', db.places, async () => {
    for (const h of hotels) if (h.status === 'candidate') await db.places.update(h.id, { hidden })
  })
}

// 删除某个城市里所有“候选”状态的酒店
export async function deleteCandidateHotels(stopId: string) {
  // 找出并删除
  await db.places
    .where('stopId')
    .equals(stopId)
    .filter((p) => p.category === 'hotel' && p.status === 'candidate')
    .delete()
}

// 把一个地点加到某一天的日程最后
export async function addPlaceToDay(tripId: string, dayIndex: number, place: Place) {
  // 日程 ID
  const id = `${tripId}:${dayIndex}`
  // 日程里的一站
  const item = { id: newId('item'), placeId: place.id, name: place.name, lat: place.lat, lng: place.lng }
  // 用事务：读 → 改 → 写
  await db.transaction('rw', db.dayPlans, async () => {
    // 那天现有的日程
    const plan = await db.dayPlans.get(id)
    // 有就追加
    if (plan) await db.dayPlans.update(id, { items: [...plan.items, item], isSample: false })
    // 没有就新建
    else await db.dayPlans.put({ id, tripId, dayIndex, items: [item] })
  })
}
