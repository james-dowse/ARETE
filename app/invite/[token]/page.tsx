import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import Link from 'next/link'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await prisma.invitedUser.findUnique({ where: { token } })

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 24,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid rgba(201,165,53,0.2)',
        borderRadius: 20, padding: '48px 40px', maxWidth: 440, width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Image src="/logo.svg" alt="ARETE" width={52} height={52} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, color: '#C9A535', marginBottom: 32 }}>
          ARETE
        </div>

        {!invite ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✗</div>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Lien invalide</h1>
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Ce lien d'invitation est invalide ou a expiré. Contacte un administrateur.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>
              Tu es invité(e) 👋
            </h1>
            <p style={{ margin: '0 0 8px', fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              Bienvenue <strong style={{ color: '#fff' }}>{invite.email}</strong>
            </p>
            <p style={{ margin: '0 0 32px', fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
              Clique ci-dessous pour accéder au protocole ARETE et commencer à générer tes workouts.
            </p>
            {/* Lien vers l'API qui pose le cookie puis redirige */}
            <Link
              href={`/api/invite/accept?token=${token}`}
              style={{
                display: 'inline-block', background: '#C9A535', color: '#000',
                fontWeight: 700, fontSize: 15, padding: '14px 36px',
                borderRadius: 10, textDecoration: 'none', letterSpacing: 0.3,
              }}
            >
              Accéder à l'application
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
