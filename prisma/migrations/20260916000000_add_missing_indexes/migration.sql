-- Index manquants sur les clés étrangères et les colonnes de tri/filtre.
--
-- SQLite (et donc Turso) n'indexe QUE les contraintes UNIQUE et les clés
-- primaires : une clé étrangère sans index déclaré provoque un parcours complet
-- de table à chaque jointure, à chaque filtre de liste, et à chaque suppression
-- en cascade. Aucune de ces tables n'en avait, hormis Notification,
-- AssignedWorkout(assignedToId) et SessionSet.
--
-- `IF NOT EXISTS` partout : cette migration doit pouvoir être rejouée sans
-- risque sur une base déjà à jour.

-- Movement : tri alphabétique et recherche par nom sur toute la table
-- (/api/movements, /api/search, bibliothèque).
CREATE INDEX IF NOT EXISTS "Movement_name_idx" ON "Movement"("name");
CREATE INDEX IF NOT EXISTS "Movement_custom_name_idx" ON "Movement"("custom", "name");

-- Workout : « mes séances » (userId + tri date) et « communauté » (public + tri date).
CREATE INDEX IF NOT EXISTS "Workout_userId_createdAt_idx" ON "Workout"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Workout_public_createdAt_idx" ON "Workout"("public", "createdAt");
CREATE INDEX IF NOT EXISTS "Workout_templateId_idx" ON "Workout"("templateId");

-- Blocs et mouvements d'une séance : jointure faite sur chaque cartouche.
CREATE INDEX IF NOT EXISTS "WorkoutBlock_workoutId_order_idx" ON "WorkoutBlock"("workoutId", "order");
CREATE INDEX IF NOT EXISTS "WorkoutMovement_workoutId_order_idx" ON "WorkoutMovement"("workoutId", "order");
CREATE INDEX IF NOT EXISTS "WorkoutMovement_blockId_idx" ON "WorkoutMovement"("blockId");
CREATE INDEX IF NOT EXISTS "WorkoutMovement_movementId_idx" ON "WorkoutMovement"("movementId");

-- Modèles du générateur.
CREATE INDEX IF NOT EXISTS "WorkoutTemplate_userId_idx" ON "WorkoutTemplate"("userId");
CREATE INDEX IF NOT EXISTS "TemplateBlock_templateId_idx" ON "TemplateBlock"("templateId");

-- Assignations coach.
CREATE INDEX IF NOT EXISTS "AssignedWorkout_workoutId_idx" ON "AssignedWorkout"("workoutId");
CREATE INDEX IF NOT EXISTS "AssignedWorkout_assignedById_idx" ON "AssignedWorkout"("assignedById");

-- Abonnements : followerId est déjà couvert par le préfixe de l'unique
-- [followerId, followedId] ; followedId ne l'est pas.
CREATE INDEX IF NOT EXISTS "Follow_followedId_idx" ON "Follow"("followedId");

-- Planning hebdomadaire.
CREATE INDEX IF NOT EXISTS "WeekPlanEntry_weekPlanId_dayOfWeek_order_idx" ON "WeekPlanEntry"("weekPlanId", "dayOfWeek", "order");
CREATE INDEX IF NOT EXISTS "WeekPlanEntry_workoutId_idx" ON "WeekPlanEntry"("workoutId");

-- Favoris : userId est couvert par le préfixe des uniques, pas movementId /
-- workoutId (utilisés par les suppressions en cascade).
CREATE INDEX IF NOT EXISTS "FavoriteMovement_movementId_idx" ON "FavoriteMovement"("movementId");
CREATE INDEX IF NOT EXISTS "FavoriteWorkout_workoutId_idx" ON "FavoriteWorkout"("workoutId");

-- Séances importées : l'unique est [workoutId, userId], donc un filtre sur
-- userId seul (l'onglet « importées ») ne pouvait pas l'utiliser.
CREATE INDEX IF NOT EXISTS "SavedWorkout_userId_savedAt_idx" ON "SavedWorkout"("userId", "savedAt");

-- Historique de séances : tableau de bord (série en cours, volume du mois),
-- progression, et déduction de complétion des WOD assignés.
CREATE INDEX IF NOT EXISTS "WorkoutSession_userId_doneAt_idx" ON "WorkoutSession"("userId", "doneAt");
CREATE INDEX IF NOT EXISTS "WorkoutSession_workoutId_idx" ON "WorkoutSession"("workoutId");

-- Partages.
CREATE INDEX IF NOT EXISTS "WorkoutShare_workoutId_idx" ON "WorkoutShare"("workoutId");
CREATE INDEX IF NOT EXISTS "WorkoutShare_sharedToUserId_idx" ON "WorkoutShare"("sharedToUserId");
CREATE INDEX IF NOT EXISTS "WorkoutShare_sharedByUserId_idx" ON "WorkoutShare"("sharedByUserId");
