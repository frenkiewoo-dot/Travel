// ============================================================
// 备份与恢复（/backup）
//   - 导出备份：一个文件包含全部数据（含车票图片），存到「文件 → iCloud 云盘」或发给自己
//   - 从备份恢复：换手机、删了主屏幕图标、在 Safari 或电脑上填过东西时，用备份文件把数据带过来
//     可以选「合并」（保留手机里现有的）或「替换」（换成备份里的）
// ============================================================

// 引入 React 钩子
import { useRef, useState } from 'react'
// 引入路由
import { useNavigate } from 'react-router-dom'
// 引入实时查询
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入备份工具
import { LAST_BACKUP_KEY, createBackup, markBackedUp, readBackup, restoreBackup, shareOrDownload, type RestoreMode } from '../lib/backup'
// 引入“没备份的改动”记录
import { useUnsavedSince } from '../lib/changeTracker'
// 引入图标
import { Icon } from '../components/Icon'
// 引入底部弹出面板
import { Sheet } from '../components/Sheet'

// 上次备份是多久以前（文字）
export function backupAgeText(ts: number | undefined): string {
  // 没备份过
  if (!ts) return '还没有备份过'
  // 相差几天
  const days = Math.floor((Date.now() - ts) / 86400000)
  // 今天
  if (days === 0) return '今天备份过'
  // 几天前
  return `上次备份是 ${days} 天前`
}

// 读取上次备份时间（实时）
export function useLastBackup(): number | undefined {
  // 读设置
  const rec = useLiveQuery(() => db.settings.get(LAST_BACKUP_KEY))
  // 返回时间戳
  return rec?.value as number | undefined
}

// 读好、等你选恢复方式的备份
type Pending = Awaited<ReturnType<typeof readBackup>>

