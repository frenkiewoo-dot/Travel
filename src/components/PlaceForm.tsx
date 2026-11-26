// ============================================================
// 酒店 / 景点的表单：自己添加，或编辑已有的
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入数据结构
import type { Place, PlaceCategory, PlaceStatus } from '../db/schema'
// 引入数据操作
import { addPlace, updatePlace } from '../db/trip'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入面板组件
import { Field, INPUT, Segmented, Sheet, TEXTAREA } from './Sheet'
// 引入选位置组件
import { LocationPicker } from './LocationPicker'

// 分类的中文名
export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  hotel: '住宿',
  attraction: '景点',
  market: '圣诞市场',
  food: '餐饮',
  shop: '购物',
  station: '车站',
  other: '其他',
}

// 状态的中文名
export const STATUS_LABEL: Record<PlaceStatus, string> = {
  candidate: '候选',
  selected: '已选定',
  booked: '已预订',
}

// 状态选项
const STATUS_OPTIONS = (['candidate', 'selected', 'booked'] as PlaceStatus[]).map((v) => ({ value: v, label: STATUS_LABEL[v] }))

// 景点页可选的分类（酒店单独一个标签）
const NON_HOTEL: PlaceCategory[] = ['attraction', 'market', 'food', 'shop', 'station', 'other']

