import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import PDFDocument from 'pdfkit'

/**
 * GET /api/quotations/[id]/export?format=pdf
 * 產出報價單 PDF，可直接下載或分享
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: {
        select: { name: true, code: true, address: true, phone: true, contactPerson: true, taxId: true },
      },
      createdBy: { select: { name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
  })

  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build PDF in memory
  const chunks: Buffer[] = []
  const doc = new PDFDocument({ size: 'A4', margin: 50 })

  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  // ── Header ──
  doc.fontSize(20).text('ComfortPlus', { align: 'center' })
  doc.fontSize(10).text('康加護理用品有限公司', { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(16).text('報 價 單', { align: 'center' })
  doc.moveDown(1)

  // ── Quotation Info ──
  const infoY = doc.y
  doc.fontSize(9)
  doc.text(`報價單號：${quotation.quotationNo}`, 50, infoY)
  doc.text(`日　　期：${new Date(quotation.createdAt).toLocaleDateString('zh-TW')}`, 50, infoY + 14)
  doc.text(`有 效 期：${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('zh-TW') : '—'}`, 50, infoY + 28)
  doc.text(`業　　務：${quotation.createdBy.name}`, 50, infoY + 42)

  doc.text(`客戶名稱：${quotation.customer.name}`, 300, infoY)
  doc.text(`客戶代碼：${quotation.customer.code}`, 300, infoY + 14)
  doc.text(`聯 絡 人：${quotation.customer.contactPerson ?? '—'}`, 300, infoY + 28)
  doc.text(`電　　話：${quotation.customer.phone ?? '—'}`, 300, infoY + 42)
  if (quotation.customer.address) {
    doc.text(`地　　址：${quotation.customer.address}`, 300, infoY + 56)
  }

  doc.moveDown(5)

  // ── Items Table ──
  const tableTop = doc.y
  const colX = { no: 50, name: 75, sku: 230, qty: 310, unit: 350, price: 385, disc: 440, sub: 485 }
  const colW = { no: 25, name: 155, sku: 80, qty: 40, unit: 35, price: 55, disc: 45, sub: 60 }

  // Table header
  doc.rect(50, tableTop, 495, 18).fill('#f1f5f9').stroke('#e2e8f0')
  doc.fillColor('#334155').fontSize(8)
  doc.text('#', colX.no + 2, tableTop + 4, { width: colW.no })
  doc.text('品名', colX.name + 2, tableTop + 4, { width: colW.name })
  doc.text('料號', colX.sku + 2, tableTop + 4, { width: colW.sku })
  doc.text('數量', colX.qty + 2, tableTop + 4, { width: colW.qty, align: 'right' })
  doc.text('單位', colX.unit + 2, tableTop + 4, { width: colW.unit })
  doc.text('單價', colX.price + 2, tableTop + 4, { width: colW.price, align: 'right' })
  doc.text('折扣', colX.disc + 2, tableTop + 4, { width: colW.disc, align: 'right' })
  doc.text('小計', colX.sub + 2, tableTop + 4, { width: colW.sub, align: 'right' })

  // Table rows
  let rowY = tableTop + 18
  doc.fillColor('#1e293b')
  quotation.items.forEach((item, i) => {
    const h = 16
    if (i % 2 === 1) {
      doc.rect(50, rowY, 495, h).fill('#f8fafc').fillColor('#1e293b')
    }
    doc.rect(50, rowY, 495, h).stroke('#e2e8f0')

    doc.fontSize(8)
    doc.text(`${i + 1}`, colX.no + 2, rowY + 4, { width: colW.no })
    doc.text(item.product.name, colX.name + 2, rowY + 4, { width: colW.name })
    doc.text(item.product.sku, colX.sku + 2, rowY + 4, { width: colW.sku })
    doc.text(`${item.quantity}`, colX.qty + 2, rowY + 4, { width: colW.qty, align: 'right' })
    doc.text(item.product.unit, colX.unit + 2, rowY + 4, { width: colW.unit })
    doc.text(fmtNum(Number(item.unitPrice)), colX.price + 2, rowY + 4, { width: colW.price, align: 'right' })
    doc.text(Number(item.discount) > 0 ? `${item.discount}%` : '—', colX.disc + 2, rowY + 4, { width: colW.disc, align: 'right' })
    doc.text(fmtNum(Number(item.subtotal)), colX.sub + 2, rowY + 4, { width: colW.sub, align: 'right' })

    rowY += h
  })

  // Total row
  doc.rect(50, rowY, 495, 20).fill('#e2e8f0').stroke('#cbd5e1')
  doc.fillColor('#0f172a').fontSize(10)
  doc.text('合　計', colX.price - 60, rowY + 5, { width: 100, align: 'right' })
  doc.text(`NT$ ${fmtNum(Number(quotation.totalAmount))}`, colX.sub + 2, rowY + 5, { width: colW.sub, align: 'right' })

  // ── Footer ──
  doc.fillColor('#64748b').fontSize(8)
  const footerY = rowY + 40
  if (quotation.paymentTerm) {
    doc.text(`付款條件：${quotation.paymentTerm}`, 50, footerY)
  }
  if (quotation.deliveryTerm) {
    doc.text(`交貨條件：${quotation.deliveryTerm}`, 50, footerY + 14)
  }
  if (quotation.notes) {
    doc.text(`備　　註：${quotation.notes}`, 50, footerY + 28)
  }

  // Signature area
  const sigY = footerY + 70
  doc.fillColor('#94a3b8').fontSize(8)
  doc.text('報價人簽章：_______________', 50, sigY)
  doc.text('客戶簽章：_______________', 300, sigY)
  doc.text('日期：_______________', 300, sigY + 20)

  doc.end()

  // Wait for PDF to finish
  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quotation.quotationNo}.pdf"`,
    },
  })
}

function fmtNum(n: number): string {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
