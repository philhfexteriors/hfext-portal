'use client'

import Link from 'next/link'
import type { AppAccess } from '@/lib/auth/roles'

const ICONS: Record<string, string> = {
  megaphone: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  'currency-dollar': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'wrench-screwdriver': 'M11.42 15.17l-5.384 5.384a2.025 2.025 0 01-2.862-2.862L8.554 12.3M15.42 8.83l5.384-5.384a2.025 2.025 0 00-2.862-2.862L12.554 6.3M3 21l5-5m0 0l2-2m-2 2l-2 2m4-4l5-5m0 0l2-2',
}

const APP_ICONS: Record<string, string> = {
  'chart-bar': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  'map-pin': 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  'document-text': 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  calculator: 'M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z',
}

interface DepartmentCardProps {
  slug: string
  name: string
  icon: string | null
  apps: AppAccess[]
}

export default function DepartmentCard({ name, icon, apps }: DepartmentCardProps) {
  const iconPath = icon ? ICONS[icon] : null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {iconPath && (
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        )}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {name}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => {
          const appIconPath = app.icon ? APP_ICONS[app.icon] : null
          return (
            <Link
              key={app.app_slug}
              href={app.base_path}
              className="group block p-5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-[#A30A32]/30 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                {appIconPath && (
                  <div className="w-10 h-10 rounded-lg bg-[#A30A32]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#A30A32]/20 transition-colors">
                    <svg
                      className="w-5 h-5 text-[#A30A32]"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={appIconPath} />
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#A30A32] transition-colors">
                    {app.display_name}
                  </h3>
                  {app.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {app.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
