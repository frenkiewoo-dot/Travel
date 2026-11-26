// ============================================================
// 把推荐内容包（src/data/content.ts）合并进手机里的数据
//   - 只在内容版本变化时执行一次
//   - 交通方式：替换“推荐”的那些，保留你自己添加的，保留你选好的方式
//   - 城市指南：直接更新成最新版（你自己的笔记存在别的字段，不受影响）
//   - 推荐青旅和景点：没有的加进去；已有的只补空白字段；你删掉的不会再加回来
//   - 你删掉的城市不会被加回来
// ============================================================

// 引入数据库
import { db } from './db'
// 引入推荐内容
import { CITY_GUIDES, CONTENT_VERSION, NEW_PLAN, NOEL_TRIP_ID, RECOMMENDED_PLACES, SEED_PLACE_IDS, SEGMENT_OPTIONS, type RecommendedPlace } from '../data/content'
// 引入数据结构
import type { Place, Stop } from './schema'
// 引入保存城市列表（会自动整理交通段和日程）
import { saveStops } from './trip'

// 记录已合并的内容版本的设置名
const KEY = 'contentVersion'

// 合并推荐内容（App 启动时调用）
export async function applyContent(): Promise<void> {
  // 已经合并过的版本
  const done = ((await db.settings.get(KEY))?.value as number | undefined) ?? 0
  // 已经是最新的就不用做
  if (done >= CONTENT_VERSION) return
  // 第 2 版：行程变更（只执行一次）
  if (done < 2) await applyNewPlan()
  // 第 3 版起：推荐青旅和景点
  await mergePlaces()
  // 用事务一次性完成
  await db.transaction('rw', [db.stops, db.segments, db.settings], async () => {
    // 初始行程的城市
    const stops = await db.stops.where('tripId').equals(NOEL_TRIP_ID).toArray()
    // 城市指南
    for (const s of stops) {
      // 这个城市有指南就写进去
      const guide = CITY_GUIDES[s.id]
      if (guide) await db.stops.update(s.id, { guide })
    }
    // 交通段
    const segs = await db.segments.where('tripId').equals(NOEL_TRIP_ID).toArray()
    // 逐段处理
    for (const g of segs) {
      // 用 “出发>到达” 找推荐方式
      const rec = SEGMENT_OPTIONS[`${g.fromStopId}>${g.toStopId}`]
      // 没有推荐就跳过
      if (!rec) continue
      // 保留自己添加的方式
      const mine = (g.options ?? []).filter((o) => o.source === 'user')
      // 推荐的放前面，自己的放后面
      await db.segments.update(g.id, { options: [...rec, ...mine] })
    }
    // 记下已合并的版本
    await db.settings.put({ key: KEY, value: CONTENT_VERSION })
  })
}

// 行程变更：哥本哈根 4 晚 + 斯德哥尔摩 4 晚，柏林移到“以后想去”
// 只在手机里还是旧行程时执行（柏林还是住宿城市、还没有斯德哥尔摩），避免覆盖你自己改过的行程
async function applyNewPlan(): Promise<void> {
  // 初始行程
  const trip = await db.trips.get(NOEL_TRIP_ID)
  // 没有（例如已经删了）就跳过
  if (!trip) return
  // 现在的城市
  const stops = await db.stops.where('tripId').equals(NOEL_TRIP_ID).toArray()
  // 柏林
  const berlin = stops.find((s) => s.id === 'stop-berlin')
  // 不是旧行程就跳过
  if (!berlin || berlin.kind !== 'stay' || stops.some((s) => s.id === 'stop-stockholm')) return
  // 按 ID 找现有城市
  const byId = new Map(stops.map((s) => [s.id, s]))
  // 新的城市列表：已有的城市保留原来的资料（交通指南、笔记等），再用新计划覆盖类型和晚数
  const next: Stop[] = NEW_PLAN.stops.map((def, i) => ({ ...byId.get(def.id), ...def, tripId: NOEL_TRIP_ID, order: i }))
  // 你自己加过、新计划里没有的住宿城市：保留为“以后想去”（资料都在）
  for (const s of stops) {
    if (!NEW_PLAN.stops.some((d) => d.id === s.id) && (s.kind === 'stay' || s.kind === 'saved')) next.push({ ...s, kind: 'saved', order: next.length })
  }
  // 保存（交通段会重新连接，日程会跟着城市挪）
  await saveStops(NOEL_TRIP_ID, next)
  // 新的交通段：按新计划设置交通方式（还是“待选”的才设置）
  const segs = await db.segments.where('tripId').equals(NOEL_TRIP_ID).toArray()
  for (const g of segs) {
    // 新计划里这一段的方式
    const mode = NEW_PLAN.modes[`${g.fromStopId}>${g.toStopId}`]
    // 设置
    if (mode && g.mode === 'tbd') await db.segments.update(g.id, { mode })
  }
  // 出发日期、名称（名称没改过才改）
  await db.trips.update(NOEL_TRIP_ID, {
    startDate: NEW_PLAN.startDate,
    startDateHint: undefined,
    ...(trip.name === 'Berlin & København' ? { name: NEW_PLAN.name } : {}),
    updatedAt: Date.now(),
  })
}

