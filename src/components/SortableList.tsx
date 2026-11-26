// ============================================================
// 可以拖动排序的列表：按住每一项左边的“把手”上下拖，松开就换到新位置
//   - 手机（手指）和电脑（鼠标）都能用
//   - 拖的时候其他项会让出位置，看得到会放在哪
// ============================================================

// 引入 React 钩子
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
// 引入图标
import { Icon } from './Icon'

// 列表组件；render 的第二个参数是“把手”，放在每一项里合适的位置
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
  gap = 8,
}: {
  // 列表项
  items: T[]
  // 新顺序
  onReorder: (next: T[]) => void
  // 画一项（handle = 拖动把手）
  render: (item: T, handle: ReactNode, dragging: boolean) => ReactNode
  // 项之间的间距（像素）
  gap?: number
}) {
  // 每一项的元素
  const refs = useRef(new Map<string, HTMLDivElement>())
  // 拖动状态：哪一项、移动了多少、拖动开始时各项的位置
  const [drag, setDrag] = useState<{ id: string; dy: number; startY: number; rects: { id: string; top: number; height: number }[] } | null>(null)

  // 按下把手
  const onDown = (id: string) => (e: ReactPointerEvent) => {
    // 只认左键 / 手指
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    // 抓住指针（移出把手也能继续拖）
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    // 记下每一项现在的位置
    const rects = items.map((it) => {
      const r = refs.current.get(it.id)?.getBoundingClientRect()
      return { id: it.id, top: r?.top ?? 0, height: r?.height ?? 0 }
    })
    setDrag({ id, dy: 0, startY: e.clientY, rects })
  }
  // 拖动
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return
    setDrag({ ...drag, dy: e.clientY - drag.startY })
  }
  // 松开：算出新位置
  const onUp = () => {
    if (!drag) return
    const to = targetIndex(drag)
    const from = items.findIndex((it) => it.id === drag.id)
    setDrag(null)
    if (to === from || from < 0) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
  }

  // 拖到了第几个位置（按被拖项的中心点算）
  const targetIndex = (d: NonNullable<typeof drag>) => {
    const me = d.rects.find((r) => r.id === d.id)!
    const center = me.top + me.height / 2 + d.dy
    // 中心点下面有几个别的项的中心
    return d.rects.filter((r) => r.id !== d.id && r.top + r.height / 2 < center).length
  }

  // 拖动时每一项要移动多少（让出位置）
  const offsetOf = (id: string): number => {
    if (!drag) return 0
    if (id === drag.id) return drag.dy
    const from = drag.rects.findIndex((r) => r.id === drag.id)
    const i = drag.rects.findIndex((r) => r.id === id)
    const to = targetIndex(drag)
    const h = drag.rects[from].height + gap
    // 往下拖：中间的项往上让；往上拖：中间的项往下让
    if (from < to && i > from && i <= to) return -h
    if (from > to && i < from && i >= to) return h
    return 0
  }

  // 返回
  return (
    <div className="flex flex-col" style={{ gap }}>
      {items.map((it) => {
        // 是不是正在被拖的那一项
        const dragging = drag?.id === it.id
        // 把手
        const handle = (
          <button
            type="button"
            aria-label="按住拖动，调整顺序"
            onPointerDown={onDown(it.id)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
          >
            <Icon name="grip" size={18} />
          </button>
        )
        // 一项
        return (
          <div
            key={it.id}
            ref={(el) => {
              if (el) refs.current.set(it.id, el)
              else refs.current.delete(it.id)
            }}
            className={`relative ${dragging ? 'z-10 shadow-[0_10px_30px_var(--shadow)]' : ''}`}
            style={{ transform: `translateY(${offsetOf(it.id)}px)`, transition: dragging || !drag ? 'none' : 'transform 150ms ease' }}
          >
            {render(it, handle, dragging)}
          </div>
        )
      })}
    </div>
  )
}
