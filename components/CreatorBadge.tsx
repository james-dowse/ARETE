interface CreatorUser {
  firstName?: string | null
  lastName?: string | null
  email?: string
  avatarUrl?: string | null
}

export function creatorName(user: CreatorUser | null | undefined): string {
  if (!user) return ''
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email?.split('@')[0] || ''
}

// Filigrane casque spartiate — même technique que le watermark SVG bas-opacité
// du hero dashboard (app/(app)/dashboard/page.tsx), mais dessiné comme un
// casque stylisé (dôme + crête + fentes des yeux) plutôt qu'un simple cercle,
// et à une opacité plus élevée puisqu'ici c'est l'élément principal de l'avatar.
function HelmetWatermark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" opacity={0.45} style={{ display: 'block' }}>
      <path
        d="M50 8 C28 8 14 26 14 48 C14 62 18 74 24 86 L34 86 C30 76 28 64 30 52 C31 46 34 42 38 40 L38 58 C38 64 41 68 46 70 L46 44 C47 43 48 43 50 43 C52 43 53 43 54 44 L54 70 C59 68 62 64 62 58 L62 40 C66 42 69 46 70 52 C72 64 70 76 66 86 L76 86 C82 74 86 62 86 48 C86 26 72 8 50 8 Z"
        stroke="var(--gold)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CreatorBadge({ user, size = 28 }: { user: CreatorUser | null | undefined; size?: number }) {
  const name = creatorName(user)
  return (
    <div
      title={name || undefined}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <HelmetWatermark size={Math.round(size * 0.65)} />
      )}
    </div>
  )
}
