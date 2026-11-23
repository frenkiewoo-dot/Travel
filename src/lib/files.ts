// ============================================================
// 处理上传的车票文件
//   - 图片：太大的照片（长边超过 2600 像素）缩小一点，节省手机空间；截图一般不用动
//   - PDF：保存原件，同时把每一页转成高清图片（离线秒开、全屏看二维码更清楚）
// ============================================================

// 处理好、准备存进数据库的文件（还没有 ID 和车票 ID）
export interface PreparedFile {
  // 临时 key（界面列表用）
  key: string
  // 文件名
  name: string
  // 类型
  mime: string
  // 内容
  blob: Blob
  // PDF 转出来的图片：对应原 PDF 的 key 和第几页
  pdfKey?: string
  page?: number
}

// 图片最长边（像素）
const MAX_SIDE = 2600

// 处理用户选的一批文件；onProgress 用来显示进度文字
export async function prepareFiles(list: FileList | File[], onProgress?: (msg: string) => void): Promise<PreparedFile[]> {
  // 结果
  const out: PreparedFile[] = []
  // 逐个文件处理
  for (const f of Array.from(list)) {
    // PDF
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      // 提示
      onProgress?.(`正在处理 ${f.name}…`)
      // 原件的 key
      const key = crypto.randomUUID()
      // 保存原件
      out.push({ key, name: f.name, mime: 'application/pdf', blob: f })
      // 按需加载 PDF 处理库（比较大，不放在首屏里）
      const { renderPdf } = await import('./pdf')
      // 每页转成图片
      const pages = await renderPdf(f)
      // 加入结果
      pages.forEach((blob, i) => out.push({ key: crypto.randomUUID(), name: `${f.name} 第 ${i + 1} 页`, mime: 'image/png', blob, pdfKey: key, page: i + 1 }))
      continue
    }
    // 图片
    if (f.type.startsWith('image/')) {
      // 提示
      onProgress?.(`正在处理 ${f.name}…`)
      // 太大就缩小
      out.push({ key: crypto.randomUUID(), name: f.name, ...(await shrinkImage(f)) })
      continue
    }
    // 其他类型不支持，跳过
  }
  // 返回
  return out
}

// 缩小过大的图片；不需要缩小时原样返回
async function shrinkImage(f: File): Promise<{ mime: string; blob: Blob }> {
  try {
    // 解码图片
    const bmp = await createImageBitmap(f)
    // 最长边
    const side = Math.max(bmp.width, bmp.height)
    // 不大：原样保存
    if (side <= MAX_SIDE) {
      bmp.close()
      return { mime: f.type, blob: f }
    }
    // 缩放比例
    const k = MAX_SIDE / side
    // 画到画布上
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    // 画图
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    // 释放
    bmp.close()
    // 导出成高质量 JPEG
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
    // 导出失败就用原图
    return blob ? { mime: 'image/jpeg', blob } : { mime: f.type, blob: f }
  } catch {
    // 解码失败（例如浏览器不支持的格式）：原样保存
    return { mime: f.type, blob: f }
  }
}
