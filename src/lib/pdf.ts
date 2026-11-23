// ============================================================
// 把 PDF 的每一页转成 PNG 图片（用 Mozilla 的 pdf.js）
// 这个文件比较大，只在上传 PDF 时才加载
// ============================================================

// 引入 pdf.js（legacy 版本兼容更多 iPhone 系统版本）
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
// 引入 pdf.js 后台线程文件的地址
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// 告诉 pdf.js 后台线程文件在哪
GlobalWorkerOptions.workerSrc = workerUrl

// 最多转多少页（车票一般一两页）
const MAX_PAGES = 10
// 渲染宽度（像素），足够清楚地显示二维码
const TARGET_WIDTH = 1600

// 把 PDF 转成图片，返回每页的 PNG
export async function renderPdf(file: Blob): Promise<Blob[]> {
  // 读出文件内容
  const data = new Uint8Array(await file.arrayBuffer())
  // 打开 PDF（加载任务，最后用它来释放资源）
  const task = getDocument({ data })
  // 等待打开完成
  const pdf = await task.promise
  // 结果
  const pages: Blob[] = []
  // 逐页渲染
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGES); i++) {
    // 取出这一页
    const page = await pdf.getPage(i)
    // 原始尺寸
    const base = page.getViewport({ scale: 1 })
    // 放大到目标宽度
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width })
    // 画布
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    // 渲染这一页
    await page.render({ canvas, viewport }).promise
    // 裁掉四周的空白（二维码在全屏时会显示得更大）
    const out = trimWhitespace(canvas)
    // 导出 PNG（二维码用无损格式最清楚）
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'))
    // 加入结果
    if (blob) pages.push(blob)
    // 释放这一页的资源
    page.cleanup()
  }
  // 关闭 PDF，释放资源
  await task.destroy()
  // 返回
  return pages
}

// 裁掉画布四周的白边，保留 40 像素留白；内容几乎占满时原样返回
function trimWhitespace(canvas: HTMLCanvasElement): HTMLCanvasElement {
  // 画布尺寸
  const { width: w, height: h } = canvas
  // 读取所有像素
  const ctx = canvas.getContext('2d')
  // 读不了就原样返回
  if (!ctx) return canvas
  // 像素数据（每 4 个数是一个像素的 红、绿、蓝、透明度）
  const px = ctx.getImageData(0, 0, w, h).data
  // 内容的边界
  let top = h
  let left = w
  let right = -1
  let bottom = -1
  // 逐行逐列找“不是白色”的像素
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 这个像素在数组里的位置
      const i = (y * w + x) * 4
      // 透明或者接近白色就跳过
      if (px[i + 3] < 10 || (px[i] > 245 && px[i + 1] > 245 && px[i + 2] > 245)) continue
      // 更新边界
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  // 整页都是白的
  if (right < 0) return canvas
  // 留白
  const pad = 40
  // 裁剪区域（不超出画布）
  const x0 = Math.max(0, left - pad)
  const y0 = Math.max(0, top - pad)
  const x1 = Math.min(w, right + pad)
  const y1 = Math.min(h, bottom + pad)
  // 裁掉的部分很少（不到 10%），不值得裁
  if ((x1 - x0) * (y1 - y0) > w * h * 0.9) return canvas
  // 新画布
  const out = document.createElement('canvas')
  out.width = x1 - x0
  out.height = y1 - y0
  // 白色底（PDF 页面本来是白底）
  const octx = out.getContext('2d')!
  octx.fillStyle = '#fff'
  octx.fillRect(0, 0, out.width, out.height)
  // 把内容区域画过来
  octx.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  // 返回
  return out
}
