// ============================================================
// 编辑行程（/trip）
//   - 旅行名称、副标题、出发日期（可以“待定”）、人数
//   - 城市：添加、编辑、删除、调整顺序、住几晚
//   - 城市之间的交通：点进去看可选方式（交通详情页）
// 改动立即保存；日程会跟着城市自动挪动
// ============================================================

// 引入 React 钩子
import { useMemo, useState } from 'react'
// 引入路由工具
import { Link, useNavigate } from 'react-router-dom'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入数据结构
import type { Stop, StopKind } from '../db/schema'
// 引入数据操作
import { saveStops, updateTrip } from '../db/trip'
// 引入行程工具
import { MODE_LABEL, computeSpans, dayLabel } from '../lib/itinerary'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入组件
import { Icon, type IconName } from '../components/Icon'
import { Field, INPUT, Segmented } from '../components/Sheet'
import { StopForm, Stepper, type StopDraft } from '../components/StopForm'
// 引入加载画面
import { Loading } from './HomePage'

// 引入交通方式图标
import { MODE_ICON } from './SegmentPage'
// 地点类型的中文
const KIND_LABEL: Record<StopKind, string> = { stay: '住宿', transit: '路过', home: '出发 / 回家' }

// 页面组件
export default function TripEditPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 城市表单：null 不显示；{ stop: null } 新建；{ stop } 编辑
  const [stopForm, setStopForm] = useState<{ stop: Stop | null } | null>(null)

  // 每个城市的时间段
  const spans = useMemo(() => (data ? computeSpans(data.stops) : []), [data])
  // 地图默认中心（第一个城市，用于城市搜索）
  const near = useMemo<LngLat>(() => (data?.stops[0] ? [data.stops[0].lng, data.stops[0].lat] : [10, 53]), [data])

  // 加载中
  if (!data || !itin) return <Loading />
  // 旅行
  const trip = data.trip
  // 城市（按顺序）
  const stops = data.stops

  // 保存新的城市列表
  const commit = (next: Stop[]) => saveStops(trip.id, next)

  // 移动城市
  const move = (i: number, dir: -1 | 1) => {
    // 目标位置
    const j = i + dir
    // 越界
    if (j < 0 || j >= stops.length) return
    // 交换
    const next = [...stops]
    ;[next[i], next[j]] = [next[j], next[i]]
    // 保存
    commit(next)
  }

  // 改住几晚
  const setNights = (i: number, n: number) => commit(stops.map((s, k) => (k === i ? { ...s, nights: n } : s)))

  // 删除城市
  const remove = (i: number) => {
    // 至少保留两个地点
    if (stops.length <= 2) {
      window.alert('行程里至少要有两个地点')
      return
    }
    // 这个城市的酒店景点数量
    const n = data.places.filter((p) => p.stopId === stops[i].id).length
    // 确认
    if (!window.confirm(`删除「${stops[i].name}」？${n > 0 ? `它的 ${n} 个酒店/景点` : ''}${n > 0 ? '和' : ''}在这里的日程也会一起删除。`)) return
    // 保存
    commit(stops.filter((_, k) => k !== i))
  }

  // 城市表单保存
  const onStopSaved = (draft: StopDraft) => {
    // 已有：替换
    if (stops.some((s) => s.id === draft.id)) commit(stops.map((s) => (s.id === draft.id ? { ...s, ...draft } : s)))
    // 新建：放在最后一个住宿城市后面（没有住宿城市就放在“回家”前面），之后可以再调整顺序
    else {
      // 新城市
      const ns: Stop = { ...draft, tripId: trip.id, order: 0 }
      // 最后一个住宿城市的位置
      const lastStay = stops.map((x) => x.kind).lastIndexOf('stay')
      // 最后一个是回家
      const lastIsHome = stops[stops.length - 1]?.kind === 'home'
      // 插入位置
      const at = lastStay >= 0 ? lastStay + 1 : lastIsHome ? stops.length - 1 : stops.length
      // 插入并保存
      commit([...stops.slice(0, at), ns, ...stops.slice(at)])
    }
    // 关闭表单
    setStopForm(null)
  }

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-10">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Itinéraire</div>
      <h1 className="text-[28px] font-semibold">编辑行程</h1>

      {/* ===== 基本信息 ===== */}
      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold">基本信息</h2>
        {/* 名称（离开输入框时保存） */}
        <Field label="旅行名称">
          <input defaultValue={trip.name} onBlur={(e) => e.target.value.trim() && updateTrip(trip.id, { name: e.target.value.trim() })} className={INPUT} />
        </Field>
        {/* 副标题 */}
        <Field label="副标题">
          <input defaultValue={trip.subtitle ?? ''} onBlur={(e) => updateTrip(trip.id, { subtitle: e.target.value.trim() || undefined })} className={INPUT} />
        </Field>
        {/* 出发日期 */}
        <Field label="出发日期（旅途第一天）" group>
          <Segmented
            label="出发日期"
            value={trip.startDate ? 'set' : 'tbd'}
            options={[
              { value: 'tbd', label: '待定' },
              { value: 'set', label: '已定' },
            ]}
            // 切到“已定”时先填一个默认日期（12 月 23 日），之后可以改
            onChange={(v) => updateTrip(trip.id, { startDate: v === 'set' ? (trip.startDate ?? '2026-12-23') : null })}
          />
        </Field>
        {/* 已定：选日期 */}
        {trip.startDate ? (
          <Field label="日期">
            <input type="date" value={trip.startDate} onChange={(e) => e.target.value && updateTrip(trip.id, { startDate: e.target.value })} className={INPUT} />
          </Field>
        ) : (
          // 待定：写个提示
          <Field label="待定时的说明" hint="首页和未来旅程里会显示这句话">
            <input defaultValue={trip.startDateHint ?? ''} onBlur={(e) => updateTrip(trip.id, { startDateHint: e.target.value.trim() || undefined })} placeholder="例如 12/20–12/23 之间出发" className={INPUT} />
          </Field>
        )}
        {/* 人数 */}
        <Field label="出行人数" group>
          <Stepper value={trip.travelers} min={1} max={12} unit="人" onChange={(n) => updateTrip(trip.id, { travelers: n })} />
        </Field>
      </section>

      {/* ===== 路线 ===== */}
      <section className="mt-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">路线</h2>
          <span className="text-[12px] text-muted">共 {itin.total} 天</span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">改了顺序或住几晚，日期和每天的日程会自动跟着调整。</p>

        {/* 城市和交通交替排列 */}
        <ol className="mt-3 flex flex-col">
          {stops.map((s, i) => {
            // 这个城市的时间段
            const span = spans.find((x) => x.stop.id === s.id)
            // 到达那天
            const arrive = span ? itin.days[span.arriveDay - 1] : undefined
            // 和下一个城市之间的交通
            const seg = i < stops.length - 1 ? data.segments.find((g) => g.fromStopId === s.id && g.toStopId === stops[i + 1].id) : undefined
            // 一个城市 + 后面的交通
            return (
              <li key={s.id}>
                {/* 城市行 */}
                <div className="rounded-2xl bg-paper/70 p-3">
                  <div className="flex items-start gap-3">
                    {/* 圆点：住宿城市空心，家实心 */}
                    <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-accent ${s.kind === 'home' ? 'bg-accent' : ''}`} />
                    {/* 名字和信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-serif text-[21px] leading-tight font-medium">{s.name}</span>
                        <span className="truncate text-[12px] text-muted">{s.nameZh}</span>
                      </div>
                      <div className="text-[12px] text-muted">
                        {KIND_LABEL[s.kind]}
                        {arrive && ` · ${s.kind === 'stay' ? '到达 ' : ''}${dayLabel(arrive)}`}
                      </div>
                    </div>
                    {/* 编辑 */}
                    <IconBtn label={`编辑 ${s.name}`} icon="edit" onClick={() => setStopForm({ stop: s })} />
                  </div>
                  {/* 第二行：住几晚 + 排序 + 删除 */}
                  <div className="mt-2 flex items-center gap-1 pl-6">
                    {/* 住几晚 */}
                    {s.kind === 'stay' ? <Stepper value={s.nights} min={1} max={30} unit="晚" onChange={(n) => setNights(i, n)} /> : <span className="text-[12px] text-muted">不过夜</span>}
                    {/* 右侧按钮 */}
                    <span className="ml-auto flex">
                      <IconBtn label="上移" icon="chevronUp" disabled={i === 0} onClick={() => move(i, -1)} />
                      <IconBtn label="下移" icon="chevronDown" disabled={i === stops.length - 1} onClick={() => move(i, 1)} />
                      <IconBtn label={`删除 ${s.name}`} icon="trash" onClick={() => remove(i)} />
                    </span>
                  </div>
                  {/* 城市详情入口 */}
                  {s.kind === 'stay' && (
                    <Link to={`/city/${s.id}`} className="mt-1 ml-6 inline-flex h-8 items-center gap-1 text-[12px] text-accent">
                      酒店 · 景点
                      <Icon name="chevronRight" size={13} />
                    </Link>
                  )}
                </div>
                {/* 交通行：点进去看可选方式、选方式、标记已订 */}
                {seg && (
                  <Link to={`/segment/${seg.id}`} className="my-1 ml-[17px] flex w-[calc(100%-17px)] items-center gap-2.5 border-l-2 border-dashed border-line-strong py-2 pl-4 text-left">
                    <Icon name={MODE_ICON[seg.mode]} size={16} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {MODE_LABEL[seg.mode]}
                      {seg.timeOfDay && ` · ${seg.timeOfDay}`}
                      <span className="text-muted">
                        {seg.options?.find((o) => o.id === seg.chosenOptionId)?.provider
                          ? ` · ${seg.options.find((o) => o.id === seg.chosenOptionId)!.provider}`
                          : seg.options?.length
                            ? ` · ${seg.options.length} 种可选`
                            : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${seg.booked ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{seg.booked ? '已订' : '未订'}</span>
                    <Icon name="chevronRight" size={14} className="shrink-0 text-muted" />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>

        {/* 添加城市 */}
        <button onClick={() => setStopForm({ stop: null })} className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-[14px]">
          <Icon name="plus" size={16} />
          添加城市
        </button>
      </section>

      {/* 城市表单 */}
      {stopForm && <StopForm initial={stopForm.stop} near={near} onSave={onStopSaved} onClose={() => setStopForm(null)} />}
    </div>
  )
}

// 小图标按钮
function IconBtn({ label, icon, onClick, disabled }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean }) {
  // 返回按钮
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-full text-muted disabled:opacity-30">
      <Icon name={icon} size={17} />
    </button>
  )
}
