// ============================================================
// 相册的数据操作：上传照片（缩小、读拍摄时间和地点、自动归到景点）、
// 读取、改说明、换景点、设封面、删除
// 照片只存在手机里（IndexedDB），不会上传到任何地方
// ============================================================

// 引入实时查询钩子
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from './db'
// 引入数据结构
import type { Photo, Place } from './schema'
// 引入生成 ID 的工具
import { newId } from './pins'
// 引入 EXIF 读取
import { readExif } from '../lib/exif'
// 引入距离计算
import { distanceMeters } from '../lib/geo'

// 大图长边最多多少像素（看大图够清楚，又不会太占空间）
const FULL_MAX = 2048
// 小图长边最多多少像素（排版用）
const THUMB_MAX = 720
// 拍摄地点离景点多近才自动归过去（米）
const AUTO_RADIUS = 300

// ---------- 读取 ----------

// 读取一个城市的所有照片（按拍摄时间排序）
export function usePhotos(stopId: string | null | undefined) {
  // 实时查询：照片变化时页面自动刷新
  return useLiveQuery(async () => (stopId ? (await db.photos.where('stopId').equals(stopId).toArray()).sort(byTime) : []), [stopId])
}

// 每个城市的照片概况：张数 + 封面（城市列表、我的旅行用）
export interface StopPhotoSummary {
  // 张数
  count: number
  // 封面照片
  cover: Photo
}

// 读取所有城市的照片概况（键是城市 ID）
export function usePhotoSummary() {
  // 实时查询
  return useLiveQuery(async () => {
    // 所有城市（要读封面设置）
    const stops = await db.stops.toArray()
    // 城市 ID → 封面照片 ID
    const coverOf = new Map(stops.map((s) => [s.id, s.coverPhotoId]))
    // 结果
    const out = new Map<string, StopPhotoSummary>()
    // 按拍摄时间遍历所有照片
    const all = (await db.photos.toArray()).sort(byTime)
    for (const p of all) {
      // 这个城市已有的概况
      const cur = out.get(p.stopId)
      // 第一张：先当封面
      if (!cur) out.set(p.stopId, { count: 1, cover: p })
      else {
        // 张数加 1
        cur.count++
        // 设过封面的话用设好的那张
        if (coverOf.get(p.stopId) === p.id) cur.cover = p
      }
    }
    // 返回
    return out
  })
}

// 按拍摄时间排序（同一时间按添加先后）
export function byTime(a: Photo, b: Photo): number {
  return a.takenAt.localeCompare(b.takenAt) || a.createdAt - b.createdAt
}

// ---------- 上传 ----------

// 上传方式：auto = 自动（有位置的归到附近景点，其余进“城市漫步”）；place = 全部归到一个景点；walk = 全部放进“城市漫步”
export type UploadMode = { kind: 'auto' } | { kind: 'place'; placeId: string } | { kind: 'walk' }

// 上传结果
export interface UploadResult {
  // 成功几张
  added: number
  // 失败的文件名
  failed: string[]
  // 自动归到景点的张数
  autoPlaced: number
  // 自动归到了几个景点
  autoPlaces: number
}

// 上传一批照片
export async function addPhotos(opts: {
  // 旅行 ID
  tripId: string
  // 城市 ID
  stopId: string
  // 选中的文件
  files: File[]
  // 上传方式
  mode: UploadMode
  // 这个城市的地点（自动归类用）
  places: Place[]
  // 进度回调：第几张 / 一共几张
  onProgress?: (done: number, total: number) => void
}): Promise<UploadResult> {
  // 结果
  const res: UploadResult = { added: 0, failed: [], autoPlaced: 0, autoPlaces: 0 }
  // 自动归到的景点（去重计数）
  const usedPlaces = new Set<string>()
  // 一张一张处理（同时处理太多张会占太多内存）
  for (const [i, file] of opts.files.entries()) {
    try {
      // 读拍摄时间和地点
      const exif = await readExif(file)
      // 缩小成大图和小图
      const img = await preparePhoto(file)
      // 归到哪个景点
      let placeId: string | undefined
      if (opts.mode.kind === 'place') placeId = opts.mode.placeId
      else if (opts.mode.kind === 'auto' && exif.lat !== undefined && exif.lng !== undefined) {
        // 找最近的景点
        placeId = nearestPlace(opts.places, exif.lat, exif.lng)?.id
        // 记下
        if (placeId) {
          res.autoPlaced++
          usedPlaces.add(placeId)
        }
      }
      // 写进数据库
      await db.photos.add({
        id: newId('ph'),
        tripId: opts.tripId,
        stopId: opts.stopId,
        placeId,
        ...img,
        // 拍摄时间：照片记录的，没有就用文件的修改时间
        takenAt: exif.takenAt ?? localIso(new Date(file.lastModified || Date.now())),
        lat: exif.lat,
        lng: exif.lng,
        createdAt: Date.now() + i,
      })
      // 成功
      res.added++
    } catch {
      // 失败（例如电脑浏览器打不开 HEIC 格式）
      res.failed.push(file.name)
    }
    // 报告进度
    opts.onProgress?.(i + 1, opts.files.length)
  }
  // 自动归到了几个景点
  res.autoPlaces = usedPlaces.size
  // 返回
  return res
}

