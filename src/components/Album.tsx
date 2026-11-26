// ============================================================
// 城市相册（城市详情的「相册」标签）
//   - 封面：一张大图 + 城市名（像杂志封面）
//   - 章节：一个景点一章（没归到景点的按日期放进「城市漫步」），每章有罗马数字编号、日期、可以写一句话
//   - 每章自动选不同的拼图版式（见 lib/albumLayout.ts），不是死板的方格
//   - 点照片看大图（左右滑动切换）；「整理」可以多选照片换景点、设封面、删除
// ============================================================

// 引入 React 钩子
import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
// 引入数据结构
import type { Photo, Place, Stop } from '../db/schema'
// 引入相册数据操作
import { deletePhotos, movePhotos, setAlbumNote, setCover, usePhotos } from '../db/photos'
// 引入临时网址工具
import { useObjectUrl } from '../db/tickets'
// 引入排版工具
import { buildChapters, chineseDate, clampAspect, frenchDate, isPortrait, layoutChapter, roman, splitColumns, type Block, type Chapter } from '../lib/albumLayout'
// 引入组件
import { Icon } from './Icon'
// 引入横向拖动滑动
import { useDragScroll } from '../lib/useDragScroll'
import { Sheet, TEXTAREA } from './Sheet'
import { PhotoViewer } from './PhotoViewer'
import { PhotoUpload } from './PhotoUpload'

// ---------- 一张照片 ----------

// 显示一张照片（默认用小图；full = 用大图）
export function PhotoImg({ photo, full, className = '', style }: { photo: Photo; full?: boolean; className?: string; style?: CSSProperties }) {
  // 临时网址（组件卸载时自动释放）
  const url = useObjectUrl(full ? photo.blob : photo.thumb)
  // 图片（加载前显示燕麦色底）
  return url ? <img src={url} alt={photo.caption ?? ''} draggable={false} className={className} style={style} /> : <div className={`bg-oat ${className}`} style={style} />
}

// 拼图里的一格：裁切填满，点开看大图
function Tile({ photo, onOpen, className = '', style }: { photo: Photo; onOpen: (p: Photo) => void; className?: string; style?: CSSProperties }) {
  // 返回
  return (
    <button onClick={() => onOpen(photo)} aria-label={photo.caption ? `查看照片：${photo.caption}` : '查看照片'} className={`relative block overflow-hidden rounded-[4px] bg-oat ${className}`} style={style}>
      <PhotoImg photo={photo} className="absolute inset-0 h-full w-full object-cover" />
    </button>
  )
}

// ---------- 相册 ----------

