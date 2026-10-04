import { AppRouter } from '@/app/router'
import { AppProviders } from '@/app/providers'
import { AuthUrlErrorNotice } from '@/features/auth/components/auth-url-error-notice'

export default function App() {
  return (
    <AppProviders>
      <AuthUrlErrorNotice />
      <AppRouter />
    </AppProviders>
  )
}