// ============================================================
// 把推荐内容包（src/data/content.ts）合并进手机里的数据
//   - 只在内容版本变化时执行一次
//   - 交通方式：替换“推荐”的那些，保留你自己添加的，保留你选好的方式
//   - 城市指南：直接更新成最新版（你自己的笔记存在别的字段，不受影响）
//   - 你删掉的城市不会被加回来
// ============================================================

// 引入数据库
import { db } from './db'
// 引入推荐内容
import { CITY_GUIDES, CONTENT_VERSION, NOEL_TRIP_ID, SEGMENT_OPTIONS } from '../data/content'

// 记录已合并的内容版本的设置名
const KEY = 'contentVersion'

// 合并推荐内容（App 启动时调用）
export async function applyContent(): Promise<void> {
  // 已经合并过的版本
  const done = ((await db.settings.get(KEY))?.value as number | undefined) ?? 0
  // 已经是最新的就不用做
  if (done >= CONTENT_VERSION) return
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