// 表单组件
export function PlaceForm({
  tripId,
  stopId,
  cityCenter,
  initial,
  defaultCategory,
  defaultStatus = 'candidate',
  onClose,
}: {
  // 旅行 ID
  tripId: string
  // 城市 ID
  stopId: string
  // 城市中心（搜索优先附近、地图初始位置）
  cityCenter: LngLat
  // 要编辑的地点（新建时为 null）
  initial: Place | null
  // 新建时的默认分类
  defaultCategory: PlaceCategory
  // 新建时的默认状态（在“本次旅行”里添加住宿时默认“已预订”）
  defaultStatus?: PlaceStatus
  // 关闭
  onClose: () => void
}) {
  // 分类
  const [category, setCategory] = useState<PlaceCategory>(initial?.category ?? defaultCategory)
  // 名称
  const [name, setName] = useState(initial?.name ?? '')
  // 坐标
  const [lngLat, setLngLat] = useState<LngLat | null>(initial ? [initial.lng, initial.lat] : null)
  // 地址
  const [address, setAddress] = useState(initial?.address ?? '')
  // 链接
  const [url, setUrl] = useState(initial?.url ?? '')
  // 价格
  const [priceNote, setPriceNote] = useState(initial?.priceNote ?? '')
  // 门票
  const [ticket, setTicket] = useState(initial?.ticket ?? '')
  // 开放时间
  const [openingHours, setOpeningHours] = useState(initial?.openingHours ?? '')
  // 建议时长
  const [duration, setDuration] = useState(initial?.duration ?? '')
  // 节日提醒
  const [holidayNote, setHolidayNote] = useState(initial?.holidayNote ?? '')
  // 备注
  const [note, setNote] = useState(initial?.note ?? '')
  // 状态
  const [status, setStatus] = useState<PlaceStatus>(initial?.status ?? defaultStatus)
  // 出错提示
  const [error, setError] = useState<string | null>(null)
  // 正在保存
  const [saving, setSaving] = useState(false)

  // 是不是酒店
  const isHotel = category === 'hotel'

  // 保存
  const submit = async () => {
    // 必填检查：名称
    if (!name.trim()) {
      setError('请填写名称')
      return
    }
    // 必填检查：位置
    if (!lngLat) {
      setError('请搜索地址，或在地图上点一下选择位置')
      return
    }
    // 开始保存
    setSaving(true)
    // 要保存的字段（空字符串存成 undefined，不占地方）
    const fields = {
      category,
      name: name.trim(),
      address: address.trim() || undefined,
      lng: lngLat[0],
      lat: lngLat[1],
      url: normalizeUrl(url),
      priceNote: priceNote.trim() || undefined,
      ticket: isHotel ? undefined : ticket.trim() || undefined,
      openingHours: isHotel ? undefined : openingHours.trim() || undefined,
      duration: isHotel ? undefined : duration.trim() || undefined,
      holidayNote: holidayNote.trim() || undefined,
      note: note.trim() || undefined,
      status,
    }
    // 编辑：更新
    if (initial) await updatePlace(initial.id, fields)
    // 新建：来源是“我自己添加”
    else await addPlace({ ...fields, tripId, stopId, source: 'user' })
    // 关闭表单
    onClose()
  }

  // 返回表单
  return (
    <Sheet
      // 标题
      title={initial ? `编辑${CATEGORY_LABEL[initial.category]}` : isHotel ? '添加住宿' : '添加地点'}
      // 关闭
      onClose={onClose}
      // 底部按钮
      footer={
        <div className="flex gap-2">
          {/* 取消 */}
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          {/* 保存 */}
          <button onClick={submit} disabled={saving} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-50">
            保存
          </button>
        </div>
      }
    >
      {/* 分类（景点页才能选；酒店固定为住宿） */}
      {!isHotel && (
        <Field label="分类" group>
          <div className="flex flex-wrap gap-1.5">
            {NON_HOTEL.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`h-9 rounded-full px-3.5 text-[13px] ${category === c ? 'bg-ink text-paper' : 'bg-oat text-ink'}`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* 名称 */}
      <Field label="名称 *">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isHotel ? '例如 Generator Berlin Mitte' : '例如 Berliner Dom'} className={INPUT} />
      </Field>

      {/* 位置 */}
      <Field label="位置 *" group>
        <LocationPicker
          value={lngLat}
          near={cityCenter}
          localKm={30}
          onChange={(loc) => {
            // 更新坐标
            setLngLat(loc.lngLat)
            // 有地址就填上
            if (loc.address) setAddress(loc.address)
            // 名称还空着，用搜索结果的名字
            if (loc.name && !name.trim()) setName(loc.name)
            // 清掉错误
            setError(null)
          }}
        />
      </Field>

      {/* 地址 */}
      <Field label="地址">
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="选好位置后会自动填写" className={INPUT} />
      </Field>

      {/* 链接 */}
      <Field label={isHotel ? '官网 / 预订链接' : '官网链接'}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" placeholder="https://…" className={INPUT} />
      </Field>

      {/* 价格 */}
      <Field label={isHotel ? '大概每晚价格' : '价格'} hint="不确定的话写“约”或“需核实”">
        <input value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder={isHotel ? '例如 约 €30/晚（多人间）' : '例如 约 €10'} className={INPUT} />
      </Field>

      {/* 景点才有的字段 */}
      {!isHotel && (
        <>
          {/* 门票 */}
          <Field label="门票">
            <input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="例如 €10，学生 €7；免费" className={INPUT} />
          </Field>
          {/* 开放时间 */}
          <Field label="开放时间">
            <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="例如 10:00–18:00，周一闭馆" className={INPUT} />
          </Field>
          {/* 建议时长 */}
          <Field label="建议游玩时长">
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="例如 1.5 小时" className={INPUT} />
          </Field>
        </>
      )}

      {/* 节日提醒 */}
      <Field label="节日提醒" hint="例如平安夜、圣诞节当天的营业变化">
        <input value={holidayNote} onChange={(e) => setHolidayNote(e.target.value)} placeholder="例如 12/24 14:00 后关门" className={INPUT} />
      </Field>

      {/* 备注 */}
      <Field label="备注">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={TEXTAREA} />
      </Field>

      {/* 状态 */}
      <Field label="状态" group>
        <Segmented label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Field>

      {/* 出错提示 */}
      {error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent">{error}</p>}
    </Sheet>
  )
}

// 链接没写 https:// 的自动补上；空的返回 undefined
function normalizeUrl(u: string): string | undefined {
  // 去掉空格
  const t = u.trim()
  // 空的
  if (!t) return undefined
  // 已经有协议
  if (/^https?:\/\//i.test(t)) return t
  // 补上 https://
  return `https://${t}`
}