// 页面组件
export default function BackupPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 上次备份时间
  const last = useLastBackup()
  // 从什么时候开始有改动没备份
  const unsaved = useUnsavedSince()
  // 正在处理的提示
  const [busy, setBusy] = useState<string | null>(null)
  // 结果提示
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // 文件选择框
  const inputRef = useRef<HTMLInputElement>(null)
  // 是否包含照片
  const [withPhotos, setWithPhotos] = useState(true)
  // 打包好了、但 iPhone 没让弹出分享菜单的备份文件（再点一下按钮就能保存）
  const [ready, setReady] = useState<File | null>(null)
  // 读好、等你选「合并」还是「替换」的备份
  const [pending, setPending] = useState<Pending | null>(null)
  // 照片张数和大约多大（MB）
  const photoStat = useLiveQuery(async () => {
    // 所有照片
    const all = await db.photos.toArray()
    // 大图 + 小图的字节数，转成 base64 后约大 1/3
    const bytes = all.reduce((sum, p) => sum + p.blob.size + p.thumb.size, 0) * 1.34
    // 返回
    return { count: all.length, mb: bytes / 1024 / 1024 }
  })

  // 把打包好的文件交给系统（分享菜单 / 下载），并处理结果
  const deliver = async (file: File) => {
    // 交给用户
    const r = await shareOrDownload(file)
    // iPhone 没让弹出分享菜单：留着文件，显示「保存备份文件」按钮
    if (r === 'blocked') {
      setReady(file)
      setMsg({ ok: true, text: '备份已经打包好了，点下面的「保存备份文件」把它存起来。' })
      return
    }
    // 取消了
    if (r === 'cancelled') {
      setMsg({ ok: false, text: '已取消，没有保存备份' })
      return
    }
    // 保存成功：不再需要留着
    setReady(null)
    // 记下备份时间（同时清掉“有改动没备份”的提醒）
    await markBackedUp()
    // 成功提示
    setMsg({ ok: true, text: `已生成备份 ${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MB）。请确认它存到了「文件」或发给了自己。` })
  }

  // 导出
  const onExport = async () => {
    // 处理中
    setBusy('正在打包…')
    setMsg(null)
    setReady(null)
    try {
      // 生成备份文件并交给用户
      await deliver(await createBackup(withPhotos))
    } catch (e) {
      // 出错
      setMsg({ ok: false, text: `导出失败：${(e as Error).message}` })
    } finally {
      // 结束
      setBusy(null)
    }
  }

  // 选好了备份文件：先读取检查，再让你选恢复方式
  const onPick = async (f: File | undefined) => {
    // 没选文件
    if (!f) return
    // 处理中
    setBusy('正在读取备份…')
    setMsg(null)
    try {
      // 读取并检查，弹出选择
      setPending(await readBackup(f))
    } catch (e) {
      // 出错
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      // 结束
      setBusy(null)
      // 清空选择框（同一个文件可以再选一次）
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // 按选好的方式恢复
  const onRestore = async (mode: RestoreMode) => {
    // 没有等待恢复的备份
    if (!pending) return
    // 替换会清掉手机里现在的数据：再确认一次
    if (mode === 'replace' && !window.confirm('确定替换吗？手机里现在的全部数据会被清空，换成备份里的内容。')) return
    // 关掉选择面板
    const { backup } = pending
    setPending(null)
    // 写入
    setBusy(mode === 'merge' ? '正在合并…' : '正在恢复…')
    try {
      await restoreBackup(backup, mode)
      // 成功
      setMsg({ ok: true, text: mode === 'merge' ? '合并完成！建议马上再导出一份新的备份，把合并后的全部内容存起来。' : '恢复完成！' })
      // 替换完回首页；合并完留在这里，方便马上导出
      if (mode === 'replace') setTimeout(() => navigate('/'), 800)
    } catch (e) {
      // 出错（事务会整体撤销，手机里的数据不变）
      setMsg({ ok: false, text: `恢复失败，手机里的数据没有改动：${(e as Error).message}` })
    } finally {
      // 结束
      setBusy(null)
    }
  }

  // 备份状态那一行：没备份过、超过 7 天、或有改动没备份时用醒目的颜色
  const warn = !last || Date.now() - last > 7 * 86400000 || unsaved != null

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-10">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/more'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Sauvegarde</div>
      <h1 className="text-[28px] font-semibold">备份与恢复</h1>
      {/* 上次备份 + 有没有新改动 */}
      <p className={`mt-1 text-[14px] ${warn ? 'text-accent' : 'text-muted'}`}>
        {backupAgeText(last)}
        {unsaved != null && ' · 之后有新的改动还没备份'}
      </p>

      {/* 说明 */}
      <div className="mt-4 rounded-2xl bg-oat p-4 text-[13px] leading-relaxed text-muted">
        <p>所有数据（行程、酒店景点、日程、车票图片和 PDF、花费、相册照片）都只存在这台设备里，不会上传到任何服务器，所以 App 更新时也拿不到、改不了你的数据。</p>
        <p className="mt-2">
          <b className="font-semibold text-ink">删掉主屏幕上的图标，会把 App 里的数据一起删掉</b>，换手机、清除 Safari 数据也一样。导出时选「存储到“文件”」→「iCloud 云盘」，备份就存在你的 Apple 账号里，这些情况下都还能找回来。
        </p>
        <p className="mt-2">建议出发前、每加了新车票之后都导出一次。有改动超过一天没备份时，首页会提醒你。</p>
      </div>

      {/* 是否包含照片（有照片时才显示） */}
      {!!photoStat?.count && (
        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
          <span className="text-[13px] leading-relaxed">
            <span className="font-medium">包含相册照片</span>（{photoStat.count} 张，约 {photoStat.mb.toFixed(0)} MB）
            <span className="block text-[12px] text-muted">照片多时文件会很大。不包含照片的备份恢复时，设备里现有的照片保持不动。</span>
          </span>
        </label>
      )}

      {/* 导出 */}
      <button onClick={onExport} disabled={!!busy} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-50">
        <Icon name="download" size={18} />
        导出备份
      </button>
      {/* 打包好了但分享菜单没弹出来：再点这里保存 */}
      {ready && (
        <button onClick={() => deliver(ready)} disabled={!!busy} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink text-[15px] font-medium disabled:opacity-50">
          <Icon name="download" size={18} />
          保存备份文件（{(ready.size / 1024 / 1024).toFixed(1)} MB）
        </button>
      )}
      <p className="mt-2 text-[12px] leading-relaxed text-muted">iPhone 上会弹出分享菜单：选「存储到“文件”」→「iCloud 云盘」→「存储」。也可以用 AirDrop / 邮件发给自己。</p>

      {/* 导入 */}
      <button onClick={() => inputRef.current?.click()} disabled={!!busy} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] disabled:opacity-50">
        <Icon name="upload" size={18} />
        从备份恢复
      </button>
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      <p className="mt-2 text-[12px] leading-relaxed text-muted">选择之前导出的 noel-backup-日期.json 文件，然后选「合并」或「替换」。在 Safari 网页或电脑上填过的内容，也可以先在那边导出备份，再到这里合并进来。</p>

      {/* 状态 */}
      {busy && <p className="mt-4 text-[13px] text-muted">{busy}</p>}
      {msg && <p className={`mt-4 rounded-xl px-3 py-2 text-[13px] leading-relaxed ${msg.ok ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{msg.text}</p>}

      {/* 选恢复方式 */}
      {pending && (
        <Sheet title="怎么恢复？" onClose={() => setPending(null)}>
          {/* 备份里有什么 */}
          <p className="rounded-xl bg-oat px-3 py-2 text-[12px] leading-relaxed whitespace-pre-line text-muted">{pending.summary}</p>
          {/* 合并 */}
          <button onClick={() => onRestore('merge')} className="mt-3 w-full rounded-2xl border-2 border-ink p-4 text-left">
            <span className="block text-[15px] font-semibold">合并到现在的数据（推荐）</span>
            <span className="mt-1 block text-[12px] leading-relaxed text-muted">备份里的内容加进来；手机里现有、备份里没有的都保留。同一条记录（例如同一个城市、同一张车票）以备份里的为准。</span>
          </button>
          {/* 替换 */}
          <button onClick={() => onRestore('replace')} className="mt-2 w-full rounded-2xl border border-line-strong p-4 text-left">
            <span className="block text-[15px] font-semibold">替换全部数据</span>
            <span className="mt-1 block text-[12px] leading-relaxed text-muted">清空手机里现在的数据，完全换成备份里的。换新手机、或者想回到备份那时的样子时用。</span>
          </button>
        </Sheet>
      )}
    </div>
  )
}
