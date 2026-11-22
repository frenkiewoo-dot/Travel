// ============================================================
// 图钉数据
//   - 地图标签里的“草稿图钉”：存在设置表的 draftPins 里
//   - 编辑某一天时（网址带 ?day=3）：图钉就是那天日程里的站点，改动直接保存到日程
// ============================================================

// 引入实时查询钩子
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from './db'
// 引入数据钩子
import { useTripData } from './hooks'
// 引入数据结构
import type { DayPlan, DayPlanItem } from './schema'

// 草稿图钉的设置名
export const DRAFT_PINS_KEY = 'draftPins'

// 生成一个新 ID
export function newId(prefix = 'pin'): string {
  // 用浏览器自带的随机 ID
  return `${prefix}-${crypto.randomUUID()}`
}

// 图钉钩子；day 为 null 时用草稿，否则用那一天的日程
export function usePins(day: number | null) {
  // 旅行数据（编辑某一天时需要）
  const data = useTripData()
  // 读草稿（包一层对象，用来区分“加载中”和“没有草稿”）
  const draft = useLiveQuery(async () => ({ rec: await db.settings.get(DRAFT_PINS_KEY) }))
  // 那一天的日程
  const plan = day && data ? data.dayPlans.find((p) => p.dayIndex === day) : undefined
  // 当前图钉列表：加载中为 undefined
  const pins: DayPlanItem[] | undefined = day
    ? data
      ? (plan?.items ?? [])
      : undefined
    : draft
      ? ((draft.rec?.value as DayPlanItem[] | undefined) ?? [])
      : undefined

  // 保存新的图钉列表
  const save = async (next: DayPlanItem[]) => {
    // 草稿：直接存进设置表
    if (!day) {
      await db.settings.put({ key: DRAFT_PINS_KEY, value: next })
      return
    }
    // 编辑某一天，但旅行数据还没加载
    if (!data) return
    // 已有日程：更新站点（改过就不再是示例）
    if (plan) await db.dayPlans.update(plan.id, { items: next, isSample: false })
    // 没有日程：新建
    else {
      // 新日程
      const p: DayPlan = { id: `${data.trip.id}:${day}`, tripId: data.trip.id, dayIndex: day, items: next }
      // 写入
      await db.dayPlans.put(p)
    }
  }

  // 从数据库读最新的图钉列表（异步回调里用，避免拿到过时的数据）
  const fresh = async (): Promise<DayPlanItem[]> => {
    // 草稿
    if (!day) return ((await db.settings.get(DRAFT_PINS_KEY))?.value as DayPlanItem[] | undefined) ?? []
    // 某一天
    if (!data) return []
    // 读那天的日程
    return (await db.dayPlans.get(`${data.trip.id}:${day}`))?.items ?? []
  }

  // 在一个数据库事务里“读最新列表 → 修改 → 保存”
  // 同时发生的多次修改（例如两个图钉同时自动取名）会排队执行，不会互相覆盖
  const modify = (fn: (cur: DayPlanItem[]) => DayPlanItem[] | null) =>
    db.transaction('rw', [db.settings, db.dayPlans], async () => {
      // 最新列表
      const cur = await fresh()
      // 计算新列表（返回 null 表示不用改）
      const next = fn(cur)
      // 保存
      if (next) await save(next)
    })

  // 修改某个图钉（例如拖动后的新坐标、自动取的名字）
  const update = (id: string, patch: Partial<DayPlanItem>) =>
    modify((cur) => (cur.some((p) => p.id === id) ? cur.map((p) => (p.id === id ? { ...p, ...patch } : p)) : null))

  // 在最后加一个图钉
  const add = (pin: DayPlanItem) => modify((cur) => [...cur, pin])

  // 把图钉保存到某一天的日程；mode = append 追加在后面，replace 替换原有安排
  const saveToDay = async (target: number, items: DayPlanItem[], mode: 'append' | 'replace') => {
    // 旅行数据还没加载
    if (!data) return
    // 目标那天的日程
    const existing = data.dayPlans.find((p) => p.dayIndex === target)
    // 复制图钉并换新 ID（避免和草稿共用 ID）
    const copies = items.map((it) => ({ ...it, id: newId('item') }))
    // 最终的站点列表
    const merged = mode === 'append' && existing ? [...existing.items, ...copies] : copies
    // 已有日程就更新
    if (existing) await db.dayPlans.update(existing.id, { items: merged, isSample: false })
    // 否则新建
    else await db.dayPlans.put({ id: `${data.trip.id}:${target}`, tripId: data.trip.id, dayIndex: target, items: merged })
  }

  // 返回
  return { pins, save, update, add, saveToDay, data, plan }
}
