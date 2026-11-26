// ============================================================
// 看大图：黑底全屏，左右滑动（电脑上用 ← → 键）切换，点图片放大
//   - 顶部：左边返回，中间第几张，右边设为封面、× 删除这张
//   - 底部：在哪拍的、什么时候、一句话说明（可以改）、换个景点
// ============================================================

// 引入 React 钩子
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
// 引入数据结构
import type { Photo, Place, Stop } from '../db/schema'
// 引入相册数据操作
import { deletePhotos, movePhotos, setCaption, setCover } from '../db/photos'
// 引入临时网址工具
import { useObjectUrl } from '../db/tickets'
// 引入日期工具
import { chineseDate, type Chapter } from '../lib/albumLayout'
// 引入组件
import { Icon } from './Icon'
import { PlacePickSheet } from './Album'

// 看大图组件
export function PhotoViewer({
  photos,
  index,
  stop,
  places,
  chapterOf,
  onIndex,
  onClose,
  onToast,
}: {
  // 全部照片（相册顺序）
  photos: Photo[]
  // 当前第几张
  index: number
  // 城市
  stop: Stop
  // 城市的地点
  places: Place[]
  // 照片属于哪一章
  chapterOf: (p: Photo) => Chapter | undefined
  // 切换到第几张
  onIndex: (i: number) => void
  // 关闭
  onClose: () => void
  // 提示
  onToast: (t: string) => void
}) {
  // 当前照片
  const photo = photos[index]
  // 大图网址
  const url = useObjectUrl(photo?.blob)
  // 手指拖动的距离（左右滑动时图片跟着动）
  const [dx, setDx] = useState(0)
  // 是否放大
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  // 是否在改说明
  const [editing, setEditing] = useState(false)
  // 是否在选景点
  const [moving, setMoving] = useState(false)
  // 拖动开始的位置
  const start = useRef<{ x: number; y: number } | null>(null)

  // 上一张 / 下一张
  const go = (d: number) => {
    // 新位置
    const n = index + d
    // 超出范围不动
    if (n < 0 || n >= photos.length) return
    // 切换并取消放大
    setZoom(null)
    onIndex(n)
  }

  // 键盘：← → 切换，Esc 关闭
  useEffect(() => {
    // 按键处理
    const onKey = (e: KeyboardEvent) => {
      // 正在打字时不处理
      if (editing) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'Escape') onClose()
    }
    // 监听
    window.addEventListener('keydown', onKey)
    // 取消监听
    return () => window.removeEventListener('keydown', onKey)
  })

  // 照片被删光了
  if (!photo) return null

  // 手指按下
  const onDown = (e: ReactPointerEvent) => {
    // 放大时不切换
    if (zoom) return
    start.current = { x: e.clientX, y: e.clientY }
  }
  // 手指移动
  const onMove = (e: ReactPointerEvent) => {
    // 没按下
    if (!start.current) return
    // 图片跟着手指横向移动
    setDx(e.clientX - start.current.x)
  }
  // 手指抬起
  const onUp = (e: ReactPointerEvent) => {
    // 没按下（例如放大状态）
    if (!start.current) {
      // 放大状态下点一下恢复
      if (zoom) setZoom(null)
      return
    }
    // 移动距离
    const mx = e.clientX - start.current.x
    const my = e.clientY - start.current.y
    // 清空
    start.current = null
    setDx(0)
    // 横向滑动超过 60 像素：切换
    if (Math.abs(mx) > 60 && Math.abs(mx) > Math.abs(my)) go(mx < 0 ? 1 : -1)
    // 几乎没动：当作点一下 → 在点的位置放大
    else if (Math.abs(mx) < 6 && Math.abs(my) < 6) {
      // 图片区域
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      // 点的位置（百分比）
      setZoom({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
    }
  }

  // 所在章节
  const ch = chapterOf(photo)
  // 地点名
  const where = ch?.place ? `${ch.place.name}${ch.place.nameZh ? ` · ${ch.place.nameZh}` : ''}` : `城市漫步 · ${stop.nameZh}`

  // 删除这张
  const remove = async () => {
    // 确认
    if (!window.confirm('删除这张照片？删除后找不回来（手机相册里的原图不受影响）。')) return
    // 删除后显示下一张（最后一张就显示上一张）
    const next = index >= photos.length - 1 ? index - 1 : index
    await deletePhotos([photo.id])
    onToast('已删除')
    // 删光了就关闭
    if (photos.length <= 1) onClose()
    else onIndex(Math.max(0, next))
  }

  // 返回
  return (
    <div role="dialog" aria-modal="true" aria-label="看照片" className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* 顶部：左边返回；右边设为封面、× 删除这张照片 */}
      <div className="flex shrink-0 items-center justify-between px-3 pt-[max(env(safe-area-inset-top),10px)] pb-2">
        <button aria-label="返回相册" onClick={onClose} className="flex h-11 items-center gap-0.5 rounded-full bg-white/10 pr-3.5 pl-2 text-[13px]">
          <Icon name="back" size={20} />
          相册
        </button>
        <span className="text-[13px] tabular-nums opacity-80">
          {index + 1} / {photos.length}
        </span>
        <div className="flex gap-2">
          <button
            aria-label="设为封面"
            onClick={async () => {
              await setCover(stop.id, photo.id)
              onToast('已设为相册封面')
            }}
            className={`flex h-11 items-center gap-1 rounded-full px-3 text-[12px] ${stop.coverPhotoId === photo.id ? 'bg-white text-black' : 'bg-white/10'}`}
          >
            <Icon name="sparkle" size={15} />
            {stop.coverPhotoId === photo.id ? '封面' : '设为封面'}
          </button>
          <button aria-label="删除这张照片" onClick={remove} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>

      {/* 图片区：左右滑动切换，点一下放大，再点恢复 */}
      <div
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
      >
        {url && (
          <img
            src={url}
            alt={photo.caption ?? where}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-200"
            style={{
              transform: zoom ? 'scale(2.2)' : `translateX(${dx}px)`,
              transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : 'center',
              transitionDuration: dx ? '0ms' : undefined,
            }}
          />
        )}
        {/* 电脑上的左右箭头 */}
        {index > 0 && (
          <button aria-label="上一张" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => go(-1)} className="absolute top-1/2 left-2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 sm:flex">
            <Icon name="back" size={20} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button aria-label="下一张" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => go(1)} className="absolute top-1/2 right-2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 sm:flex">
            <Icon name="chevronRight" size={20} />
          </button>
        )}
      </div>

      {/* 底部：地点、时间、说明 */}
      <div className="shrink-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-serif text-[22px] leading-tight">{where}</div>
            <div className="text-[12px] opacity-70">
              {chineseDate(photo.takenAt.slice(0, 10))} {photo.takenAt.slice(11, 16)}
            </div>
          </div>
          <button onClick={() => setMoving(true)} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 text-[12px]">
            <Icon name="pin" size={14} />
            换个景点
          </button>
        </div>
        {/* 说明：点了可以改 */}
        {editing ? (
          <CaptionEditor
            initial={photo.caption ?? ''}
            onDone={async (t) => {
              await setCaption(photo.id, t)
              setEditing(false)
            }}
          />
        ) : (
          <button onClick={() => setEditing(true)} className={`mt-2 block w-full text-left text-[14px] leading-relaxed ${photo.caption ? '' : 'opacity-60'}`}>
            {photo.caption ?? '＋ 写一句说明'}
          </button>
        )}
      </div>

      {/* 换景点 */}
      {moving && (
        <PlacePickSheet
          title="这张照片是在哪里拍的？"
          places={places}
          current={photo.placeId}
          onClose={() => setMoving(false)}
          onPick={async (placeId) => {
            await movePhotos([photo.id], placeId)
            setMoving(false)
            onToast(`已归到「${places.find((p) => p.id === placeId)?.name ?? '城市漫步'}」`)
          }}
        />
      )}
    </div>
  )
}

// 改说明的输入框
function CaptionEditor({ initial, onDone }: { initial: string; onDone: (t: string) => void }) {
  // 输入的文字
  const [text, setText] = useState(initial)
  // 返回
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        maxLength={80}
        placeholder="例如：Tivoli 的旋转木马"
        onKeyDown={(e) => e.key === 'Enter' && onDone(text)}
        className="h-10 min-w-0 flex-1 rounded-xl border border-white/30 bg-white/10 px-3 text-[14px] text-white outline-none placeholder:text-white/50"
      />
      <button onClick={() => onDone(text)} className="h-10 shrink-0 rounded-xl bg-white px-4 text-[14px] text-black">
        保存
      </button>
    </div>
  )
}
