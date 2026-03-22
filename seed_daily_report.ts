import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const ADMIN_ID    = 'cmmudbueu00032lvwymspaoto'
const SALES_ID    = 'cmmudbul900042lvwhqbwnv98'
const C_TAIPEI    = 'cmmudbumv000l2lvwffg4131u'
const C_BANCIAO   = 'cmmudbumy000m2lvwyv3dzhpo'
const C_TAICHUNG  = 'cmmudbun0000n2lvwjsxdkg1z'

async function main() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const threeDaysAgo = new Date(today); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  console.log('🌱 開始插入業務日報假資料...')

  // 1. 今天的聯絡紀錄
  await prisma.followUpLog.createMany({
    data: [
      {
        customerId: C_TAIPEI,
        createdById: SALES_ID,
        logDate: new Date(today.getTime() + 9 * 3600_000),
        logType: 'CALL',
        method: 'PHONE',
        content: '電話確認上週送出的護墊樣品使用情況，護理長表示吸收效果不錯，詢問是否有更厚款式',
        result: '客戶對樣品滿意，表示有採購意願，需等月底採購會議決定',
        customerReaction: 'POSITIVE',
        nextFollowUpDate: new Date(today.getTime() + 7 * 86400_000),
        nextAction: '下週四再電話確認採購會議結果',
        hasSample: false, hasQuote: false, hasOrder: false, taskCreated: false, isFollowUp: true,
      },
      {
        customerId: C_BANCIAO,
        createdById: SALES_ID,
        logDate: new Date(today.getTime() + 10.5 * 3600_000),
        logType: 'FIRST_VISIT',
        method: 'ONSITE',
        content: '首次拜訪板橋長青安養中心，與院長及照護主任會面。介紹舒適加全系列失禁護理產品，重點說明 C+ Pro 成人尿布的透氣設計與防漏側邊',
        result: '院長對產品有興趣，詢問是否可提供 2 週試用。主任關注大量採購折扣條件',
        customerReaction: 'POSITIVE',
        nextFollowUpDate: new Date(today.getTime() + 3 * 86400_000),
        nextAction: '安排送樣，並準備報價單',
        hasSample: true,
        sampleItems: 'C+ Pro 成人尿布 M/L 各 10 片、濕式衛生紙 2 包',
        hasQuote: false, hasOrder: false, taskCreated: false, isFollowUp: true,
      },
      {
        customerId: C_TAICHUNG,
        createdById: SALES_ID,
        logDate: new Date(today.getTime() + 14 * 3600_000),
        logType: 'LINE',
        method: 'LINE',
        content: '透過 LINE 傳送最新報價單給採購部門主任，同時附上產品規格比較表，確認本月底前可到貨',
        result: '主任收到報價，說本週內會回覆，目前與另一廠商比較中',
        customerReaction: 'NEUTRAL',
        nextFollowUpDate: new Date(today.getTime() + 5 * 86400_000),
        nextAction: '週五追蹤報價結果，必要時提供額外優惠條件',
        hasSample: false, hasQuote: true, hasOrder: false, taskCreated: false, isFollowUp: true,
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ FollowUpLog 今天 3 筆')

  // 2. 今天的行程
  await prisma.salesSchedule.createMany({
    data: [
      {
        customerId: C_BANCIAO,
        salesRepId: SALES_ID,
        createdById: SALES_ID,
        scheduleDate: today,
        startTime: new Date(today.getTime() + 10 * 3600_000),
        endTime:   new Date(today.getTime() + 12 * 3600_000),
        location: '新北市板橋區中山路一段 168 號（長青安養中心 1F）',
        scheduleType: 'FIRST_VISIT',
        preReminder: '帶型錄、名片、樣品提袋。先 Google 評論了解客戶口碑',
        postResult: '拜訪順利，院長親自接待，對產品印象良好。已約好下週四再次拜訪',
        isCompleted: true,
        notes: '停車場在建物旁，訪客停車 30 分鐘免費',
      },
      {
        customerId: C_TAIPEI,
        salesRepId: SALES_ID,
        createdById: SALES_ID,
        scheduleDate: today,
        startTime: new Date(today.getTime() + 15 * 3600_000),
        endTime:   new Date(today.getTime() + 16 * 3600_000),
        location: '台北市松山區民生東路五段 55 號（護理之家 2F）',
        scheduleType: 'SECOND_VISIT',
        preReminder: '確認上次送出的樣品反饋，準備優惠報價條件，目標本次拿到訂單',
        postResult: null,
        isCompleted: false,
        notes: '下午 3 點與護理長約好，請勿遲到',
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ SalesSchedule 今天 2 筆')

  // 3. 今天的業務事件
  await prisma.salesEvent.createMany({
    data: [
      {
        customerId: C_TAICHUNG,
        assignedToId: SALES_ID,
        createdById: SALES_ID,
        eventType: 'OTHER',
        eventDate: new Date(today.getTime() + 14.5 * 3600_000),
        items: 'C+ Pro 成人尿布 M 號 x 500 片、L 號 x 300 片、C+ 照護濕紙巾 x 50 包',
        quantity: 850,
        amount: 62500,
        isCompleted: false,
        notes: '報價發送，有效期 30 天，含運費至台中市區',
      },
      {
        customerId: C_TAIPEI,
        assignedToId: SALES_ID,
        createdById: ADMIN_ID,
        eventType: 'DELIVERY',
        eventDate: new Date(today.getTime() + 8.5 * 3600_000),
        items: 'C+ 輕薄護墊 M 號 x 20 片、C+ 輕薄護墊 L 號 x 20 片（樣品）',
        quantity: 40,
        isCompleted: true,
        notes: '快遞寄出，預計明日到達',
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ SalesEvent 今天 2 筆')

  // 4. 待辦任務
  await prisma.salesTask.createMany({
    data: [
      {
        title: '台中博愛醫院 — 追蹤報價回覆',
        description: '報價單於今日發出，週五前追蹤採購主任確認意願，若有競爭對手需瞭解價差',
        taskType: 'FOLLOW_UP',
        priority: 'HIGH',
        status: 'PENDING',
        dueDate: new Date(today.getTime() + 5 * 86400_000 + 17 * 3600_000),
        customerId: C_TAICHUNG,
        assignedToId: SALES_ID,
        createdById: SALES_ID,
        notes: '若本週未收到回覆，下週一主動電話追蹤',
      },
      {
        title: '板橋長青安養中心 — 安排送樣',
        description: '首訪後已答應送樣，本週內需安排快遞，並於 3 天後追蹤使用反饋',
        taskType: 'OTHER',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: new Date(today.getTime() + 1 * 86400_000 + 12 * 3600_000),
        customerId: C_BANCIAO,
        assignedToId: SALES_ID,
        createdById: SALES_ID,
        notes: '準備 M/L 各 10 片',
      },
      {
        title: '松山護理之家 — 月度回購提醒（逾期）',
        description: '客戶上月底訂單已快消耗完，主動提醒補貨，避免客戶轉向其他廠商',
        taskType: 'CALL',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: new Date(yesterday.getTime() + 17 * 3600_000),
        customerId: C_TAIPEI,
        assignedToId: SALES_ID,
        createdById: ADMIN_ID,
        notes: '上次訂單為 3/5，約每月定期採購',
      },
      {
        title: '整理本週拜訪記錄並回報主管',
        description: '每週五前需將拜訪紀錄、新增客戶資訊整理後回報業務主管',
        taskType: 'ADMIN',
        priority: 'LOW',
        status: 'PENDING',
        dueDate: new Date(today.getTime() + 4 * 86400_000 + 17 * 3600_000),
        customerId: null,
        assignedToId: SALES_ID,
        createdById: ADMIN_ID,
        notes: '含客戶聯繫次數、樣品發放統計、報價追蹤狀況',
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ SalesTask 4 筆')

  // 5. 本週稍早紀錄（讓週統計有數字）
  await prisma.followUpLog.createMany({
    data: [
      {
        customerId: C_TAIPEI,
        createdById: SALES_ID,
        logDate: new Date(yesterday.getTime() + 11 * 3600_000),
        logType: 'EMAIL',
        method: 'EMAIL',
        content: '發送護理用品採購提案 PDF，含三個方案比較',
        result: '對方收到，表示會轉給採購主任',
        customerReaction: 'NEUTRAL',
        hasSample: false, hasQuote: false, hasOrder: false, taskCreated: false, isFollowUp: true,
      },
      {
        customerId: C_BANCIAO,
        createdById: SALES_ID,
        logDate: new Date(yesterday.getTime() + 14 * 3600_000),
        logType: 'CALL',
        method: 'PHONE',
        content: '電話預約今日首訪時間，確認院長和主任都在',
        result: '約定今日上午 10:00 拜訪',
        customerReaction: 'POSITIVE',
        hasSample: false, hasQuote: false, hasOrder: false, taskCreated: false, isFollowUp: true,
      },
      {
        customerId: C_TAICHUNG,
        createdById: SALES_ID,
        logDate: new Date(threeDaysAgo.getTime() + 16 * 3600_000),
        logType: 'CALL',
        method: 'PHONE',
        content: '電話詢問是否需要新一季商品型錄及報價，客戶表示有需求',
        result: '確認需要 M/L/XL 三種尺寸報價，下週發送',
        customerReaction: 'POSITIVE',
        hasSample: false, hasQuote: false, hasOrder: false, taskCreated: false, isFollowUp: true,
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ 本週稍早紀錄 3 筆')

  console.log('\n🎉 假資料插入完成！請到「業務日報」頁面查看效果。')
}

main().catch(console.error).finally(() => prisma.$disconnect())
