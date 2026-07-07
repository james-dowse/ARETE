export default function Offline() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>⚔️</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Hors-ligne</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 320 }}>Pas de réseau. Ta séance en cours reste accessible ; le reste reviendra à la reconnexion.</p>
    </div>
  )
}
