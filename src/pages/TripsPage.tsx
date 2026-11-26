// ============================================================
// 我的旅行（/trips）：所有旅行的列表
//   - 每次旅行一张卡片：封面（有照片就用照片）、名称、日期、城市、照片张数
//   - 切换“当前旅行”（首页、今日旅程、票夹、预算都跟着换）
//   - 新建旅行（例如明年去意大利）；删除不需要的旅行
//   - 以前的旅行和照片都保留，随时可以回来看
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由
import { useNavigate } from 'react-router-dom'
// 引入实时查询
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入数据结构
import type { Stop, Trip } from '../db/schema'
// 引入数据钩子
import { useActiveTripId } from '../db/hooks'
// 引入旅行操作
import { createTrip, deleteTrip, setActiveTrip } from '../db/trip'
// 引入照片概况
import { usePhotoSummary, type StopPhotoSummary } from '../db/photos'
// 引入行程工具
import { addDays, routeStops, toISODate, totalDays } from '../lib/itinerary'
// 引入组件
import { Icon } from '../components/Icon'
import { PhotoImg } from '../components/Album'
import { Field, INPUT, Segmented, Sheet } from '../components/Sheet'
import { Stepper } from '../components/StopForm'

// 一次旅行的概况
interface TripRow {
  // 旅行
  trip: Trip
  // 它的地点（按顺序）
  stops: Stop[]
}

// 页面组件
export default function TripsPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 当前旅行
  const activeId = useActiveTripId()
  // 所有旅行和它们的地点
  const rows = useLiveQuery(async () => {
    // 所有旅行
    const trips = await db.trips.toArray()
    // 所有地点
    const stops = await db.stops.toArray()
    // 组合
    return trips.map<TripRow>((trip) => ({ trip, stops: stops.filter((s) => s.tripId === trip.id).sort((a, b) => a.order - b.order) }))
  })
  // 照片概况
  const photos = usePhotoSummary()
  // 是否显示新建面板
  const [creating, setCreating] = useState(false)

  // 加载中
  if (!rows) return null

  // 排序：日期待定的在最前（正在计划），其余按出发日期从新到旧
  const sorted = [...rows].sort((a, b) => {
    // 没有日期的排前面
    if (!a.trip.startDate || !b.trip.startDate) return (a.trip.startDate ? 1 : 0) - (b.trip.startDate ? 1 : 0)
    // 新的在前
    return b.trip.startDate.localeCompare(a.trip.startDate)
  })

  // 返回页面
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-12">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/more'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 + 新建 */}
      <div className="flex items-end justify-between">
        <div>
          <div className="font-serif text-[16px] italic text-muted">Voyages</div>
          <h1 className="text-[28px] font-semibold">我的旅行</h1>
        </div>
        <button onClick={() => setCreating(true)} className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] text-paper">
          <Icon name="plus" size={16} />
          新建旅行
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">点一次旅行把它设为“当前旅行”，首页、今日旅程、票夹、预算都会换成它。以前的旅行和照片都会一直保留。</p>

      {/* 旅行列表 */}
      <div className="mt-5 flex flex-col gap-4">
        {sorted.map((r) => (
          <TripCard
            key={r.trip.id}
            row={r}
            active={r.trip.id === activeId}
            photos={photos}
            onOpen={async () => {
              // 设为当前旅行，回首页
              await setActiveTrip(r.trip.id)
              navigate('/')
            }}
            onDelete={async () => {
              // 照片张数
              const n = r.stops.reduce((sum, s) => sum + (photos?.get(s.id)?.count ?? 0), 0)
              // 确认
              if (!window.confirm(`删除旅行「${r.trip.name}」？它的城市、酒店景点、日程、车票、花费${n ? `和 ${n} 张照片` : ''}都会删除，找不回来。建议先导出备份。`)) return
              // 删除
              await deleteTrip(r.trip.id)
            }}
          />
        ))}
      </div>

      {/* 新建 */}
      {creating && (
        <NewTripSheet
          defaultHome={rows.find((r) => r.trip.id === activeId)?.stops.find((s) => s.kind === 'home')}
          onClose={() => setCreating(false)}
          onCreated={() => navigate('/trip')}
        />
      )}
    </div>
  )
}

