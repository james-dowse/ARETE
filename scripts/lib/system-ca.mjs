// Magasin de certificats de Windows, pour les scripts qui parlent à Turso.
//
// Sur ce poste, le trafic HTTPS est ouvert par un antivirus : la chaîne de
// arete-eu-tookour.aws-eu-west-1.turso.io est signée par « AVG Web/Mail Shield
// Root », une racine présente dans le magasin de Windows et absente des 121
// racines que Node embarque. Node refuse donc le certificat, et le dit par un
// « fetch failed » laconique, cause UNABLE_TO_VERIFY_LEAF_SIGNATURE, qui a tout
// l'air d'une panne réseau. Les configurations de lancement du poste posent
// NODE_OPTIONS=--use-system-ca pour cette raison ; un script lancé à la main n'a
// rien qui le fasse à sa place. Importer ce module EN PREMIER le fait.
//
// Lancé en premier import, et non depuis le corps du script : en ESM tous les
// imports statiques s'évaluent avant la première instruction du corps, donc un
// bloc dans le corps relancerait après avoir chargé @libsql/client (57 ms) pour
// rien.

import { spawnSync } from 'node:child_process'

// Trois façons d'avoir déjà le magasin système : le drapeau sur la ligne de
// commande, le drapeau dans NODE_OPTIONS, ou la variable équivalente. Ce poste
// a la troisième, posée par l'antivirus lui-même — ne tester que NODE_OPTIONS
// ferait relancer le script à chaque fois sans rien y gagner.
// Quatrième cas, sans rapport : pas de script d'entrée à relancer (`node -e`,
// `node -p`, REPL). Il n'y a alors rien à faire.
const deja =
  process.execArgv.includes('--use-system-ca') ||
  (process.env.NODE_OPTIONS || '').includes('--use-system-ca') ||
  ['1', 'true'].includes((process.env.NODE_USE_SYSTEM_CA || '').toLowerCase()) ||
  !process.argv[1]

if (!deja) {
  // process.argv[1] est le script d'entrée, en chemin natif Windows
  // (C:\Users\...), et c'est bien lui qu'il faut relancer — pas ce module.
  // On évite au passage new URL(import.meta.url).pathname, qui rend
  // « /C:/Users/... », chemin que Node refuse.
  // Les drapeaux qui réservent un port ne se relaient pas : le père reste
  // vivant pendant spawnSync et tient encore le port de l'inspecteur, donc le
  // fils échouerait sur « address already in use » — et avec --inspect-brk,
  // le débogueur resterait attaché au père, qui n'exécute rien.
  const execArgvFils = process.execArgv.filter(a => !/^--inspect(-brk|-port)?(=|$)/.test(a))
  const fils = spawnSync(
    process.execPath,
    [...execArgvFils, process.argv[1], ...process.argv.slice(2)],
    {
      stdio: 'inherit',  // les arguments ET stdin passent au fils
      // On pose la variable plutôt que le drapeau dans NODE_OPTIONS : avant
      // Node 22.15 le drapeau n'existe pas, et NODE_OPTIONS refuse de démarrer
      // sur un drapeau inconnu (« is not allowed in NODE_OPTIONS »). Une
      // variable inconnue, elle, est ignorée.
      env: { ...process.env, NODE_USE_SYSTEM_CA: '1' },
    }
  )
  process.exit(fils.status ?? 1)
}
