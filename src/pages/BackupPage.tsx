// ============================================================
// 备份与恢复（/backup）
//   - 导出备份：一个文件包含全部数据（含车票图片），存到“文件”或发给自己
//   - 导入备份：换手机、清了浏览器数据之后，用备份文件恢复
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
import { LAST_BACKUP_KEY, createBackup, markBackedUp, readBackup, restoreBackup, shareOrDownload } from '../lib/backup'
// 引入图标
import { Icon } from '../components/Icon'

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

// 页面组件
export default function BackupPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 上次备份时间
  const last = useLastBackup()
  // 正在处理的提示
  const [busy, setBusy] = useState<string | null>(null)
  // 结果提示
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // 文件选择框
  const inputRef = useRef<HTMLInputElement>(null)

  // 导出
  const onExport = async () => {
    // 处理中
    setBusy('正在打包…')
    setMsg(null)
    try {
      // 生成备份文件
      const file = await createBackup()
      // 交给用户
      const r = await shareOrDownload(file)
      // 取消了
      if (r === 'cancelled') {
        setMsg({ ok: false, text: '已取消，没有保存备份' })
        return
      }
      // 记下备份时间
      await markBackedUp()
      // 成功提示
      setMsg({ ok: true, text: `已生成备份 ${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MB）。请确认它存到了「文件」或发给了自己。` })
    } catch (e) {
      // 出错
      setMsg({ ok: false, text: `导出失败：${(e as Error).message}` })
    } finally {
      // 结束
      setBusy(null)
    }
  }

  // 导入
  const onImport = async (f: File | undefined) => {
    // 没选文件
    if (!f) return
    // 处理中
    setBusy('正在读取备份…')
    setMsg(null)
    try {
      // 读取并检查
      const { backup, summary } = await readBackup(f)
      // 确认（会覆盖手机里的数据）
      if (!window.confirm(`用这个备份替换手机里现在的全部数据？\n\n${summary}\n\n现在手机里的数据会被覆盖，建议先导出一份当前的备份。`)) return
      // 写入
      setBusy('正在恢复…')
      await restoreBackup(backup)
      // 成功
      setMsg({ ok: true, text: '恢复完成！' })
      // 回首页
      setTimeout(() => navigate('/'), 800)
    } catch (e) {
      // 出错
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      // 结束
      setBusy(null)
      // 清空选择框
      if (inputRef.current) inputRef.current.value = ''
    }
  }

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
      {/* 上次备份 */}
      <p className={`mt-1 text-[14px] ${!last || Date.now() - last > 7 * 86400000 ? 'text-accent' : 'text-muted'}`}>{backupAgeText(last)}</p>

      {/* 说明 */}
      <p className="mt-4 rounded-2xl bg-oat p-4 text-[13px] leading-relaxed text-muted">
        所有数据（行程、酒店景点、日程、车票图片和 PDF、花费）都只存在这台手机里。换手机、清除 Safari 数据、删掉 App 之前，先导出一份备份。出发前和旅途中每加了新车票，也建议导出一次。
      </p>

      {/* 导出 */}
      <button onClick={onExport} disabled={!!busy} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-50">
        <Icon name="download" size={18} />
        导出备份
      </button>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">iPhone 上会弹出分享菜单：选「存储到“文件”」，或者用 AirDrop / 邮件发给自己。</p>

      {/* 导入 */}
      <button onClick={() => inputRef.current?.click()} disabled={!!busy} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] disabled:opacity-50">
        <Icon name="upload" size={18} />
        从备份恢复
      </button>
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
      <p className="mt-2 text-[12px] leading-relaxed text-muted">选择之前导出的 noel-backup-日期.json 文件。恢复会替换手机里现在的全部数据。</p>

      {/* 状态 */}
      {busy && <p className="mt-4 text-[13px] text-muted">{busy}</p>}
      {msg && <p className={`mt-4 rounded-xl px-3 py-2 text-[13px] leading-relaxed ${msg.ok ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{msg.text}</p>}
    </div>
  )
}
