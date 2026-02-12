'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function EmailTestPage() {
  const [testEmail, setTestEmail] = useState('phil@hfexteriors.com')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const supabase = createClient()

  async function sendTestEmail() {
    setLoading(true)
    setResult(null)

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('You must be logged in to send test emails')
        return
      }

      // Call the test API endpoint
      const response = await fetch(
        `/api/reports/send-test-weekly?testEmail=${encodeURIComponent(testEmail)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      const data = await response.json()

      if (data.success) {
        toast.success(`Test email sent successfully to ${testEmail}!`)
        setResult(data)
      } else {
        toast.error(`Failed to send email: ${data.error}`)
        setResult(data)
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error('Failed to send test email')
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  async function sendToAllFRMs() {
    if (!confirm('This will send emails to ALL active FRMs. Are you sure?')) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('You must be logged in')
        return
      }

      const response = await fetch('/api/reports/send-test-weekly', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Sent ${data.summary.frmEmailsSent} emails successfully!`)
        setResult(data)
      } else {
        toast.error(`Failed: ${data.error}`)
        setResult(data)
      }
    } catch (error) {
      console.error('Error sending emails:', error)
      toast.error('Failed to send emails')
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell fullWidth>
      <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Email Testing Dashboard
            </h1>
            <p className="text-gray-600 mb-6">
              Send test weekly reports to verify email formatting and delivery
            </p>

            {/* Test Single Email */}
            <div className="border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Send Test Email
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Sends a single test email with sample data from the first active FRM
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Email Address
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="phil@hfexteriors.com"
                />
              </div>

              <button
                onClick={sendTestEmail}
                disabled={loading || !testEmail}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>

            {/* Send to All FRMs */}
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Send to All Active FRMs
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                ⚠️ This will send real emails to all active FRMs with their actual weekly data
              </p>

              <button
                onClick={sendToAllFRMs}
                disabled={loading}
                className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Sending...' : 'Send to All FRMs'}
              </button>
            </div>

            {/* Results Display */}
            {result && (
              <div className={`border rounded-lg p-6 ${
                result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {result.success ? '✓ Success' : '✗ Failed'}
                </h3>

                {result.message && (
                  <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                )}

                {result.error && (
                  <p className="text-sm text-red-700 mb-2">Error: {result.error}</p>
                )}

                {result.summary && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-900">Summary:</p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4">
                      <li>• Week Range: {result.summary.weekRange}</li>
                      <li>• FRM Emails Sent: {result.summary.frmEmailsSent} / {result.summary.totalFRMs}</li>
                      {result.summary.frmEmailsFailed > 0 && (
                        <li className="text-red-600">• Failed: {result.summary.frmEmailsFailed}</li>
                      )}
                      <li>• Finance Email: {result.summary.financeEmailSent ? 'Sent' : 'Failed'}</li>
                      <li>• Execution Time: {result.summary.executionTime}</li>
                    </ul>
                  </div>
                )}

                {result.messageId && (
                  <p className="text-xs text-gray-500 mt-3">
                    Message ID: {result.messageId}
                  </p>
                )}

                {result.sampleData && (
                  <details className="mt-4">
                    <summary className="text-sm font-medium text-gray-900 cursor-pointer">
                      View Sample Data
                    </summary>
                    <pre className="mt-2 text-xs bg-white p-3 rounded border border-gray-200 overflow-auto">
                      {JSON.stringify(result.sampleData, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Documentation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
            <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• <strong>Test Email:</strong> Sends one email with sample data to verify formatting</li>
              <li>• <strong>All FRMs:</strong> Sends actual weekly reports to all active FRMs in the database</li>
              <li>• <strong>Date Range:</strong> Uses the previous week (Monday-Sunday)</li>
              <li>• <strong>Finance Report:</strong> Also sends a consolidated report to the finance team</li>
            </ul>
          </div>
        </div>
    </AppShell>
  )
}