// 找离拍摄地点最近的景点（AUTO_RADIUS 米以内；车站不算）
export function nearestPlace(places: Place[], lat: number, lng: number): Place | undefined {
  // 最近的
  let best: Place | undefined
  // 最近的距离
  let bestD = AUTO_RADIUS
  // 逐个比较
  for (const p of places) {
    // 车站不当作拍照的地方
    if (p.category === 'station') continue
    // 距离（米）
    const d = distanceMeters([lng, lat], [p.lng, p.lat])
    // 更近就记下
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  // 返回
  return best
}

// 把一个图片文件缩小成大图和小图（JPEG），并返回宽高
async function preparePhoto(file: File): Promise<Pick<Photo, 'blob' | 'thumb' | 'width' | 'height'>> {
  // 临时网址
  const url = URL.createObjectURL(file)
  try {
    // 用 <img> 解码：浏览器会按照片里的方向信息自动转正
    const img = new Image()
    img.src = url
    await img.decode()
    // 原图宽高
    const w = img.naturalWidth
    const h = img.naturalHeight
    // 打不开
    if (!w || !h) throw new Error('无法读取图片')
    // 画成大图和小图
    const full = await resize(img, w, h, FULL_MAX, 0.85)
    const thumb = await resize(img, w, h, THUMB_MAX, 0.8)
    // 返回
    return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height }
  } finally {
    // 释放临时网址
    URL.revokeObjectURL(url)
  }
}

// 把图片按长边缩小到 max 像素以内，输出 JPEG
async function resize(img: HTMLImageElement, w: number, h: number, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  // 缩小比例（本来就小的不放大）
  const scale = Math.min(1, max / Math.max(w, h))
  // 新的宽高
  const width = Math.round(w * scale)
  const height = Math.round(h * scale)
  // 画布
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  // 画上去（高质量缩放）
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  // 转成 JPEG
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('转换失败'))), 'image/jpeg', quality))
  // 返回
  return { blob, width, height }
}

// 把时间转成当地时间的 'YYYY-MM-DDTHH:mm:ss'
export function localIso(d: Date): string {
  // 补零
  const p = (n: number) => String(n).padStart(2, '0')
  // 拼起来
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// ---------- 修改 ----------

// 改一张照片的说明
export async function setCaption(id: string, caption: string): Promise<void> {
  // 空的就删掉
  await db.photos.update(id, { caption: caption.trim() || undefined })
}

// 把几张照片换到某个景点（undefined = 放进“城市漫步”）
export async function movePhotos(ids: string[], placeId: string | undefined): Promise<void> {
  // 一次性完成
  await db.transaction('rw', db.photos, async () => {
    for (const id of ids) await db.photos.update(id, { placeId })
  })
}

// 删除几张照片
export async function deletePhotos(ids: string[]): Promise<void> {
  // 一次性删除
  await db.photos.bulkDelete(ids)
}

// 设置城市相册的封面
export async function setCover(stopId: string, photoId: string): Promise<void> {
  // 存在城市上
  await db.stops.update(stopId, { coverPhotoId: photoId })
}

// 设置某一章写的一句话（空的就删掉）
export async function setAlbumNote(stopId: string, key: string, text: string): Promise<void> {
  // 一次性完成（先读再写）
  await db.transaction('rw', db.stops, async () => {
    // 城市
    const stop = await db.stops.get(stopId)
    if (!stop) return
    // 复制一份
    const notes = { ...(stop.albumNotes ?? {}) }
    // 有内容就写，没有就删
    if (text.trim()) notes[key] = text.trim()
    else delete notes[key]
    // 保存
    await db.stops.update(stopId, { albumNotes: notes })
  })
}
