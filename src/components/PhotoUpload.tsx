// ============================================================
// 上传照片：选照片（可以多选，可以再加几张，选错的点 × 去掉）→ 选“放在哪里” → 处理（缩小、读拍摄时间和地点）→ 保存
//   - 自动整理：照片带位置信息的，归到 300 米内最近的景点；其余按日期放进「城市漫步」
//   - 也可以指定这一批都是在某个景点拍的
// ============================================================

// 引入 React 钩子
import { useEffect, useMemo, useRef, useState } from 'react'
// 引入数据结构
import type { Place, Stop } from '../db/schema'
// 引入上传
import { addPhotos, type UploadMode } from '../db/photos'
// 引入组件
import { Icon } from './Icon'
import { INPUT, Sheet } from './Sheet'

// 上传组件
export function PhotoUpload({ tripId, stop, places, onClose, onDone }: { tripId: string; stop: Stop; places: Place[]; onClose: () => void; onDone: (msg: string) => void }) {
  // 选中的文件
  const [files, setFiles] = useState<File[]>([])
  // 放在哪里：auto / place / walk
  const [mode, setMode] = useState<'auto' | 'place' | 'walk'>('auto')
  // 指定的景点
  const [placeId, setPlaceId] = useState('')
  // 进度（null = 还没开始）
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // 文件选择框
  const inputRef = useRef<HTMLInputElement>(null)
  // 可选的景点（车站不算）
  const options = places.filter((p) => p.category !== 'station')
  // 每张选中照片的预览网址（和 files 一一对应）
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  // 预览换了或关闭时释放网址
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])
  // 去掉一张（选错了）
  const removeAt = (i: number) => setFiles((fs) => fs.filter((_, j) => j !== i))
  // 加几张（接在后面，同一张不重复加）
  const addFiles = (list: File[]) =>
    setFiles((fs) => {
      const key = (f: File) => `${f.name}|${f.size}|${f.lastModified}`
      const have = new Set(fs.map(key))
      return [...fs, ...list.filter((f) => !have.has(key(f)))]
    })

  // 开始上传
  const start = async () => {
    // 没选照片
    if (!files.length) return
    // 上传方式
    const m: UploadMode = mode === 'place' && placeId ? { kind: 'place', placeId } : mode === 'walk' ? { kind: 'walk' } : { kind: 'auto' }
    // 开始
    setProgress({ done: 0, total: files.length })
    // 处理并保存
    const r = await addPhotos({ tripId, stopId: stop.id, files, mode: m, places, onProgress: (done, total) => setProgress({ done, total }) })
    // 结果说明
    const parts = [`已添加 ${r.added} 张照片`]
    if (m.kind === 'auto' && r.added > 0) parts.push(r.autoPlaced > 0 ? `${r.autoPlaced} 张按位置归到了 ${r.autoPlaces} 个景点` : '照片没有位置信息，先按日期放进「城市漫步」，可以用「整理」归到景点')
    if (r.failed.length) parts.push(`${r.failed.length} 张打不开（电脑浏览器不支持 HEIC 格式，可以先转成 JPG）`)
    // 通知并关闭
    onDone(parts.join('；'))
    onClose()
  }

  // 正在处理
  const busy = progress !== null

  // 返回
  return (
    <Sheet
      title="上传照片"
      onClose={busy ? () => {} : onClose}
      footer={
        busy ? (
          // 进度条
          <div>
            <div className="mb-2 text-[13px] text-muted">
              正在处理 {progress.done} / {progress.total}…（缩小照片、读取拍摄时间和地点）
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-oat" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
              取消
            </button>
            <button onClick={start} disabled={!files.length || (mode === 'place' && !placeId)} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-40">
              {files.length ? `添加 ${files.length} 张` : '先选照片'}
            </button>
          </div>
        )
      }
    >
      {/* 选照片：没选时是大按钮；选了以后变成「再加几张」 */}
      {files.length === 0 ? (
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong text-[14px] text-muted">
          <Icon name="plus" size={20} />
          从相册选照片（可以多选）
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]">
            已选 <b className="font-semibold">{files.length}</b> 张
            <span className="text-muted"> · 选错的点右上角 × 去掉</span>
          </span>
          {!busy && (
            <button onClick={() => setFiles([])} className="h-8 shrink-0 text-[12px] text-muted underline underline-offset-2">
              全部清空
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {/* 选中的照片：每张右上角 × 去掉；最后一格「再加几张」 */}
      {files.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {previews.map((u, i) => (
            <div key={u} className="relative aspect-square">
              <img src={u} alt={`第 ${i + 1} 张：${files[i]?.name ?? ''}`} loading="lazy" className="h-full w-full rounded-[6px] bg-oat object-cover" />
              {!busy && (
                <button
                  aria-label={`去掉第 ${i + 1} 张`}
                  onClick={() => removeAt(i)}
                  className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-ink text-paper shadow"
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          ))}
          {!busy && (
            <button onClick={() => inputRef.current?.click()} aria-label="再加几张照片" className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[6px] border border-dashed border-line-strong text-[11px] text-muted">
              <Icon name="plus" size={18} />
              再加几张
            </button>
          )}
        </div>
      )}

      {/* 放在哪里 */}
      <h3 className="mt-5 text-[14px] font-semibold">放在哪里？</h3>
      <div role="radiogroup" aria-label="放在哪里" className="mt-2 flex flex-col gap-2">
        <Choice checked={mode === 'auto'} onClick={() => setMode('auto')} title="自动整理（推荐）" desc="带位置信息的照片自动归到拍摄地附近的景点；其余按日期放进「城市漫步」" />
        <Choice checked={mode === 'place'} onClick={() => setMode('place')} title="都是在同一个地方拍的" desc="例如这一批都是在 Tivoli 拍的" />
        {mode === 'place' && (
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} aria-label="选择景点" className={INPUT}>
            <option value="">选一个景点…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.nameZh ? ` · ${p.nameZh}` : ''}
              </option>
            ))}
          </select>
        )}
        <Choice checked={mode === 'walk'} onClick={() => setMode('walk')} title="都放进「城市漫步」" desc="按拍摄日期分章，之后可以用「整理」再归到景点" />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        照片会缩小保存（长边 2048 像素，看大图足够清楚），只存在这台设备里。iPhone 上传时如果去掉了位置信息，可以选第二项，或者上传后用「整理」归类。
      </p>
    </Sheet>
  )
}

// 单选项
function Choice({ checked, onClick, title, desc }: { checked: boolean; onClick: () => void; title: string; desc: string }) {
  // 返回
  return (
    <button role="radio" aria-checked={checked} onClick={onClick} className={`flex items-start gap-3 rounded-xl border p-3 text-left ${checked ? 'border-ink bg-paper' : 'border-line'}`}>
      {/* 圆点 */}
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-ink' : 'border-line-strong'}`}>{checked && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
      <span>
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[12px] leading-relaxed text-muted">{desc}</span>
      </span>
    </button>
  )
}
