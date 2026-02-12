/**
 * Manual trigger route for testing weekly reports
 * Protected by authentication - only logged-in users can access
 * Supports custom date ranges and test email addresses
 */

import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/frm-server'
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
import { sendFRMWeeklyReport, sendFinanceWeeklyReport, sendTestEmail } from '@/lib/frm/reports/emailHelpers'
import { getPreviousWeekRange, formatDateRange, getYearStart } from '@/lib/frm/reports/dateUtils'

export async function GET(request) {
  const startTime = Date.now()

  try {
    // Authentication: Verify user is logged in
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 })
    }

    console.log('[Test Reports] Manual trigger initiated by:', user.email)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const testEmail = searchParams.get('testEmail')
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')

    // Determine date range
    let startDate, endDate
    if (customStartDate && customEndDate) {
      startDate = customStartDate
      endDate = customEndDate
      console.log('[Test Reports] Using custom date range:', startDate, 'to', endDate)
    } else {
      const range = getPreviousWeekRange()
      startDate = range.startDate
      endDate = range.endDate
      console.log('[Test Reports] Using previous week range:', startDate, 'to', endDate)
    }

    const weekRange = formatDateRange(startDate, endDate)

    // If test email is provided, send only to that email with sample data
    if (testEmail) {
      console.log('[Test Reports] Sending test email to:', testEmail)

      // Get sample FRM for realistic data
      const activeFRMs = await getActiveFRMs()
      if (activeFRMs.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active FRMs found to generate sample data'
        }, { status: 400 })
      }

      const sampleFRM = activeFRMs[0]

      // Gather real metrics for sample FRM
      const totalVisits = await getFRMWeeklyMetrics(sampleFRM.id, startDate, endDate)
      const dailyBreakdown = await getDailyVisitBreakdown(sampleFRM.id, startDate, endDate)
      const weekOverWeekChange = await getWeekOverWeekChange(sampleFRM.id, startDate, endDate)
      const ytdVisits = await getYTDVisitCount(sampleFRM.id, getYearStart())

      const sampleData = {
        frmName: 'Test User',
        totalVisits,
        dailyBreakdown,
        weekOverWeekChange,
        ytdVisits
      }

      const result = await sendTestEmail(testEmail, sampleData, weekRange)

      if (result.success) {
        console.log('[Test Reports] ✓ Test email sent successfully')
        return NextResponse.json({
          success: true,
          message: `Test email sent to ${testEmail}`,
          messageId: result.messageId,
          sampleData,
          executionTime: `${Date.now() - startTime}ms`
        })
      } else {
        console.error('[Test Reports] ✗ Failed to send test email:', result.error)
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 })
      }
    }

    // Otherwise, send to all active FRMs and finance (same as cron job)
    const activeFRMs = await getActiveFRMs()
    console.log(`[Test Reports] Found ${activeFRMs.length} active FRMs`)

    if (activeFRMs.length === 0) {
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
      console.log(`[Test Reports] Processing batch ${Math.floor(i / batchSize) + 1}`)

      const batchPromises = batch.map(async (frm) => {
        try {
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

          const result = await sendFRMWeeklyReport(frm, metrics, weekRange)

          if (result.success) {
            console.log(`[Test Reports] ✓ Sent email to ${frm.name}`)
          } else {
            console.error(`[Test Reports] ✗ Failed to send to ${frm.name}:`, result.error)
          }

          return {
            frmId: frm.id,
            frmName: frm.name,
            frmEmail: frm.email,
            ...result
          }
        } catch (error) {
          console.error(`[Test Reports] ✗ Error processing ${frm.name}:`, error)
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

    // Send finance report
    console.log('[Test Reports] Sending finance department report...')

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
      console.log('[Test Reports] ✓ Sent finance email')
    } else {
      console.error('[Test Reports] ✗ Failed to send finance email:', financeResult.error)
    }

    // Summary
    const successfulFRMEmails = frmResults.filter(r => r.success).length
    const failedFRMEmails = frmResults.filter(r => !r.success).length
    const executionTime = `${Date.now() - startTime}ms`

    console.log('[Test Reports] Complete:')
    console.log(`  - FRM emails: ${successfulFRMEmails}/${activeFRMs.length} sent`)
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
    console.error('[Test Reports] Fatal error:', error)
    Sentry.captureException(error)

    return NextResponse.json({
      success: false,
      error: error.message,
      executionTime
    }, { status: 500 })
  }
}