// 一次旅行的卡片
function TripCard({ row, active, photos, onOpen, onDelete }: { row: TripRow; active: boolean; photos: Map<string, StopPhotoSummary> | undefined; onOpen: () => void; onDelete: () => void }) {
  // 旅行
  const t = row.trip
  // 去的城市（住宿城市）
  const cities = routeStops(row.stops).filter((s) => s.kind === 'stay')
  // 封面：第一个有照片的城市的封面
  const cover = cities.map((s) => photos?.get(s.id)?.cover).find(Boolean) ?? row.stops.map((s) => photos?.get(s.id)?.cover).find(Boolean)
  // 照片总数
  const photoCount = row.stops.reduce((sum, s) => sum + (photos?.get(s.id)?.count ?? 0), 0)
  // 总天数和最后一天
  const total = totalDays(row.stops)
  const end = t.startDate ? addDays(t.startDate, total - 1) : null
  // 状态
  const today = toISODate(new Date())
  const status = !t.startDate ? '日期待定' : end && end < today ? '已结束' : t.startDate > today ? `还有 ${Math.round((Date.parse(t.startDate) - Date.parse(today)) / 86400000)} 天` : '旅行中'
  // 日期文字
  const dates = t.startDate && end ? `${fmt(t.startDate)} — ${fmt(end)} · ${total} 天` : `共 ${total} 天`

  // 返回卡片
  return (
    <article className={`overflow-hidden rounded-[22px] border bg-card ${active ? 'border-ink' : 'border-line'}`}>
      {/* 封面（点它切换到这次旅行） */}
      <button onClick={onOpen} aria-label={`打开旅行 ${t.name}`} className="relative block w-full text-left" style={{ aspectRatio: '16 / 9' }}>
        {cover ? (
          <>
            <PhotoImg photo={cover} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          </>
        ) : (
          // 没有照片：文字封面
          <div className="absolute inset-0 flex items-center justify-center bg-oat px-6 text-center">
            <span className="font-serif text-[26px] leading-tight text-muted italic">{cities.length ? cities.map((s) => s.name).join(' · ') : '还没有目的地'}</span>
          </div>
        )}
        {/* 左上角状态 */}
        <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] ${active ? 'bg-ink text-paper' : 'bg-card/90 text-ink'}`}>{active ? `当前 · ${status}` : status}</span>
        {/* 有照片时：名称写在封面上 */}
        {cover && (
          <span className="absolute inset-x-4 bottom-3 text-white">
            <span className="block font-serif text-[28px] leading-none font-medium">{t.name}</span>
          </span>
        )}
      </button>
      {/* 文字信息 */}
      <div className="p-4">
        {!cover && <div className="font-serif text-[26px] leading-none font-medium">{t.name}</div>}
        {t.subtitle && <div className="mt-1 font-serif text-[15px] text-muted italic">{t.subtitle}</div>}
        <div className="mt-1.5 text-[13px] text-muted">{dates}</div>
        <div className="mt-0.5 truncate text-[13px]">{cities.length ? cities.map((s) => s.nameZh || s.name).join(' · ') : '在「本次旅行」里添加目的地'}</div>
        {/* 底部 */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted">{photoCount ? `${photoCount} 张照片` : '还没有照片'}</span>
          <span className="flex items-center gap-2">
            {/* 不是当前旅行才能删 */}
            {!active && (
              <button onClick={onDelete} className="h-9 px-2 text-[12px] text-muted underline underline-offset-2">
                删除
              </button>
            )}
            <button onClick={onOpen} className={`flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] ${active ? 'border border-line-strong' : 'bg-ink text-paper'}`}>
              {active ? '打开' : '切换到这次'}
              <Icon name="chevronRight" size={14} />
            </button>
          </span>
        </div>
      </div>
    </article>
  )
}

// 'YYYY-MM-DD' → “2026/12/20”
function fmt(d: string): string {
  return d.replace(/-/g, '/')
}

// 新建旅行的面板
function NewTripSheet({ defaultHome, onClose, onCreated }: { defaultHome?: Stop; onClose: () => void; onCreated: () => void }) {
  // 名称
  const [name, setName] = useState('')
  // 副标题
  const [subtitle, setSubtitle] = useState('')
  // 出发日期是否已定
  const [dateMode, setDateMode] = useState<'tbd' | 'set'>('tbd')
  // 出发日期
  const [date, setDate] = useState('')
  // 人数
  const [travelers, setTravelers] = useState(1)
  // 正在保存
  const [busy, setBusy] = useState(false)
  // 出发 / 回家的城市：沿用当前旅行的，没有就用格罗宁根
  const home = defaultHome
    ? { name: defaultHome.name, nameZh: defaultHome.nameZh, country: defaultHome.country, lat: defaultHome.lat, lng: defaultHome.lng }
    : { name: 'Groningen', nameZh: '格罗宁根', country: 'NL', lat: 53.2194, lng: 6.5665 }

  // 保存
  const save = async () => {
    // 名称必填
    if (!name.trim()) return
    // 防止点两次
    setBusy(true)
    // 新建（会自动设为当前旅行）
    await createTrip({ name: name.trim(), subtitle: subtitle.trim() || undefined, startDate: dateMode === 'set' && date ? date : null, travelers, home })
    // 去「本次旅行」加目的地
    onCreated()
  }

  // 返回面板
  return (
    <Sheet
      title="新建旅行"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          <button onClick={save} disabled={!name.trim() || busy} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-40">
            新建并添加目的地
          </button>
        </div>
      }
    >
      <Field label="旅行名称 *">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 Italia" className={INPUT} autoFocus />
      </Field>
      <Field label="副标题" hint="会以斜体显示，例如季节或主题">
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="例如 Printemps 2027" className={INPUT} />
      </Field>
      <Field label="出发日期（旅途第一天）" group>
        <Segmented
          label="出发日期"
          value={dateMode}
          options={[
            { value: 'tbd', label: '待定' },
            { value: 'set', label: '已定' },
          ]}
          onChange={setDateMode}
        />
        {dateMode === 'set' && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="出发日期" className={`${INPUT} mt-2`} />}
      </Field>
      <Field label="出行人数" group>
        <Stepper value={travelers} min={1} max={12} unit="人" onChange={setTravelers} />
      </Field>
      <p className="mt-1 rounded-xl bg-oat px-3 py-2.5 text-[12px] leading-relaxed text-muted">
        出发和回家：{home.nameZh || home.name}（和当前旅行一样，之后可以在「本次旅行」里改）。新建后会自动切换到这次旅行，并打开「本次旅行」让你按顺序添加城市。
      </p>
    </Sheet>
  )
}
