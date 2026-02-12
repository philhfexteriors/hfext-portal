/**
 * Email helper functions for sending weekly reports via Resend
 */

import { Resend } from 'resend'
import { render } from '@react-email/components'
import WeeklyFRMReport from '@/emails/frm/WeeklyFRMReport'
import WeeklyFinanceReport from '@/emails/frm/WeeklyFinanceReport'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Validate email address format
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmailAddress(email) {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Send weekly report to individual FRM
 * @param {Object} frm - FRM object with name and email
 * @param {Object} metrics - Visit metrics for the FRM
 * @param {string} weekRange - Formatted date range string
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendFRMWeeklyReport(frm, metrics, weekRange) {
  try {
    // Validate email
    if (!validateEmailAddress(frm.email)) {
      throw new Error(`Invalid email address: ${frm.email}`)
    }

    // Render email HTML
    const emailHtml = await render(
      WeeklyFRMReport({
        frmName: frm.name,
        weekRange,
        totalVisits: metrics.totalVisits,
        dailyBreakdown: metrics.dailyBreakdown,
        weekOverWeekChange: metrics.weekOverWeekChange,
        ytdVisits: metrics.ytdVisits
      })
    )

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'FRM Dashboard <onboarding@resend.dev>',
      to: frm.email,
      subject: `Your Weekly Visit Report - ${weekRange}`,
      html: emailHtml
    })

    if (error) {
      throw new Error(error.message || 'Failed to send email')
    }

    return {
      success: true,
      messageId: data?.id
    }
  } catch (error) {
    console.error(`Failed to send email to ${frm.name} (${frm.email}):`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Send consolidated weekly report to finance department
 * @param {Object} consolidatedMetrics - Aggregated metrics for all FRMs
 * @param {string} weekRange - Formatted date range string
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendFinanceWeeklyReport(consolidatedMetrics, weekRange) {
  try {
    const financeEmail = process.env.FINANCE_EMAIL

    if (!financeEmail) {
      throw new Error('FINANCE_EMAIL environment variable not set')
    }

    if (!validateEmailAddress(financeEmail)) {
      throw new Error(`Invalid finance email address: ${financeEmail}`)
    }

    // Render email HTML
    const emailHtml = await render(
      WeeklyFinanceReport({
        weekRange,
        totalVisitsAllFRMs: consolidatedMetrics.totalVisits,
        frmBreakdown: consolidatedMetrics.frmBreakdown,
        dailyBreakdownAll: consolidatedMetrics.dailyBreakdownAll,
        weekOverWeekChange: consolidatedMetrics.weekOverWeekChange
      })
    )

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'FRM Dashboard <onboarding@resend.dev>',
      to: financeEmail,
      subject: `Finance Department - Weekly Visit Report - ${weekRange}`,
      html: emailHtml
    })

    if (error) {
      throw new Error(error.message || 'Failed to send email')
    }

    return {
      success: true,
      messageId: data?.id
    }
  } catch (error) {
    console.error('Failed to send finance email:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Send test email to specified address
 * @param {string} testEmail - Email address to send test to
 * @param {Object} sampleData - Sample metrics data
 * @param {string} weekRange - Formatted date range string
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendTestEmail(testEmail, sampleData, weekRange) {
  try {
    if (!validateEmailAddress(testEmail)) {
      throw new Error(`Invalid test email address: ${testEmail}`)
    }

    // Render email HTML with sample data
    const emailHtml = await render(
      WeeklyFRMReport({
        frmName: sampleData.frmName || 'Test User',
        weekRange,
        totalVisits: sampleData.totalVisits || 42,
        dailyBreakdown: sampleData.dailyBreakdown || [],
        weekOverWeekChange: sampleData.weekOverWeekChange || { change: 5, percentage: 13 },
        ytdVisits: sampleData.ytdVisits || 150
      })
    )

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'FRM Dashboard <onboarding@resend.dev>',
      to: testEmail,
      subject: `[TEST] Weekly Visit Report - ${weekRange}`,
      html: emailHtml
    })

    if (error) {
      throw new Error(error.message || 'Failed to send test email')
    }

    return {
      success: true,
      messageId: data?.id
    }
  } catch (error) {
    console.error('Failed to send test email:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
