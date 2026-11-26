// ============================================================
// 已删除的旅行（/trash）：删掉的旅行先放在这里，给自己留一条后路
//   - 列表：每次删掉的旅行（名称、日期、城市、什么时候删的）
//   - 点进去（/trash/旅行ID）：最上面「恢复」和「彻底删除」，下面是当时保存的全部内容（像旅行手册一样）
// ============================================================

// 引入路由
import { Link, useNavigate, useParams } from 'react-router-dom'
// 引入实时查询
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入旅行操作
import { purgeTrip, restoreTrip } from '../db/trip'
// 引入照片概况
import { usePhotoSummary } from '../db/photos'
// 引入行程工具
import { routeStops } from '../lib/itinerary'
// 引入组件
import { Icon } from '../components/Icon'
import { PhotoImg } from '../components/Album'
// 引入旅行手册内容（详情页用）
import { Carnet } from './CarnetPage'

// 删除时间的文字
function deletedText(t: number): string {
  // 几天前
  const days = Math.floor((Date.now() - t) / 86400000)
  // 拼起来
  return days <= 0 ? '今天删除' : `${days} 天前删除`
}

// 列表页
export default function TrashPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 已删除的旅行和它们的城市
  const rows = useLiveQuery(async () => {
    // 删掉的旅行（最近删的在前）
    const trips = (await db.trips.toArray()).filter((t) => t.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    // 它们的城市
    const stops = await db.stops.toArray()
    // 组合
    return trips.map((trip) => ({ trip, stops: routeStops(stops.filter((s) => s.tripId === trip.id)) }))
  })
  // 照片概况
  const photos = usePhotoSummary()

  // 返回页面
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-12">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/more'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Corbeille</div>
      <h1 className="text-[28px] font-semibold">已删除的旅行</h1>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">删除的旅行先放在这里，里面的城市、住宿、机票、日程、花费、照片都还在。点进去可以「恢复」，或者「彻底删除」。</p>

      {/* 空 */}
      {rows && rows.length === 0 && <p className="mt-6 rounded-2xl bg-oat p-4 text-center text-[13px] text-muted">没有已删除的旅行</p>}

      {/* 列表 */}
      <div className="mt-5 flex flex-col gap-3">
        {rows?.map(({ trip, stops }) => {
          // 住宿城市
          const cities = stops.filter((s) => s.kind === 'stay')
          // 封面
          const cover = cities.map((s) => photos?.get(s.id)?.cover).find(Boolean)
          // 照片数
          const n = stops.reduce((sum, s) => sum + (photos?.get(s.id)?.count ?? 0), 0)
          // 一行
          return (
            <Link key={trip.id} to={`/trash/${trip.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
              {/* 封面小图 */}
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-oat">{cover && <PhotoImg photo={cover} className="h-full w-full object-cover opacity-80 grayscale-[40%]" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[22px] leading-tight font-medium">{trip.name}</span>
                <span className="block truncate text-[12px] text-muted">{cities.map((s) => s.nameZh || s.name).join(' · ') || '没有目的地'}</span>
                <span className="block text-[12px] text-accent">
                  {deletedText(trip.deletedAt!)}
                  {n > 0 && <span className="text-muted"> · {n} 张照片</span>}
                </span>
              </span>
              <Icon name="chevronRight" size={16} className="shrink-0 text-muted" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// 详情页：恢复 / 彻底删除 + 当时保存的全部内容
export function TrashDetailPage() {
  // 网址参数
  const { id } = useParams()
  // 页面跳转
  const navigate = useNavigate()
  // 这次旅行
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id])

  // 加载中
  if (trip === undefined) return null
  // 找不到或者已经恢复了
  if (!trip || !trip.deletedAt)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-paper px-8 text-center">
        <p className="text-muted">{trip ? '这次旅行已经恢复了' : '这次旅行已经彻底删除了'}</p>
        <Link to={trip ? '/trips' : '/trash'} className="text-accent underline">
          {trip ? '去我的旅行' : '回到已删除的旅行'}
        </Link>
      </div>
    )

  // 恢复
  const restore = async () => {
    await restoreTrip(trip.id)
    navigate('/trips')
  }
  // 彻底删除（再确认一次）
  const purge = async () => {
    if (!window.confirm(`彻底删除「${trip.name}」？\n\n它的城市、住宿、机票和车票文件、日程、花费、照片都会永久删除，找不回来。`)) return
    await purgeTrip(trip.id)
    navigate('/trash')
  }

  // 返回页面
  return (
    <div className="flex h-full flex-col bg-paper">
      {/* 顶部：返回 + 两个选择 */}
      <div className="shrink-0 border-b border-line bg-card px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button aria-label="返回" onClick={() => navigate('/trash')} className="-ml-3 flex h-11 w-11 items-center justify-center">
          <Icon name="back" size={22} />
        </button>
        <p className="text-[12px] text-accent">
          「{trip.name}」{deletedText(trip.deletedAt)}，下面是它保存的全部内容
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={restore} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[15px] text-paper">
            <Icon name="upload" size={17} />
            恢复
          </button>
          <button onClick={purge} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-accent text-[15px] text-accent">
            <Icon name="trash" size={17} />
            彻底删除
          </button>
        </div>
      </div>
      {/* 内容（和旅行手册一样，只能看） */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-12">
        <Carnet tripId={trip.id} embedded />
      </div>
    </div>
  )
}
