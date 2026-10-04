'use client'
import { useState } from 'react'
import { Share2, X, CheckCircle2, AlertCircle, Send } from 'lucide-react'
import UserSearchPicker, { type FoundUser } from '@/components/UserSearchPicker'

// ─── Recommander cette séance ───────────────────────────────────────────────
// Recherche par nom/prénom/email (UserSearchPicker) plutôt que la saisie d'un
// email exact : on ne connaît pas toujours l'adresse d'un autre utilisateur.
// Le champ reste un texte libre par en-dessous — sélectionner un résultat le
// pré-remplit, mais taper directement un email exact connu fonctionne toujours.
export function ShareModal({ workout, onClose }: { workout: { id: string; name: string }; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [picked, setPicked] = useState<FoundUser | null>(null)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleShare() {
    const targetEmail = picked?.email ?? email.trim()
    if (!targetEmail) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/workouts/${workout.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, message: message.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Erreur'); setStatus('error') }
      else setStatus('done')
    } catch { setErrorMsg('Erreur réseau'); setStatus('error') }
  }

  const targetEmail = picked?.email ?? email.trim()

  return (
    <div onClick={onClose} className="overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 420, padding: '24px 24px 20px', boxShadow: 'var(--elev-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Share2 size={16} color="var(--gold)" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Recommander cette séance</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {status === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>
            <CheckCircle2 size={40} color="var(--green)" />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Recommandation envoyée !</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{targetEmail}</strong> recevra un email. S'il l'accepte, la séance sera sauvegardée dans ses <em>Sauvegardés</em>.
            </div>
            <button onClick={onClose} style={{ marginTop: 8, padding: '9px 24px', background: 'var(--bg-elevated)', border: '1px solid var(--border-cartouche)', borderRadius: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fermer</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Recommande cette séance à un autre utilisateur ARETE. S'il accepte, elle sera automatiquement ajoutée à ses <strong style={{ color: 'var(--text-primary)' }}>Sauvegardés</strong>.
            </div>

            {picked ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{picked.email}</span>
                <button onClick={() => setPicked(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--text-dim)' }}>Changer</button>
              </div>
            ) : (
              <>
                <UserSearchPicker onSelect={u => { setPicked(u); setStatus('idle'); setErrorMsg('') }} autoFocus />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '8px 0' }}>ou saisir directement un email connu :</div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setStatus('idle'); setErrorMsg('') }}
                  onKeyDown={e => e.key === 'Enter' && handleShare()}
                  placeholder="email@exemple.com"
                  style={{ width: '100%', background: 'var(--bg-elevated)', border: `1px solid ${status === 'error' ? 'var(--red)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                />
              </>
            )}

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Ajouter un message personnalisé (optionnel)…"
              rows={2}
              maxLength={500}
              style={{ width: '100%', marginTop: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-cartouche)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
            />
            {status === 'error' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--red)' }}>
                <AlertCircle size={13} />{errorMsg}
              </div>
            )}
            <button
              onClick={handleShare}
              disabled={status === 'sending' || !targetEmail}
              style={{ width: '100%', marginTop: 12, padding: '10px 16px', background: 'var(--gold)', color: 'var(--ink)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: status === 'sending' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!targetEmail || status === 'sending') ? 0.6 : 1 }}
            >
              <Send size={13} />
              {status === 'sending' ? '…' : 'Envoyer'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