// 相册组件
export function Album({ stop, tripId, places, onToast }: { stop: Stop; tripId: string; places: Place[]; onToast: (t: string) => void }) {
  // 这个城市的照片（按时间）
  const photos = usePhotos(stop.id)
  // 正在看的照片（在全部照片里的位置）
  const [viewing, setViewing] = useState<number | null>(null)
  // 是否显示上传面板
  const [uploading, setUploading] = useState(false)
  // 是否在整理模式
  const [organizing, setOrganizing] = useState(false)
  // 正在写哪一章的一句话
  const [noteFor, setNoteFor] = useState<Chapter | null>(null)

  // 分章节
  const chapters = useMemo(() => buildChapters(photos ?? [], places), [photos, places])
  // 相册顺序的全部照片（看大图时左右滑动用这个顺序）
  const ordered = useMemo(() => chapters.flatMap((c) => c.photos), [chapters])

  // 加载中
  if (!photos) return null

  // 还没有照片
  if (photos.length === 0)
    return (
      <>
        <EmptyAlbum stop={stop} onUpload={() => setUploading(true)} />
        {uploading && <PhotoUpload tripId={tripId} stop={stop} places={places} onClose={() => setUploading(false)} onDone={onToast} />}
      </>
    )

  // 封面：设过的那张；没设就挑景点章节里的第一张竖图（竖图做封面最好看），再不行用第一张
  const cover =
    photos.find((p) => p.id === stop.coverPhotoId) ??
    chapters.filter((c) => c.kind === 'place').flatMap((c) => c.photos).find(isPortrait) ??
    ordered[0]
  // 拍摄日期范围
  const firstDate = photos[0].takenAt.slice(0, 10)
  const lastDate = photos[photos.length - 1].takenAt.slice(0, 10)
  // 去过几个景点
  const placeCount = chapters.filter((c) => c.kind === 'place').length
  // 打开某张照片
  const open = (p: Photo) => setViewing(ordered.findIndex((x) => x.id === p.id))

  // 返回相册
  return (
    <div>
      {/* ===== 封面 ===== */}
      <button onClick={() => open(cover)} aria-label="查看封面照片" className="relative block w-full overflow-hidden rounded-[20px] bg-oat text-left" style={{ aspectRatio: '4 / 5', maxHeight: '70vh' }}>
        <PhotoImg photo={cover} full className="absolute inset-0 h-full w-full object-cover" />
        {/* 底部渐暗，让文字看得清 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
        {/* 文字 */}
        <div className="absolute inset-x-5 bottom-5 text-white">
          <div className="font-serif text-[18px] italic opacity-85">Souvenirs de</div>
          <div className="font-serif text-[52px] leading-[0.95] font-medium">{stop.name}</div>
          <div className="mt-2 text-[13px] opacity-85">
            {firstDate === lastDate ? chineseDate(firstDate) : `${chineseDate(firstDate)} — ${chineseDate(lastDate)}`} · {photos.length} 张 · {placeCount} 个地方
          </div>
        </div>
      </button>

      {/* ===== 工具栏 ===== */}
      <div className="mt-3 flex gap-2">
        <button onClick={() => setUploading(true)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink text-[14px] text-paper">
          <Icon name="plus" size={16} />
          上传照片
        </button>
        <button onClick={() => setOrganizing(true)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[14px]">
          <Icon name="list" size={16} />
          整理
        </button>
      </div>

      {/* ===== 章节 ===== */}
      {chapters.map((ch, i) => (
        <ChapterView key={ch.key} chapter={ch} index={i} note={stop.albumNotes?.[ch.key]} onOpen={open} onEditNote={() => setNoteFor(ch)} />
      ))}

      {/* ===== 结尾 ===== */}
      <div className="mt-14 mb-4 text-center">
        <div className="font-serif text-[22px] italic text-muted">— Fin —</div>
        <div className="mt-1 text-[12px] text-muted">
          {stop.nameZh} · {photos.length} 张照片
        </div>
      </div>

      {/* 看大图 */}
      {viewing !== null && ordered[viewing] && (
        <PhotoViewer
          photos={ordered}
          index={viewing}
          stop={stop}
          places={places}
          chapterOf={(p) => chapters.find((c) => c.photos.includes(p))}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onToast={onToast}
        />
      )}
      {/* 上传 */}
      {uploading && <PhotoUpload tripId={tripId} stop={stop} places={places} onClose={() => setUploading(false)} onDone={onToast} />}
      {/* 整理 */}
      {organizing && <Organize stop={stop} chapters={chapters} places={places} onClose={() => setOrganizing(false)} onToast={onToast} />}
      {/* 写一句话 */}
      {noteFor && <NoteSheet stop={stop} chapter={noteFor} onClose={() => setNoteFor(null)} />}
    </div>
  )
}

// ---------- 空相册 ----------

function EmptyAlbum({ stop, onUpload }: { stop: Stop; onUpload: () => void }) {
  // 返回
  return (
    <div className="rounded-[20px] border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="font-serif text-[18px] italic text-muted">Souvenirs de</div>
      <div className="font-serif text-[40px] leading-none font-medium">{stop.name}</div>
      <p className="mx-auto mt-4 max-w-[280px] text-[13px] leading-relaxed text-muted">
        到了{stop.nameZh}，把拍的照片放进来。带位置信息的照片会自动归到拍摄地附近的景点，其余按日期放进「城市漫步」，自动排成杂志一样的相册。
      </p>
      <button onClick={onUpload} className="mx-auto mt-5 flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] text-paper">
        <Icon name="plus" size={16} />
        上传照片
      </button>
      <p className="mt-3 text-[11px] text-muted">照片只存在这台设备里，不会上传到任何地方</p>
    </div>
  )
}

// ---------- 一章 ----------

function ChapterView({ chapter: ch, index, note, onOpen, onEditNote }: { chapter: Chapter; index: number; note?: string; onOpen: (p: Photo) => void; onEditNote: () => void }) {
  // 这一章的版式
  const blocks = layoutChapter(ch, index)
  // 标题：景点用当地名字，城市漫步用法语 Promenade（散步）
  const title = ch.place ? ch.place.name : 'Promenade'
  // 副标题
  const sub = ch.place ? [ch.place.nameZh, chineseDate(ch.date)].filter(Boolean).join(' · ') : `城市漫步 · ${chineseDate(ch.date)}`
  // 返回
  return (
    <section className="mt-12" aria-label={title}>
      {/* 编号 —— 线 —— 日期 */}
      <div className="flex items-center gap-3">
        <span className="font-serif text-[17px] italic text-muted">{roman(index + 1)}</span>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] tracking-[0.18em] text-muted uppercase">{frenchDate(ch.date)}</span>
      </div>
      {/* 标题 */}
      <h3 className="mt-2 font-serif text-[32px] leading-[1.05] font-medium">{title}</h3>
      <p className="mt-1 text-[12px] text-muted">
        {sub} · {ch.photos.length} 张
      </p>
      {/* 写的一句话（像杂志的引言） */}
      {note ? (
        <button onClick={onEditNote} className="mt-3 block w-full border-l-2 border-accent pl-3 text-left font-serif text-[19px] leading-snug italic">
          “{note}”
        </button>
      ) : (
        <button onClick={onEditNote} className="mt-1.5 flex h-8 items-center gap-1 text-[12px] text-muted">
          <Icon name="edit" size={13} />
          写一句话
        </button>
      )}
      {/* 拼图 */}
      <div className="mt-4 flex flex-col gap-1">
        {blocks.map((b, i) => (
          <BlockView key={i} block={b} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

// ---------- 各种版式 ----------

function BlockView({ block: b, onOpen }: { block: Block; onOpen: (p: Photo) => void }) {
  // 按版式分别画
  switch (b.t) {
    // 单张大图：保留原比例（太细长的裁一点）
    case 'hero':
      return <Tile photo={b.p[0]} onOpen={onOpen} className="w-full" style={{ aspectRatio: clampAspect(b.p[0], 0.8, 1.78) }} />
    // 两张竖图并排，右边往下错开
    case 'duo':
      return (
        <div className="grid grid-cols-2 items-start gap-1">
          <Tile photo={b.p[0]} onOpen={onOpen} style={{ aspectRatio: '4 / 5' }} />
          <Tile photo={b.p[1]} onOpen={onOpen} className="mt-12" style={{ aspectRatio: '4 / 5' }} />
        </div>
      )
    // 一张横图 + 一张叠在右下角的小图
    case 'stack':
      return (
        <div className="pb-1">
          <Tile photo={b.p[0]} onOpen={onOpen} className="w-full" style={{ aspectRatio: clampAspect(b.p[0], 1.2, 1.78) }} />
          <div className="relative z-10 -mt-16 ml-auto w-[60%] rounded-[6px] border-[5px] border-paper shadow-[0_10px_28px_var(--shadow)]">
            <Tile photo={b.p[1]} onOpen={onOpen} className="w-full" style={{ aspectRatio: clampAspect(b.p[1], 0.75, 1.33) }} />
          </div>
        </div>
      )
    // 一大两小（mirror = 大图在右边）
    case 'trio':
      return (
        <div className={`grid gap-1 ${b.mirror ? 'grid-cols-[2fr_3fr]' : 'grid-cols-[3fr_2fr]'}`} style={{ aspectRatio: '10 / 11' }}>
          <Tile photo={b.p[0]} onOpen={onOpen} className={`row-span-2 h-full ${b.mirror ? 'order-2' : ''}`} />
          <div className={`grid grid-rows-2 gap-1 ${b.mirror ? 'order-1' : ''}`}>
            <Tile photo={b.p[1]} onOpen={onOpen} className="h-full" />
            <Tile photo={b.p[2]} onOpen={onOpen} className="h-full" />
          </div>
        </div>
      )
    // 宽图在上，下面两张并排
    case 'wideTrio':
      return (
        <div className="flex flex-col gap-1">
          <Tile photo={b.p[0]} onOpen={onOpen} className="w-full" style={{ aspectRatio: '16 / 10' }} />
          <div className="grid grid-cols-2 gap-1">
            <Tile photo={b.p[1]} onOpen={onOpen} style={{ aspectRatio: '1 / 1' }} />
            <Tile photo={b.p[2]} onOpen={onOpen} style={{ aspectRatio: '1 / 1' }} />
          </div>
        </div>
      )
    // 四张错落：上排左宽右窄，下排左窄右宽
    case 'quad':
      return (
        <div className="grid grid-cols-5 grid-rows-2 gap-1" style={{ aspectRatio: '1 / 1.08' }}>
          <Tile photo={b.p[0]} onOpen={onOpen} className="col-span-3 h-full" />
          <Tile photo={b.p[1]} onOpen={onOpen} className="col-span-2 h-full" />
          <Tile photo={b.p[2]} onOpen={onOpen} className="col-span-2 h-full" />
          <Tile photo={b.p[3]} onOpen={onOpen} className="col-span-3 h-full" />
        </div>
      )
    // 横滑轮播
    case 'carousel':
      return <Carousel photos={b.p} onOpen={onOpen} />
    // 拍立得
    case 'polaroid':
      return <Polaroids photos={b.p} onOpen={onOpen} />
    // 瀑布流
    case 'masonry':
      return <Masonry photos={b.p} onOpen={onOpen} />
  }
}

// 横滑轮播（像 Instagram 的多图帖子：右上角显示第几张，下面有小圆点）
function Carousel({ photos, onOpen }: { photos: Photo[]; onOpen: (p: Photo) => void }) {
  // 当前第几张
  const [cur, setCur] = useState(0)
  // 滚动容器
  const ref = useRef<HTMLDivElement | null>(null)
  // 电脑上可以用鼠标拖动
  const drag = useDragScroll<HTMLDivElement>()
  // 同时记住元素、接上拖动（保持不变，避免滑动时重新渲染打断拖动）
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el
      drag(el)
    },
    [drag],
  )
  // 滚动时算出当前第几张
  const onScroll = () => {
    // 容器
    const el = ref.current
    // 第一张的宽度（含间距）
    const item = el?.firstElementChild as HTMLElement | null
    if (!el || !item) return
    // 当前位置 ÷ 每张宽度
    setCur(Math.min(photos.length - 1, Math.round(el.scrollLeft / (item.offsetWidth + 8))))
  }
  // 返回
  return (
    <div className="relative">
      {/* 横向滚动，左右延伸到屏幕边缘 */}
      <div
        ref={setRef}
        onScroll={onScroll}
        className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-5 px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p) => (
          <Tile key={p.id} photo={p} onOpen={onOpen} className="w-[84%] shrink-0 snap-start" style={{ aspectRatio: '4 / 5' }} />
        ))}
        {/* 末尾留白，最后一张也能滑到左边对齐 */}
        <div className="w-[8%] shrink-0" aria-hidden="true" />
      </div>
      {/* 右上角：第几张 */}
      <div className="pointer-events-none absolute top-3 right-[calc(16%+12px)] rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white tabular-nums">
        {cur + 1} / {photos.length}
      </div>
      {/* 小圆点 */}
      <div className="mt-2.5 flex justify-center gap-1" aria-hidden="true">
        {photos.slice(0, 12).map((p, i) => (
          <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${i === cur ? 'bg-ink' : 'bg-line-strong'}`} />
        ))}
      </div>
    </div>
  )
}

// 拍立得：白边相纸、微微倾斜、互相叠一点，下面手写一样的时间或说明
function Polaroids({ photos, onOpen }: { photos: Photo[]; onOpen: (p: Photo) => void }) {
  // 每张的位置：宽度、倾斜角度、对齐、往上叠多少
  const LAYOUT: { w: string; rot: number; align: string; overlap: string }[][] = [
    [{ w: '74%', rot: -2, align: 'self-center', overlap: '' }],
    [
      { w: '58%', rot: -3, align: 'self-start', overlap: '' },
      { w: '58%', rot: 2.5, align: 'self-end', overlap: '-mt-24' },
    ],
    [
      { w: '52%', rot: -3, align: 'self-start', overlap: '' },
      { w: '52%', rot: 3, align: 'self-end', overlap: '-mt-16' },
      { w: '52%', rot: -1.5, align: 'self-center', overlap: 'mt-1' },
    ],
  ]
  // 这几张用哪一组位置
  const pos = LAYOUT[Math.min(photos.length, 3) - 1]
  // 返回
  return (
    <div className="flex flex-col py-3">
      {photos.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onOpen(p)}
          aria-label="查看照片"
          className={`relative block bg-[#FBF8F2] p-2 pb-9 shadow-[0_10px_26px_var(--shadow)] ${pos[i].align} ${pos[i].overlap}`}
          style={{ width: pos[i].w, transform: `rotate(${pos[i].rot}deg)`, zIndex: i + 1 }}
        >
          <PhotoImg photo={p} className="aspect-square w-full object-cover" />
          {/* 相纸下方：说明或时间 */}
          <span className="absolute inset-x-2 bottom-2 truncate text-center font-serif text-[14px] text-[#5A4E44] italic">{p.caption ?? p.takenAt.slice(11, 16)}</span>
        </button>
      ))}
    </div>
  )
}

// 瀑布流：两列错落（右列往下错开），保留每张照片的大致比例
function Masonry({ photos, onOpen }: { photos: Photo[]; onOpen: (p: Photo) => void }) {
  // 分成两列
  const [a, b] = splitColumns(photos)
  // 一列
  const col = (list: Photo[]) =>
    list.map((p) => <Tile key={p.id} photo={p} onOpen={onOpen} className="w-full" style={{ aspectRatio: clampAspect(p, 0.7, 1.5) }} />)
  // 返回
  return (
    <div className="grid grid-cols-2 items-start gap-1">
      <div className="flex flex-col gap-1">{col(a)}</div>
      <div className="flex flex-col gap-1 pt-10">{col(b)}</div>
    </div>
  )
}

// ---------- 写一句话 ----------

function NoteSheet({ stop, chapter, onClose }: { stop: Stop; chapter: Chapter; onClose: () => void }) {
  // 输入的文字
  const [text, setText] = useState(stop.albumNotes?.[chapter.key] ?? '')
  // 保存
  const save = async () => {
    await setAlbumNote(stop.id, chapter.key, text)
    onClose()
  }
  // 返回
  return (
    <Sheet
      title={`写一句话 · ${chapter.place?.name ?? '城市漫步'}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          <button onClick={save} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper">
            保存
          </button>
        </div>
      }
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus maxLength={120} placeholder="例如：傍晚的新港，彩色房子倒映在水里" className={TEXTAREA} />
      <p className="mt-2 text-[12px] text-muted">会像杂志引言一样显示在这一章标题下面。清空就删除。</p>
    </Sheet>
  )
}

// ---------- 选景点（整理和看大图都用） ----------

export function PlacePickSheet({ title, places, current, onPick, onClose }: { title: string; places: Place[]; current?: string | null; onPick: (placeId: string | undefined) => void; onClose: () => void }) {
  // 可选的地点（车站不算）
  const options = places.filter((p) => p.category !== 'station')
  // 一行
  const row = (key: string, label: ReactNode, sub: string | undefined, id: string | undefined) => (
    <li key={key}>
      <button onClick={() => onPick(id)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px]">{label}</span>
          {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
        </span>
        {current !== null && current === id && <Icon name="pin" size={15} className="shrink-0 text-accent" />}
      </button>
    </li>
  )
  // 返回
  return (
    <Sheet title={title} onClose={onClose}>
      <ul>
        {row('walk', '城市漫步', '不属于某个景点，按日期分章', undefined)}
        {options.map((p) => row(p.id, p.name, p.nameZh, p.id))}
      </ul>
      <p className="mt-3 text-[12px] text-muted">列表里没有的地方，可以先在「景点」标签里「自己添加」。</p>
    </Sheet>
  )
}

// ---------- 整理模式 ----------

function Organize({ stop, chapters, places, onClose, onToast }: { stop: Stop; chapters: Chapter[]; places: Place[]; onClose: () => void; onToast: (t: string) => void }) {
  // 选中的照片 ID
  const [sel, setSel] = useState<Set<string>>(new Set())
  // 是否显示“归到哪里”
  const [moving, setMoving] = useState(false)
  // 选 / 取消选一张
  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  // 整章全选 / 取消
  const toggleChapter = (ch: Chapter) =>
    setSel((prev) => {
      const next = new Set(prev)
      const all = ch.photos.every((p) => next.has(p.id))
      for (const p of ch.photos) {
        if (all) next.delete(p.id)
        else next.add(p.id)
      }
      return next
    })
  // 选中的列表
  const ids = [...sel]
  // 删除
  const remove = async () => {
    if (!window.confirm(`删除选中的 ${ids.length} 张照片？删除后找不回来（手机相册里的原图不受影响）。`)) return
    await deletePhotos(ids)
    onToast(`已删除 ${ids.length} 张`)
    setSel(new Set())
  }
  // 设为封面
  const cover = async () => {
    await setCover(stop.id, ids[0])
    onToast('已设为封面')
    setSel(new Set())
  }
  // 返回
  return (
    <div role="dialog" aria-modal="true" aria-label="整理照片" className="fixed inset-0 z-40 flex flex-col bg-paper">
      {/* 顶部 */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <div>
          <h2 className="text-[17px] font-semibold">整理照片</h2>
          <p className="text-[12px] text-muted">点照片选中，可以换景点、设封面、删除</p>
        </div>
        <button onClick={onClose} className="h-10 rounded-full bg-ink px-4 text-[14px] text-paper">
          完成
        </button>
      </div>
      {/* 按章节列出（这里用整齐的小方格，方便选） */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-28">
        {chapters.map((ch) => (
          <section key={ch.key} className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="truncate text-[14px] font-semibold">
                {ch.place ? ch.place.name : '城市漫步'} <span className="font-normal text-muted">· {chineseDate(ch.date)}</span>
              </h3>
              <button onClick={() => toggleChapter(ch)} className="h-8 shrink-0 text-[12px] text-muted underline underline-offset-2">
                {ch.photos.every((p) => sel.has(p.id)) ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {ch.photos.map((p) => (
                <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={sel.has(p.id)} aria-label="选择照片" className="relative aspect-square overflow-hidden rounded-[4px] bg-oat">
                  <PhotoImg photo={p} className={`h-full w-full object-cover ${sel.has(p.id) ? 'opacity-70' : ''}`} />
                  {/* 选中标记 */}
                  <span className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[11px] text-white ${sel.has(p.id) ? 'bg-accent' : 'bg-black/25'}`}>{sel.has(p.id) ? '✓' : ''}</span>
                  {/* 封面标记 */}
                  {stop.coverPhotoId === p.id && <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] text-white">封面</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {/* 底部操作栏 */}
      <div className="absolute inset-x-0 bottom-0 border-t border-line bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="mb-2 text-[12px] text-muted">{ids.length > 0 ? `已选 ${ids.length} 张` : '还没选照片'}</div>
        <div className="grid grid-cols-3 gap-2">
          <button disabled={!ids.length} onClick={() => setMoving(true)} className="h-11 rounded-xl bg-ink text-[14px] text-paper disabled:opacity-40">
            归到…
          </button>
          <button disabled={ids.length !== 1} onClick={cover} className="h-11 rounded-xl border border-line-strong text-[14px] disabled:opacity-40">
            设为封面
          </button>
          <button disabled={!ids.length} onClick={remove} className="h-11 rounded-xl border border-line-strong text-[14px] text-accent disabled:opacity-40">
            删除
          </button>
        </div>
      </div>
      {/* 归到哪里 */}
      {moving && (
        <PlacePickSheet
          title={`把 ${ids.length} 张照片归到…`}
          places={places}
          current={null}
          onClose={() => setMoving(false)}
          onPick={async (placeId) => {
            await movePhotos(ids, placeId)
            setMoving(false)
            setSel(new Set())
            onToast(`已归到「${places.find((p) => p.id === placeId)?.name ?? '城市漫步'}」`)
          }}
        />
      )}
    </div>
  )
}
