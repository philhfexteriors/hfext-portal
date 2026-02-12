'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">An unexpected error occurred.</p>
            <button
              onClick={() => reset()}
              className="bg-[#9D2235] text-white px-6 py-2 rounded-lg hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
