// ============================================================
// 票夹的数据操作：保存车票和文件、删除、读取
// 车票文件只存在手机里（IndexedDB），不会上传
// ============================================================

// 引入实时查询钩子
import { useLiveQuery } from 'dexie-react-hooks'
// 引入 React 钩子
import { useEffect, useState } from 'react'
// 引入数据库
import { db } from './db'
// 引入数据结构
import type { Ticket, TicketFile } from './schema'
// 引入生成 ID 的工具
import { newId } from './pins'
// 引入处理好的文件类型
import type { PreparedFile } from '../lib/files'

// 读取一张车票的所有文件（按顺序）
export function useTicketFiles(ticketId: string | null | undefined) {
  // 实时查询
  return useLiveQuery(async () => (ticketId ? (await db.ticketFiles.where('ticketId').equals(ticketId).toArray()).sort((a, b) => a.order - b.order) : []), [ticketId])
}

// 一张车票里可以直接显示的图片（PDF 原件不算，它转出来的图片算）
export function viewableFiles(files: TicketFile[]): TicketFile[] {
  // 只要图片
  return files.filter((f) => f.mime.startsWith('image/'))
}

// 把 Blob 变成可以给 <img> 用的临时网址；组件卸载时自动释放
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  // 网址
  const [url, setUrl] = useState<string | null>(null)
  // blob 变化时重新生成
  useEffect(() => {
    // 没有内容
    if (!blob) {
      setUrl(null)
      return
    }
    // 生成临时网址
    const u = URL.createObjectURL(blob)
    // 保存
    setUrl(u)
    // 释放
    return () => URL.revokeObjectURL(u)
  }, [blob])
  // 返回
  return url
}

// 保存车票：新建或修改；newFiles 是新上传的文件，removeFileIds 是要删掉的文件
export async function saveTicket(opts: {
  ticket: Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
  newFiles: PreparedFile[]
  removeFileIds: string[]
  markBooked: boolean
}): Promise<string> {
  // 车票 ID：修改时沿用，新建时生成
  const id = opts.ticket.id ?? newId('tk')
  // 用事务一次性写入
  await db.transaction('rw', [db.tickets, db.ticketFiles, db.segments], async () => {
    // 保存车票本身
    await db.tickets.put({ ...opts.ticket, id, createdAt: opts.ticket.createdAt ?? Date.now() })
    // 要删的文件：PDF 原件被删时，它转出来的图片也一起删
    for (const fid of opts.removeFileIds) {
      // 删文件本身
      await db.ticketFiles.delete(fid)
      // 删由它转出来的图片
      await db.ticketFiles.where('ticketId').equals(id).filter((f) => f.pdfId === fid).delete()
    }
    // 现有文件的最大顺序号（新文件排在后面）
    const existing = await db.ticketFiles.where('ticketId').equals(id).toArray()
    let order = existing.reduce((m, f) => Math.max(m, f.order), -1) + 1
    // 临时 key → 正式 ID（PDF 转出来的图片要记住原件的正式 ID）
    const idOf = new Map<string, string>()
    // 先给每个新文件分配 ID
    for (const f of opts.newFiles) idOf.set(f.key, newId('file'))
    // 写入新文件
    for (const f of opts.newFiles) {
      await db.ticketFiles.add({
        id: idOf.get(f.key)!,
        ticketId: id,
        name: f.name,
        mime: f.mime,
        blob: f.blob,
        pdfId: f.pdfKey ? idOf.get(f.pdfKey) : undefined,
        page: f.page,
        order: order++,
      })
    }
    // 关联了交通段，并且要求标记已订：把那一段标成“已订”
    if (opts.markBooked && opts.ticket.segmentId) await db.segments.update(opts.ticket.segmentId, { booked: true })
  })
  // 返回车票 ID
  return id
}

// 删除车票和它的所有文件
export async function deleteTicket(id: string) {
  // 用事务
  await db.transaction('rw', [db.tickets, db.ticketFiles], async () => {
    // 删文件
    await db.ticketFiles.where('ticketId').equals(id).delete()
    // 删车票
    await db.tickets.delete(id)
  })
}
