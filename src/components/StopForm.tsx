// ============================================================
// 城市表单：添加或编辑行程里的一个地点（住宿城市 / 中转 / 出发回家）
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入数据结构
import type { Stop, StopKind } from '../db/schema'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入面板组件
import { Field, INPUT, Segmented, Sheet } from './Sheet'
// 引入选位置组件
import { LocationPicker } from './LocationPicker'
// 引入图标
import { Icon } from './Icon'

// 地点类型选项
const KIND_OPTIONS: { value: StopKind; label: string }[] = [
  { value: 'stay', label: '住宿城市' },
  { value: 'transit', label: '只是路过' },
  { value: 'home', label: '出发 / 回家' },
  { value: 'saved', label: '以后去' },
]

// 表单保存时交出的数据（顺序和旅行 ID 由调用方决定）
export type StopDraft = Omit<Stop, 'tripId' | 'order'>

// 城市表单
export function StopForm({
  initial,
  near,
  defaultKind = 'stay',
  onSave,
  onClose,
}: {
  initial: Stop | null
  near: LngLat
  // 新建时默认的类型
  defaultKind?: StopKind
  onSave: (s: StopDraft) => void
  onClose: () => void
}) {
  // 坐标
  const [lngLat, setLngLat] = useState<LngLat | null>(initial ? [initial.lng, initial.lat] : null)
  // 当地原文名
  const [name, setName] = useState(initial?.name ?? '')
  // 中文名
  const [nameZh, setNameZh] = useState(initial?.nameZh ?? '')
  // 国家代码
  const [country, setCountry] = useState(initial?.country ?? '')
  // 类型
  const [kind, setKind] = useState<StopKind>(initial?.kind ?? defaultKind)
  // 住几晚
  const [nights, setNights] = useState(initial?.nights ?? 2)
  // 出错提示
  const [error, setError] = useState<string | null>(null)

  // 保存
  const submit = () => {
    // 必填：位置
    if (!lngLat) {
      setError('请搜索城市，或在地图上点选位置')
      return
    }
    // 必填：名字
    if (!name.trim()) {
      setError('请填写地名（当地原文）')
      return
    }
    // 交出数据
    onSave({
      // 编辑时沿用原 ID，新建时生成新 ID
      id: initial?.id ?? `stop-${crypto.randomUUID()}`,
      kind,
      name: name.trim(),
      // 中文名没填就用原文名
      nameZh: nameZh.trim() || name.trim(),
      country: country.trim().toUpperCase().slice(0, 2),
      lng: lngLat[0],
      lat: lngLat[1],
      // 只有住宿城市才有晚数（“以后去”的城市保留原来的晚数，方便以后加回行程）
      nights: kind === 'stay' || kind === 'saved' ? Math.max(1, nights) : 0,
    })
  }

  // 返回表单
  return (
    <Sheet
      title={initial ? `编辑 ${initial.name}` : '添加城市'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          <button onClick={submit} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper">
            保存
          </button>
        </div>
      }
    >
      {/* 位置 */}
      <Field label="位置 *" group>
        <LocationPicker
          value={lngLat}
          near={near}
          zoom={5}
          placeholder="搜索城市，例如 Hamburg"
          onChange={(loc) => {
            // 坐标
            setLngLat(loc.lngLat)
            // 搜索结果：填上名字和国家
            if (loc.name) setName(loc.name)
            if (loc.countryCode) setCountry(loc.countryCode)
            // 清掉错误
            setError(null)
          }}
        />
      </Field>
      {/* 当地原文名 */}
      <Field label="地名（当地原文）*">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 København" className={INPUT} />
      </Field>
      {/* 中文名 */}
      <Field label="中文名">
        <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder="例如 哥本哈根" className={INPUT} />
      </Field>
      {/* 国家代码 */}
      <Field label="国家代码" hint="两个字母，例如 DE（德国）、DK（丹麦）、NL（荷兰）">
        <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} autoCapitalize="characters" className={`${INPUT} w-24 uppercase`} />
      </Field>
      {/* 类型 */}
      <Field label="类型" group>
        <Segmented label="类型" value={kind} options={KIND_OPTIONS} onChange={setKind} />
      </Field>
      {/* 住几晚（住宿城市才有） */}
      {kind === 'stay' && (
        <Field label="住几晚" group>
          <Stepper value={nights} min={1} max={30} onChange={setNights} unit="晚" />
        </Field>
      )}
      {/* 出错 */}
      {error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent">{error}</p>}
    </Sheet>
  )
}

// 加减数字的小控件
export function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string }) {
  // 返回控件
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line-strong">
      {/* 减 */}
      <button type="button" aria-label="减少" disabled={value <= min} onClick={() => onChange(value - 1)} className="flex h-10 w-10 items-center justify-center disabled:opacity-30">
        <span className="text-[20px] leading-none">−</span>
      </button>
      {/* 数字 */}
      <span className="min-w-[3.5rem] text-center text-[15px] font-medium" aria-live="polite">
        {value} {unit}
      </span>
      {/* 加 */}
      <button type="button" aria-label="增加" disabled={value >= max} onClick={() => onChange(value + 1)} className="flex h-10 w-10 items-center justify-center disabled:opacity-30">
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
