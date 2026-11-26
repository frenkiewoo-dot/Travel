// ============================================================
// 城市的天气（城市详情的「天气」标签）
//   - 今天（按手机上的日期）：现在几度、体感、天气、最高最低、降水概率、风、日出日落
//   - 接下来 24 小时（左右滑动）
//   - 未来天气：一直到有预报的最后一天；住在这个城市的那几天标出来；点一天看详情
//   - 这个国家的官方天气网站
// ============================================================

// 引入 React 钩子
import { useCallback, useEffect, useState } from 'react'
// 引入数据结构
import type { Stop } from '../db/schema'
// 引入天气
import { OFFICIAL_WEATHER, describe, getWeather, type DayWeather, type Weather } from '../lib/weather'
// 引入日期工具
import { toISODate } from '../lib/itinerary'
import { chineseDate } from '../lib/albumLayout'
// 引入横向拖动
import { useDragScroll } from '../lib/useDragScroll'
// 引入图标
import { Icon } from './Icon'

// 天气组件；stayDates = 住在这个城市的日期（标出来）
export function WeatherView({ stop, stayDates }: { stop: Stop; stayDates: string[] }) {
  // 天气数据
  const [w, setW] = useState<Weather | null>(null)
  // 是不是旧的（没网）
  const [stale, setStale] = useState(false)
  // 出错（没网也没有缓存）
  const [error, setError] = useState(false)
  // 正在加载
  const [loading, setLoading] = useState(true)
  // 展开的那一天
  const [open, setOpen] = useState<string | null>(null)
  // 每小时横条的拖动
  const drag = useDragScroll<HTMLDivElement>()

  // 读取天气
  const load = useCallback(
    async (force = false) => {
      setLoading(true)
      setError(false)
      try {
        const r = await getWeather(stop.lat, stop.lng, force)
        setW(r.weather)
        setStale(r.stale)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [stop.lat, stop.lng],
  )
  // 打开时读取
  useEffect(() => {
    load()
  }, [load])

  // 官方天气网站
  const official = OFFICIAL_WEATHER[stop.country]

  // 没网也没缓存
  if (error && !w)
    return (
      <div className="rounded-2xl bg-oat p-4 text-[13px] leading-relaxed text-muted">
        现在没有网络，也没有保存过 {stop.nameZh || stop.name} 的天气。联网后打开这里就会显示，之后断网也能看到上次的预报。
        <button onClick={() => load(true)} className="mt-2 block text-accent underline underline-offset-2">
          再试一次
        </button>
        <OfficialLinks official={official} />
      </div>
    )
  // 第一次加载
  if (!w) return <p className="py-8 text-center text-[13px] text-muted">正在获取天气…</p>

  // 今天（按手机日期；时区不同找不到时用第一天）
  const todayStr = toISODate(new Date())
  const ti = Math.max(0, w.days.findIndex((d) => d.date === todayStr))
  const today = w.days[ti]
  // 未来
  const future = w.days.slice(ti + 1)
  // 未来这些天的最低、最高（画温度条用）
  const lo = Math.min(...w.days.map((d) => d.min))
  const hi = Math.max(...w.days.map((d) => d.max))
  // 现在的天气
  const now = describe(w.current.code)
  // 最后一天
  const lastDay = w.days[w.days.length - 1]

  // 返回
  return (
    <div>
      {/* ===== 今天 ===== */}
      <section className="rounded-[20px] border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold">今天 · {chineseDate(today.date)}</span>
          <span className="text-[12px] text-muted">当地 {w.current.time.slice(11, 16)}</span>
        </div>
        {/* 大字温度 */}
        <div className="mt-2 flex items-center gap-4">
          <Icon name={now.icon} size={52} stroke={1.3} className="shrink-0 text-ink" />
          <div>
            <div className="text-[60px] leading-none font-extralight tracking-tight tabular-nums">{Math.round(w.current.temp)}°</div>
            <div className="mt-1 text-[14px]">
              {now.label}
              <span className="text-muted"> · 体感 {Math.round(w.current.feels)}°</span>
            </div>
          </div>
        </div>
        {/* 数据 */}
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Stat label="最高 / 最低" value={`${Math.round(today.max)}° / ${Math.round(today.min)}°`} />
          <Stat label="降水概率" value={today.rainChance != null ? `${today.rainChance}%` : '—'} />
          <Stat label="风" value={`${Math.round(w.current.wind)} km/h`} />
          <Stat label="湿度" value={`${Math.round(w.current.humidity)}%`} />
        </dl>
        <p className="mt-3 text-center text-[12px] text-muted">
          日出 {today.sunrise} · 日落 {today.sunset}
        </p>
      </section>

      {/* ===== 接下来 24 小时 ===== */}
      <h3 className="mt-5 text-[13px] font-semibold text-muted">接下来 24 小时</h3>
      <div ref={drag} className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 select-none">
        {w.hours.map((h, i) => {
          const d = describe(h.code)
          return (
            <div key={h.time} className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-2xl bg-card py-2.5 text-[12px]">
              <span className="text-muted">{i === 0 ? '现在' : `${Number(h.time.slice(11, 13))}时`}</span>
              <Icon name={d.icon} size={20} aria-label={d.label} />
              <span className="font-semibold tabular-nums">{Math.round(h.temp)}°</span>
              <span className="text-[10px] text-muted tabular-nums">{h.rainChance != null ? `${h.rainChance}%` : ''}</span>
            </div>
          )
        })}
      </div>

      {/* ===== 未来天气 ===== */}
      <div className="mt-6 flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold">未来 {future.length} 天</h3>
        <span className="text-[12px] text-muted">预报只到 {chineseDate(lastDay.date)}</span>
      </div>
      <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card">
        {future.map((d) => (
          <DayRow key={d.date} d={d} lo={lo} hi={hi} here={stayDates.includes(d.date)} open={open === d.date} onToggle={() => setOpen((o) => (o === d.date ? null : d.date))} />
        ))}
      </ul>
      {stayDates.length > 0 && !w.days.some((d) => stayDates.includes(d.date)) && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          住在这里的日期（{chineseDate(stayDates[0])} 起）还没有预报，大约出发前两周会出现。
        </p>
      )}

      {/* ===== 官方网站和说明 ===== */}
      <OfficialLinks official={official} />
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        天气数据：Open-Meteo（欧洲用各国气象局的模型）· {stale ? '现在没网，显示的是' : '更新于'} {new Date(w.fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        {stale && ' 的预报'}
        <button onClick={() => load(true)} disabled={loading} className="ml-2 text-accent underline underline-offset-2 disabled:opacity-50">
          {loading ? '正在刷新…' : '刷新'}
        </button>
      </p>
    </div>
  )
}

// 一个数据
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-oat px-1 py-2">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

// 未来的一天：日期、天气、降水概率、最低—最高（温度条）；点开看详情
function DayRow({ d, lo, hi, here, open, onToggle }: { d: DayWeather; lo: number; hi: number; here: boolean; open: boolean; onToggle: () => void }) {
  // 天气
  const desc = describe(d.code)
  // 温度条的位置（占整个范围的百分比）
  const span = Math.max(1, hi - lo)
  const left = ((d.min - lo) / span) * 100
  const width = Math.max(4, ((d.max - d.min) / span) * 100)
  // 返回
  return (
    <li>
      <button onClick={onToggle} aria-expanded={open} className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left ${here ? 'bg-accent-soft/50' : ''}`}>
        {/* 日期 */}
        <span className="w-[86px] shrink-0">
          <span className="block text-[13px] font-medium">{chineseDate(d.date).split(' ')[1]}</span>
          <span className="block text-[11px] text-muted">
            {chineseDate(d.date).split(' ')[0]}
            {here && <span className="ml-1 text-accent">· 在这里</span>}
          </span>
        </span>
        {/* 天气 */}
        <Icon name={desc.icon} size={20} className="shrink-0" />
        <span className="w-9 shrink-0 text-[11px] text-muted tabular-nums">{d.rainChance != null && d.rainChance >= 20 ? `${d.rainChance}%` : ''}</span>
        {/* 最低 */}
        <span className="w-7 shrink-0 text-right text-[13px] text-muted tabular-nums">{Math.round(d.min)}°</span>
        {/* 温度条 */}
        <span className="relative h-1.5 min-w-0 flex-1 rounded-full bg-oat" aria-hidden="true">
          <span className="absolute inset-y-0 rounded-full bg-ink" style={{ left: `${left}%`, width: `${width}%` }} />
        </span>
        {/* 最高 */}
        <span className="w-7 shrink-0 text-[13px] font-semibold tabular-nums">{Math.round(d.max)}°</span>
      </button>
      {/* 详情 */}
      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3.5 pb-3 text-[12px] text-muted">
          <span>天气：{desc.label}</span>
          <span>降水：{d.rainSum != null ? `${d.rainSum} mm` : '—'}{d.rainChance != null ? `（${d.rainChance}%）` : ''}</span>
          <span>最大风速：{d.windMax != null ? `${Math.round(d.windMax)} km/h` : '—'}</span>
          <span>
            日出 {d.sunrise} · 日落 {d.sunset}
          </span>
        </div>
      )}
    </li>
  )
}

// 官方天气网站链接
function OfficialLinks({ official }: { official?: { name: string; nameZh: string; url: string } }) {
  return (
    <div className="mt-5 flex flex-col gap-2">
      {official && (
        <a href={official.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
          <span>
            <span className="block text-[14px] font-semibold">{official.name}</span>
            <span className="block text-[12px] text-muted">{official.nameZh} · 官方天气网站</span>
          </span>
          <Icon name="external" size={15} className="text-muted" />
        </a>
      )}
      <a href="https://www.yr.no/en" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        <span>
          <span className="block text-[14px] font-semibold">Yr</span>
          <span className="block text-[12px] text-muted">挪威气象局的全球天气预报（北欧很准）</span>
        </span>
        <Icon name="external" size={15} className="text-muted" />
      </a>
    </div>
  )
}
