/**
 * Vercel Cron Job: Send Weekly Reports
 * Runs every Monday at 7:00 AM EST (12:00 PM UTC)
 * Sends personalized reports to each active FRM and consolidated report to finance
 */

import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import {
  getActiveFRMs,
  getFRMWeeklyMetrics,
  getDailyVisitBreakdown,
  getDailyVisitBreakdownAllFRMs,
  getAllFRMsWeeklyBreakdown,
  getWeekOverWeekChange,
  getWeekOverWeekChangeAllFRMs,
  getYTDVisitCount
} from '@/lib/frm/reports/weeklyMetrics'
import { sendFRMWeeklyReport, sendFinanceWeeklyReport } from '@/lib/frm/reports/emailHelpers'
import { getPreviousWeekRange, formatDateRange, getYearStart } from '@/lib/frm/reports/dateUtils'

export async function GET(request) {
  const startTime = Date.now()

  try {
    // Security: Validate cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[Weekly Reports] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Weekly Reports] Starting cron job at', new Date().toISOString())

    // Get previous week date range
    const { startDate, endDate } = getPreviousWeekRange()
    const weekRange = formatDateRange(startDate, endDate)
    console.log('[Weekly Reports] Date range:', weekRange, `(${startDate} to ${endDate})`)

    // Fetch all active FRMs
    const activeFRMs = await getActiveFRMs()
    console.log(`[Weekly Reports] Found ${activeFRMs.length} active FRMs`)

    if (activeFRMs.length === 0) {
      console.log('[Weekly Reports] No active FRMs found, skipping email send')
      return NextResponse.json({
        success: true,
        message: 'No active FRMs to send reports to',
        executionTime: `${Date.now() - startTime}ms`
      })
    }

    // Send individual FRM reports in batches
    const batchSize = 10
    const frmResults = []

    for (let i = 0; i < activeFRMs.length; i += batchSize) {
      const batch = activeFRMs.slice(i, i + batchSize)
      console.log(`[Weekly Reports] Processing batch ${Math.floor(i / batchSize) + 1} (FRMs ${i + 1}-${Math.min(i + batchSize, activeFRMs.length)})`)

      const batchPromises = batch.map(async (frm) => {
        try {
          // Gather metrics for this FRM
          const totalVisits = await getFRMWeeklyMetrics(frm.id, startDate, endDate)
          const dailyBreakdown = await getDailyVisitBreakdown(frm.id, startDate, endDate)
          const weekOverWeekChange = await getWeekOverWeekChange(frm.id, startDate, endDate)
          const ytdVisits = await getYTDVisitCount(frm.id, getYearStart())

          const metrics = {
            totalVisits,
            dailyBreakdown,
            weekOverWeekChange,
            ytdVisits
          }

          // Send email
          const result = await sendFRMWeeklyReport(frm, metrics, weekRange)

          if (result.success) {
            console.log(`[Weekly Reports] ✓ Sent email to ${frm.name} (${frm.email})`)
          } else {
            console.error(`[Weekly Reports] ✗ Failed to send to ${frm.name} (${frm.email}):`, result.error)
          }

          return {
            frmId: frm.id,
            frmName: frm.name,
            frmEmail: frm.email,
            ...result
          }
        } catch (error) {
          console.error(`[Weekly Reports] ✗ Error processing ${frm.name}:`, error)
          return {
            frmId: frm.id,
            frmName: frm.name,
            frmEmail: frm.email,
            success: false,
            error: error.message
          }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)
      frmResults.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }))
    }

    // Send consolidated finance report
    console.log('[Weekly Reports] Sending finance department report...')

    const frmBreakdown = await getAllFRMsWeeklyBreakdown(startDate, endDate)
    const dailyBreakdownAll = await getDailyVisitBreakdownAllFRMs(startDate, endDate)
    const weekOverWeekChangeAll = await getWeekOverWeekChangeAllFRMs(startDate, endDate)

    const consolidatedMetrics = {
      totalVisits: frmBreakdown.reduce((sum, frm) => sum + frm.visitCount, 0),
      frmBreakdown,
      dailyBreakdownAll,
      weekOverWeekChange: weekOverWeekChangeAll
    }

    const financeResult = await sendFinanceWeeklyReport(consolidatedMetrics, weekRange)

    if (financeResult.success) {
      console.log('[Weekly Reports] ✓ Sent finance email')
    } else {
      console.error('[Weekly Reports] ✗ Failed to send finance email:', financeResult.error)
    }

    // Calculate summary stats
    const successfulFRMEmails = frmResults.filter(r => r.success).length
    const failedFRMEmails = frmResults.filter(r => !r.success).length
    const executionTime = `${Date.now() - startTime}ms`

    console.log('[Weekly Reports] Complete:')
    console.log(`  - FRM emails: ${successfulFRMEmails}/${activeFRMs.length} sent successfully`)
    console.log(`  - Finance email: ${financeResult.success ? 'sent' : 'failed'}`)
    console.log(`  - Execution time: ${executionTime}`)

    return NextResponse.json({
      success: true,
      summary: {
        weekRange,
        totalFRMs: activeFRMs.length,
        frmEmailsSent: successfulFRMEmails,
        frmEmailsFailed: failedFRMEmails,
        financeEmailSent: financeResult.success,
        executionTime
      },
      frmResults,
      financeResult
    })

  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`
    console.error('[Weekly Reports] Fatal error:', error)
    Sentry.captureException(error)

    return NextResponse.json({
      success: false,
      error: error.message,
      executionTime
    }, { status: 500 })
  }
}