// 记录“已经加过的推荐地点 ID”的设置名（删掉的地点靠这个记录才不会被再加回来）
const SEEN_KEY = 'recPlacesSeen'

// 推荐地点里可以补充的文字字段
const FILL_KEYS: (keyof RecommendedPlace)[] = ['nameZh', 'address', 'url', 'priceNote', 'ticket', 'openingHours', 'duration', 'holidayNote', 'sourceUrl', 'note']

// 合并推荐青旅和景点
async function mergePlaces(): Promise<void> {
  // 用事务一次性完成
  await db.transaction('rw', [db.places, db.stops, db.settings], async () => {
    // 已经加过的推荐地点（第一次合并时，初始数据里的地点算已经加过）
    const saved = (await db.settings.get(SEEN_KEY))?.value as string[] | undefined
    const seen = new Set<string>(saved ?? SEED_PLACE_IDS)
    // 行程里现有的城市
    const stopIds = new Set((await db.stops.where('tripId').equals(NOEL_TRIP_ID).toArray()).map((s) => s.id))
    // 行程里现有的地点
    const places = await db.places.where('tripId').equals(NOEL_TRIP_ID).toArray()
    // 按 ID 查找
    const byId = new Map(places.map((p) => [p.id, p]))
    // 逐条处理（序号用来排序：推荐的按清单顺序，排在你自己添加的前面）
    for (const [i, rec] of RECOMMENDED_PLACES.entries()) {
      // 城市不在行程里（例如你删掉了）：跳过
      if (!stopIds.has(rec.stopId)) continue
      // 排序用的序号
      const order = i + 1
      // 手机里已有的同一个地点
      const cur = byId.get(rec.id)
      if (cur) {
        // 已经变成你自己的（理论上不会）：不动
        if (cur.source !== 'recommended') continue
        // 只补空白的字段，你改过的不覆盖
        const patch: Partial<Place> = {}
        for (const k of FILL_KEYS) {
          // 当前是空的、推荐里有内容才补
          if ((cur[k] == null || cur[k] === '') && rec[k] != null) (patch as Record<string, unknown>)[k] = rec[k]
        }
        // 旧数据没有排序序号：补上
        if (cur.createdAt == null) patch.createdAt = order
        // 有要改的才写
        if (Object.keys(patch).length > 0) await db.places.update(cur.id, patch)
      } else if (!seen.has(rec.id)) {
        // 这个城市已经有选定 / 预订的住宿：推荐青旅默认隐藏（在城市页可以点「显示已隐藏的候选」看到）
        const hasChosenHotel = rec.category === 'hotel' && places.some((p) => p.stopId === rec.stopId && p.category === 'hotel' && p.status !== 'candidate')
        // 加进去：候选、推荐
        await db.places.add({ ...rec, tripId: NOEL_TRIP_ID, status: 'candidate', source: 'recommended', hidden: hasChosenHotel || undefined, createdAt: order })
      }
      // 记下已经加过
      seen.add(rec.id)
    }
    // 保存记录
    await db.settings.put({ key: SEEN_KEY, value: [...seen] })
  })
}
