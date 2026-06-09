import { Suspense } from 'react'
import LoginClient from './LoginClient'

export const metadata = { title: 'Connexion — ARETE' }

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  )
}
