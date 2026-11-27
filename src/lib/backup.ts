// ============================================================
// 导出 / 导入备份
//   - 导出：把手机里的所有数据（行程、酒店景点、日程、车票和文件、花费、照片、设置）打包成一个 JSON 文件
//     车票图片、PDF、照片会转成文字（base64）放进文件里，所以一个文件就是完整备份
//     照片多的话文件会很大，可以选择不包含照片（恢复这种备份时，手机里现有的照片保持不动）
//   - 导入：读备份文件，确认后二选一：
//       合并：备份里的内容加进来，手机里现有、备份里没有的保留（同一条记录以备份为准）
//       替换：清空手机里的数据，换成备份里的
//   - 备份里有数据结构版本号，旧版本的备份也能导入（缺的表当作空）
// ============================================================

// 引入数据库
import { db } from '../db/db'
// 引入版本号
import { SCHEMA_VERSION, type Photo, type Setting, type TicketFile } from '../db/schema'
// 引入“没备份的改动”记录
import { clearUnsaved } from './changeTracker'

// 备份文件里的 App 标识（防止导入别的 JSON）
const APP_ID = 'noel-travel'
// 记录上次备份时间的设置名
export const LAST_BACKUP_KEY = 'lastBackupAt'

// 要备份的表（路线缓存可以重新算，不备份）
const TABLES = ['trips', 'stops', 'segments', 'places', 'dayPlans', 'settings', 'tickets', 'ticketFiles', 'expenses', 'photos'] as const
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
  // 是否包含照片（'excluded' = 导出时选了不包含；旧版备份没有这个字段）
  photos?: 'included' | 'excluded'
  // 每张表的数据
  tables: Partial<Record<TableName, unknown[]>>
}

// 车票文件在备份里的样子：blob 换成 dataUrl 文字
type SerializedFile = Omit<TicketFile, 'blob'> & { dataUrl: string }
// 照片在备份里的样子：大图和小图都换成 dataUrl 文字
type SerializedPhoto = Omit<Photo, 'blob' | 'thumb'> & { dataUrl: string; thumbDataUrl: string }

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

// 生成备份文件（includePhotos = 是否包含照片）
export async function createBackup(includePhotos = true): Promise<File> {
  // 文件内容分成很多小段拼起来（照片多时，拼成一整个超长字符串会占太多内存）
  const parts: string[] = []
  // 文件开头：App 标识、版本、时间、是否包含照片
  const head = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), photos: includePhotos ? 'included' : 'excluded' }
  parts.push(JSON.stringify(head).slice(0, -1) + ',"tables":{')
  // 逐张表读取
  for (const [ti, name] of TABLES.entries()) {
    // 不包含照片时跳过照片表
    if (name === 'photos' && !includePhotos) continue
    // 表名
    parts.push(`${ti > 0 ? ',' : ''}${JSON.stringify(name)}:[`)
    // 读出全部记录
    const rows = await db.table(name).toArray()
    // 逐条写入
    for (const [i, row] of rows.entries()) {
      // 记录之间用逗号隔开
      if (i > 0) parts.push(',')
      // 车票文件：把 blob 转成文字
      if (name === 'ticketFiles') {
        const { blob, ...rest } = row as TicketFile
        parts.push(JSON.stringify({ ...rest, dataUrl: await blobToDataUrl(blob) } satisfies SerializedFile))
      } else if (name === 'photos') {
        // 照片：大图和小图都转成文字
        const { blob, thumb, ...rest } = row as Photo
        parts.push(JSON.stringify({ ...rest, dataUrl: await blobToDataUrl(blob), thumbDataUrl: await blobToDataUrl(thumb) } satisfies SerializedPhoto))
      } else {
        // 其他表原样保存
        parts.push(JSON.stringify(row))
      }
    }
    // 表结束
    parts.push(']')
  }
  // 文件结尾
  parts.push('}}')
  // 文件名带日期
  const name = `noel-backup-${new Date().toISOString().slice(0, 10)}.json`
  // 生成文件
  return new File(parts, name, { type: 'application/json' })
}

