import { redirect } from 'next/navigation'

// L'essence de l'app : l'Atelier. Le générateur EST la page d'accueil.
export default function Home() {
  redirect('/generator')
}
