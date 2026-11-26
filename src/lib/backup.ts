// ============================================================
// 导出 / 导入备份
//   - 导出：把手机里的所有数据（行程、酒店景点、日程、车票和文件、花费、设置）打包成一个 JSON 文件
//     车票图片和 PDF 会转成文字（base64）放进文件里，所以一个文件就是完整备份
//   - 导入：读备份文件，确认后替换手机里的全部数据
//   - 备份里有数据结构版本号，旧版本的备份也能导入（缺的表当作空）
// ============================================================

// 引入数据库
import { db } from '../db/db'
// 引入版本号
import { SCHEMA_VERSION, type TicketFile } from '../db/schema'

// 备份文件里的 App 标识（防止导入别的 JSON）
const APP_ID = 'noel-travel'
// 记录上次备份时间的设置名
export const LAST_BACKUP_KEY = 'lastBackupAt'

// 要备份的表（路线缓存可以重新算，不备份）
const TABLES = ['trips', 'stops', 'segments', 'places', 'dayPlans', 'settings', 'tickets', 'ticketFiles', 'expenses'] as const
// 表名的类型
type TableName = (typeof TABLES)[number]

// 备份文件的格式
interface BackupFile {
  // App 标识
  app: string
  // 数据结构版本号
  schemaVersion: number
  // 导出时间
  exportedAt: string
  // 每张表的数据
  tables: Partial<Record<TableName, unknown[]>>
}

// 车票文件在备份里的样子：blob 换成 dataUrl 文字
type SerializedFile = Omit<TicketFile, 'blob'> & { dataUrl: string }

// Blob → data URL 文字
function blobToDataUrl(blob: Blob): Promise<string> {
  // 用 FileReader 读成 base64
  return new Promise((resolve, reject) => {
    // 读取器
    const r = new FileReader()
    // 读完
    r.onload = () => resolve(String(r.result))
    // 出错
    r.onerror = () => reject(r.error)
    // 开始读
    r.readAsDataURL(blob)
  })
}

// data URL 文字 → Blob
function dataUrlToBlob(url: string): Blob {
  // 拆成 “头部” 和 “内容”
  const [head, body] = url.split(',')
  // 文件类型
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  // base64 解码
  const bin = atob(body ?? '')
  // 转成字节
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  // 生成 Blob
  return new Blob([bytes], { type: mime })
}

// 生成备份文件
export async function createBackup(): Promise<File> {
  // 每张表的数据
  const tables: BackupFile['tables'] = {}
  // 逐张表读取
  for (const name of TABLES) {
    // 读出全部记录
    const rows = await db.table(name).toArray()
    // 车票文件：把 blob 转成文字
    if (name === 'ticketFiles') {
      tables[name] = await Promise.all(
        (rows as TicketFile[]).map(async ({ blob, ...rest }) => ({ ...rest, dataUrl: await blobToDataUrl(blob) }) satisfies SerializedFile),
      )
    } else {
      // 其他表原样保存
      tables[name] = rows
    }
  }
  // 组装备份
  const backup: BackupFile = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables }
  // 文件名带日期
  const name = `noel-backup-${new Date().toISOString().slice(0, 10)}.json`
  // 生成文件
  return new File([JSON.stringify(backup)], name, { type: 'application/json' })
}

// 把备份交给用户：能用系统分享（iPhone：存储到“文件”、AirDrop、发给自己）就分享，否则直接下载
export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  // 系统分享
  if (navigator.canShare?.({ files: [file] })) {
    try {
      // 打开分享菜单
      await navigator.share({ files: [file], title: 'Noël 旅行备份' })
      // 成功
      return 'shared'
    } catch (e) {
      // 用户取消了分享
      if ((e as Error).name === 'AbortError') return 'cancelled'
      // 其他错误：退回下载
    }
  }
  // 下载：生成临时网址并点击
  const url = URL.createObjectURL(file)
  // 隐藏的链接
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  // 点击下载
  document.body.append(a)
  a.click()
  a.remove()
  // 稍后释放
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  // 返回
  return 'downloaded'
}

// 记下“刚刚备份过”
export async function markBackedUp() {
  // 保存时间
  await db.settings.put({ key: LAST_BACKUP_KEY, value: Date.now() })
}

// 读取并检查备份文件，返回摘要（还没有写入数据库）
export async function readBackup(file: File): Promise<{ backup: BackupFile; summary: string }> {
  // 读文字
  const text = await file.text()
  // 解析 JSON
  let backup: BackupFile
  try {
    backup = JSON.parse(text)
  } catch {
    throw new Error('这不是有效的备份文件（无法读取）')
  }
  // 检查标识
  if (backup?.app !== APP_ID || typeof backup.schemaVersion !== 'number' || !backup.tables) throw new Error('这不是 Noël 旅行的备份文件')
  // 比当前 App 新的备份不能导入
  if (backup.schemaVersion > SCHEMA_VERSION) throw new Error('这个备份来自更新版本的 App，请先刷新 App 再导入')
  // 摘要：各类数据有多少
  const n = (t: TableName) => backup.tables[t]?.length ?? 0
  // 导出时间
  const when = new Date(backup.exportedAt).toLocaleString('zh-CN')
  // 拼成一句话
  const summary = `备份时间：${when}\n${n('trips')} 次旅行、${n('stops')} 个地点、${n('places')} 个酒店景点、${n('tickets')} 张车票（${n('ticketFiles')} 个文件）、${n('expenses')} 笔花费`
  // 返回
  return { backup, summary }
}

// 把备份写进数据库（会替换手机里的全部数据）
export async function restoreBackup(backup: BackupFile): Promise<void> {
  // 一次性完成：要么全部成功，要么不改
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.routeCache], async () => {
    // 逐张表处理
    for (const name of TABLES) {
      // 先清空
      await db.table(name).clear()
      // 备份里的数据（旧版本备份可能没有这张表）
      const rows = backup.tables[name] ?? []
      // 车票文件：文字转回 Blob
      if (name === 'ticketFiles') {
        await db.ticketFiles.bulkPut((rows as SerializedFile[]).map(({ dataUrl, ...rest }) => ({ ...rest, blob: dataUrlToBlob(dataUrl) })))
      } else {
        // 其他表原样写入
        await db.table(name).bulkPut(rows)
      }
    }
    // 路线缓存清空（会重新算）
    await db.routeCache.clear()
    // 记录：刚恢复过的数据就等于有备份
    await db.settings.put({ key: LAST_BACKUP_KEY, value: Date.now() })
  })
}