// 把备份交给用户：能用系统分享（iPhone：存储到“文件”、AirDrop、发给自己）就分享，否则直接下载
// 'blocked' = iPhone 没让弹出分享菜单（打包太久，超过了“刚点过按钮”的时限）：文件已经准备好，让用户再点一下
export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled' | 'blocked'> {
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
      // 系统不让弹出（需要用户刚点过按钮）
      if ((e as Error).name === 'NotAllowedError') return 'blocked'
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
  // 清掉“有改动没备份”的记录
  clearUnsaved()
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
  const summary = `备份时间：${when}\n${n('trips')} 次旅行、${n('stops')} 个地点、${n('places')} 个酒店景点、${n('tickets')} 张车票（${n('ticketFiles')} 个文件）、${n('expenses')} 笔花费、${backup.photos === 'excluded' ? '不含照片（现有照片保持不动）' : `${n('photos')} 张照片`}`
  // 返回
  return { backup, summary }
}

// 恢复方式：合并 / 替换
export type RestoreMode = 'merge' | 'replace'

// 合并设置：大部分以备份为准；几项特殊的取两边合起来的结果
function mergeSettings(current: Setting[], incoming: Setting[]): Setting[] {
  // 手机里现有的设置（按名字查）
  const cur = new Map(current.map((s) => [s.key, s.value]))
  // 逐条处理备份里的设置
  return incoming.map((s) => {
    // 手机里同名的值
    const mine = cur.get(s.key)
    // 没有同名的：直接用备份的
    if (mine === undefined) return s
    // 已经加过的推荐地点：两边合起来（删掉的推荐不会被加回来）
    if (s.key === 'recPlacesSeen' && Array.isArray(mine) && Array.isArray(s.value)) return { key: s.key, value: [...new Set([...mine, ...s.value])] }
    // 推荐内容版本、上次备份时间：取大的
    if ((s.key === 'contentVersion' || s.key === LAST_BACKUP_KEY) && typeof mine === 'number' && typeof s.value === 'number') return { key: s.key, value: Math.max(mine, s.value) }
    // 其他：以备份为准
    return s
  })
}

// 把备份写进数据库
//   replace：替换手机里的全部数据
//   merge：备份里的加进来、同一条记录以备份为准，手机里有、备份里没有的保留
export async function restoreBackup(backup: BackupFile, mode: RestoreMode = 'replace'): Promise<void> {
  // 一次性完成：要么全部成功，要么不改
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.routeCache], async () => {
    // 逐张表处理
    for (const name of TABLES) {
      // 导出时选了“不包含照片”：手机里现有的照片保持不动
      if (name === 'photos' && backup.photos === 'excluded') continue
      // 替换：先清空
      if (mode === 'replace') await db.table(name).clear()
      // 备份里的数据（旧版本备份可能没有这张表）
      const rows = backup.tables[name] ?? []
      // 车票文件：文字转回 Blob
      if (name === 'ticketFiles') {
        await db.ticketFiles.bulkPut((rows as SerializedFile[]).map(({ dataUrl, ...rest }) => ({ ...rest, blob: dataUrlToBlob(dataUrl) })))
      } else if (name === 'photos') {
        // 照片：文字转回大图和小图
        await db.photos.bulkPut((rows as SerializedPhoto[]).map(({ dataUrl, thumbDataUrl, ...rest }) => ({ ...rest, blob: dataUrlToBlob(dataUrl), thumb: dataUrlToBlob(thumbDataUrl) })))
      } else if (name === 'settings' && mode === 'merge') {
        // 合并设置
        await db.settings.bulkPut(mergeSettings(await db.settings.toArray(), rows as Setting[]))
      } else {
        // 其他表原样写入（合并时：同一个 ID 以备份为准）
        await db.table(name).bulkPut(rows)
      }
    }
    // 路线缓存清空（会重新算）
    await db.routeCache.clear()
    // 替换：刚恢复过的数据就等于有备份
    if (mode === 'replace') await db.settings.put({ key: LAST_BACKUP_KEY, value: Date.now() })
  })
  // 替换：清掉“有改动没备份”（合并后的数据是新的组合，还没有备份，保留提醒）
  if (mode === 'replace') clearUnsaved()
}
