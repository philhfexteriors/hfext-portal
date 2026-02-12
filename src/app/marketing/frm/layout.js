import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'FRM Dashboard | H&F Exteriors',
  description: 'Field Representative Manager Visit Tracking Dashboard',
}

export default function FRMLayout({ children }) {
  return (
    <>
      <Toaster position="top-right" />
      {children}
    </>
  )
}
