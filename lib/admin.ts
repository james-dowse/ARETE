// L'administrateur est désigné par son adresse e-mail. La valeur par défaut est
// écrite ici en clair faute de ADMIN_EMAIL côté Vercel : ce n'est pas un secret
// (elle sert d'identifiant, pas de preuve), mais ce n'était pas inoffensif tant
// que le cookie de session contenait un identifiant brut — il suffisait de se
// faire passer pour ce compte. Le cookie est désormais signé (lib/session.ts),
// et tous les appelants passent un `user.email` LU EN BASE à partir de cette
// session vérifiée, jamais une valeur fournie par le client : la comparaison
// par e-mail est donc sûre.
//
// Une comparaison par identifiant (ADMIN_USER_ID) serait marginalement plus
// robuste — l'e-mail d'un compte peut changer, et un futur appelant pourrait
// être tenté de passer un e-mail venu d'ailleurs que de la session. Mais elle
// imposerait une variable d'environnement que Vercel n'a pas (donc un cuid en
// dur, moins lisible) et la réécriture des trente appels `isAdmin(user?.email)`.
// Pas fait : le gain réel était faible une fois la session infalsifiable.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'jimmy.dowse@gmail.com').toLowerCase()

export function isAdmin(email?: string | null): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL
}
