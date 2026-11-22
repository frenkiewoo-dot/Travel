// ============================================================
// 酒店 / 景点卡片：平时显示摘要，点开显示详情和操作
// ============================================================

// 引入数据结构
import type { Place, PlaceStatus } from '../db/schema'
// 引入数据操作
import { deletePlace, updatePlace } from '../db/trip'
// 引入 Google Maps 链接
import { googleMapsDirections } from '../lib/gmaps'
// 引入图标
import { Icon, type IconName } from './Icon'
// 引入分段控件
import { Segmented } from './Sheet'
// 引入中文名
import { CATEGORY_LABEL, STATUS_LABEL } from './PlaceForm'

// 状态选项
const STATUS_OPTIONS = (['candidate', 'selected', 'booked'] as PlaceStatus[]).map((v) => ({ value: v, label: STATUS_LABEL[v] }))

// 状态小标签的颜色
export function statusClass(s: PlaceStatus): string {
  // 已预订：绿色；已选定：深色；候选：燕麦色
  return s === 'booked' ? 'bg-sage-soft text-sage' : s === 'selected' ? 'bg-ink text-paper' : 'bg-oat text-muted'
}

// 卡片组件
export function PlaceCard({
  place,
  expanded,
  onToggle,
  onEdit,
  onAddToDay,
  onShowOnMap,
}: {
  // 地点
  place: Place
  // 是否展开
  expanded: boolean
  // 点卡片：展开/收起
  onToggle: () => void
  // 编辑
  onEdit: () => void
  // 加入日程（酒店没有）
  onAddToDay?: () => void
  // 在城市地图上看
  onShowOnMap: () => void
}) {
  // 是否已选定或已预订（卡片描边加深）
  const chosen = place.status !== 'candidate'
  // 是不是酒店
  const isHotel = place.category === 'hotel'

  // 删除（先确认）
  const remove = async () => {
    // 确认
    if (!window.confirm(`删除「${place.name}」？`)) return
    // 删除
    await deletePlace(place.id)
  }

  // 返回卡片
  return (
    <article className={`rounded-2xl border bg-card ${chosen ? 'border-accent' : 'border-line'} ${place.hidden ? 'opacity-60' : ''}`}>
      {/* 摘要（点它展开/收起） */}
      <button onClick={onToggle} aria-expanded={expanded} className="flex w-full flex-col gap-2 p-4 text-left">
        {/* 第一行：名称 + 状态 */}
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0">
            {/* 名称 */}
            <h3 className="text-[16px] leading-snug font-semibold">{place.name}</h3>
            {/* 地址或中文名 */}
            <p className="mt-0.5 truncate text-[12px] text-muted">{[place.nameZh, place.address].filter(Boolean).join(' · ')}</p>
          </div>
          {/* 状态 */}
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${statusClass(place.status)}`}>{STATUS_LABEL[place.status]}</span>
        </div>
        {/* 第二行：标签 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 推荐 · 需核实（和自己添加的区分开） */}
          {place.source === 'recommended' && <span className="rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[11px] text-muted">推荐 · 需核实</span>}
          {/* 分类（景点页才显示） */}
          {!isHotel && <span className="rounded-md bg-oat px-2 py-0.5 text-[11px] text-muted">{CATEGORY_LABEL[place.category]}</span>}
          {/* 价格 */}
          {(place.priceNote || place.ticket) && <span className="text-[12px] text-ink">{place.priceNote ?? place.ticket}</span>}
          {/* 已隐藏 */}
          {place.hidden && <span className="text-[11px] text-muted">已隐藏</span>}
        </div>
        {/* 节日提醒（醒目） */}
        {place.holidayNote && (
          <p className="flex items-start gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] leading-snug text-accent">
            <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
            {place.holidayNote}
          </p>
        )}
      </button>

      {/* 展开后的详情 */}
      {expanded && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          {/* 详情行 */}
          <dl className="flex flex-col gap-1.5 text-[13px]">
            {place.address && <Row label="地址" value={place.address} />}
            {place.priceNote && <Row label={isHotel ? '每晚' : '价格'} value={place.priceNote} />}
            {place.ticket && <Row label="门票" value={place.ticket} />}
            {place.openingHours && <Row label="开放" value={place.openingHours} />}
            {place.duration && <Row label="建议" value={`游玩 ${place.duration}`} />}
            {place.note && <Row label="备注" value={place.note} />}
          </dl>

          {/* 状态切换 */}
          <div className="mt-3">
            <Segmented label="状态" value={place.status} options={STATUS_OPTIONS} onChange={(s) => updatePlace(place.id, { status: s, hidden: false })} />
          </div>

          {/* 操作按钮 */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {/* 地图 */}
            <Action icon="map" label="地图" onClick={onShowOnMap} />
            {/* 导航（Google Maps） */}
            <Action icon="navigate" label="导航" href={googleMapsDirections([place], true)} />
            {/* 加入日程（酒店没有） / 官网 */}
            {onAddToDay ? <Action icon="calendarPlus" label="加入日程" onClick={onAddToDay} /> : <Action icon="external" label="官网" href={place.url} />}
            {/* 编辑 */}
            <Action icon="edit" label="编辑" onClick={onEdit} />
          </div>

          {/* 底部链接行：官网（景点）、信息来源、删除 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            {/* 景点的官网 */}
            {onAddToDay && place.url && (
              <a href={place.url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                官网
              </a>
            )}
            {/* 信息来源 */}
            {place.sourceUrl && (
              <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2">
                信息来源
              </a>
            )}
            {/* 取消隐藏 */}
            {place.hidden && (
              <button onClick={() => updatePlace(place.id, { hidden: false })} className="text-muted underline underline-offset-2">
                取消隐藏
              </button>
            )}
            {/* 删除 */}
            <button onClick={remove} className="ml-auto flex items-center gap-1 text-muted">
              <Icon name="trash" size={14} />
              删除
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

// 详情的一行
function Row({ label, value }: { label: string; value: string }) {
  // 返回一行：左边标签，右边内容
  return (
    <div className="flex gap-3">
      <dt className="w-9 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  )
}

// 操作按钮（可以是按钮，也可以是外部链接）
function Action({ icon, label, onClick, href }: { icon: IconName; label: string; onClick?: () => void; href?: string }) {
  // 样式
  const cls = 'flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-line-strong text-[11px]'
  // 外部链接
  if (onClick === undefined) {
    // 没有链接：显示禁用状态
    if (!href) return <span className={`${cls} opacity-35`} aria-disabled="true"><Icon name={icon} size={17} />{label}</span>
    // 有链接
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        <Icon name={icon} size={17} />
        {label}
      </a>
    )
  }
  // 普通按钮
  return (
    <button onClick={onClick} className={cls}>
      <Icon name={icon} size={17} />
      {label}
    </button>
  )
}
