// ============================================================
// 读取照片里的 EXIF 信息：拍摄时间、拍摄地点（GPS）
//   - 只认 JPEG（iPhone 选照片上传时，Safari 一般会自动转成 JPEG）
//   - 读不到就返回空对象，不会报错
//   - 有的手机上传时会去掉位置信息，那样就只有拍摄时间
// ============================================================

// 读出来的信息
export interface ExifInfo {
  // 拍摄时间（当地时间，'YYYY-MM-DDTHH:mm:ss'）
  takenAt?: string
  // 纬度
  lat?: number
  // 经度
  lng?: number
}

// 用到的 EXIF 标签编号
const TAG = {
  // IFD0 里的“修改时间”（没有拍摄时间时备用）
  dateTime: 0x0132,
  // 指向 Exif 子目录
  exifPointer: 0x8769,
  // 指向 GPS 子目录
  gpsPointer: 0x8825,
  // Exif 子目录里的“拍摄时间”
  dateTimeOriginal: 0x9003,
  // GPS：南北纬标记（N / S）
  latRef: 1,
  // GPS：纬度（度、分、秒）
  lat: 2,
  // GPS：东西经标记（E / W）
  lngRef: 3,
  // GPS：经度（度、分、秒）
  lng: 4,
}

// 从文件读出 EXIF（只读开头 256KB，EXIF 都在文件开头）
export async function readExif(file: Blob): Promise<ExifInfo> {
  try {
    // 读开头一段
    const buf = await file.slice(0, 256 * 1024).arrayBuffer()
    // 按字节读取的工具
    const v = new DataView(buf)
    // 不是 JPEG（JPEG 以 FF D8 开头）
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return {}
    // 从第 2 个字节开始，逐段查找
    let off = 2
    while (off + 4 <= v.byteLength) {
      // 段标记（FF xx）
      const marker = v.getUint16(off)
      // 格式不对就停
      if ((marker & 0xff00) !== 0xff00) break
      // 段长度
      const len = v.getUint16(off + 2)
      // APP1 段，并且以 "Exif\0\0" 开头：就是 EXIF
      if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966 && v.getUint16(off + 8) === 0) {
        return parseTiff(v, off + 10)
      }
      // 到了图像数据部分，后面不会再有 EXIF
      if (marker === 0xffda) break
      // 下一段
      off += 2 + len
    }
  } catch {
    // 文件损坏等：当作没有 EXIF
  }
  return {}
}

// 一个目录项
interface Entry {
  // 数据类型（2 = 文字，5 = 分数）
  type: number
  // 数量
  count: number
  // 值所在的位置（相对 TIFF 开头）
  at: number
}

// 解析 EXIF 里的 TIFF 结构
function parseTiff(v: DataView, start: number): ExifInfo {
  // 字节顺序：II = 小端（Intel），MM = 大端（Motorola）
  const little = v.getUint16(start) === 0x4949
  // 读 16 位整数
  const u16 = (o: number) => v.getUint16(start + o, little)
  // 读 32 位整数
  const u32 = (o: number) => v.getUint32(start + o, little)
  // 检查 TIFF 标识 42
  if (u16(2) !== 42) return {}
  // 读一个目录：返回 标签编号 → 目录项
  const readIfd = (o: number): Map<number, Entry> => {
    // 结果
    const map = new Map<number, Entry>()
    // 目录里有几项
    const n = u16(o)
    // 逐项读取
    for (let i = 0; i < n; i++) {
      // 这一项的位置（每项 12 字节）
      const e = o + 2 + i * 12
      // 类型和数量
      const type = u16(e + 2)
      const count = u32(e + 4)
      // 每种类型占几个字节（2 文字 1 字节；3 短整数 2；4 长整数 4；5 分数 8）
      const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[type] ?? 1
      // 4 字节以内的值直接存在目录项里，否则目录项里存的是位置
      const at = size * count <= 4 ? e + 8 : u32(e + 8)
      // 记下
      map.set(u16(e), { type, count, at })
    }
    // 返回
    return map
  }
  // 读文字
  const text = (en: Entry | undefined) => {
    // 没有
    if (!en) return undefined
    // 逐个字符拼起来（遇到 0 结束）
    let s = ''
    for (let i = 0; i < en.count; i++) {
      // 字符编码
      const c = v.getUint8(start + en.at + i)
      // 结尾
      if (c === 0) break
      // 拼上
      s += String.fromCharCode(c)
    }
    // 返回
    return s
  }
  // 读“度、分、秒”三个分数，换算成小数度
  const dms = (en: Entry | undefined) => {
    // 格式不对
    if (!en || en.type !== 5 || en.count < 3) return undefined
    // 读第 i 个分数
    const r = (i: number) => {
      // 分子、分母
      const num = u32(en.at + i * 8)
      const den = u32(en.at + i * 8 + 4)
      // 分母为 0 当作 0
      return den ? num / den : 0
    }
    // 度 + 分/60 + 秒/3600
    return r(0) + r(1) / 60 + r(2) / 3600
  }
  // 结果
  const out: ExifInfo = {}
  // 第一个目录（IFD0）
  const ifd0 = readIfd(u32(4))
  // 拍摄时间：Exif 子目录里的 DateTimeOriginal，没有就用 IFD0 的 DateTime
  const exifPtr = ifd0.get(TAG.exifPointer)
  const exif = exifPtr ? readIfd(u32(exifPtr.at)) : undefined
  const raw = text(exif?.get(TAG.dateTimeOriginal)) ?? text(ifd0.get(TAG.dateTime))
  // 格式 “2026:12:21 14:03:22” → “2026-12-21T14:03:22”
  const m = raw && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw)
  if (m && m[1] !== '0000') out.takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
  // GPS
  const gpsPtr = ifd0.get(TAG.gpsPointer)
  if (gpsPtr) {
    // GPS 子目录
    const gps = readIfd(u32(gpsPtr.at))
    // 纬度、经度
    const lat = dms(gps.get(TAG.lat))
    const lng = dms(gps.get(TAG.lng))
    // 南纬、西经是负数
    const latRef = text(gps.get(TAG.latRef))
    const lngRef = text(gps.get(TAG.lngRef))
    // 都有、而且不是 0,0（有的相机没定位时写 0）
    if (lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0)) {
      out.lat = latRef === 'S' ? -lat : lat
      out.lng = lngRef === 'W' ? -lng : lng
    }
  }
  // 返回
  return out
}
