import { redirect } from 'next/navigation'

// L'essence de l'app : la Forge. Le générateur EST la page d'accueil.
export default function Home() {
  redirect('/generator')
}
