import UserProfileClient from './UserProfileClient'

export const dynamic = 'force-dynamic'

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <UserProfileClient userId={id} />
}
