-- Zasebnost za zaposlene: ghost termini in pretekli termini.
-- Zaženi ročno v Supabase SQL editorju. Obstoječe vrstice dobijo varne privzete vrednosti:
--   can_view_ghost_termini = false  -> ghost vidi samo lastnik (drugi ga vidijo kot običajen termin)
--   past_appointments_days = NULL   -> NULL = vsi pretekli termini (obnašanje se ne spremeni)
--                                       0 = nobenih preteklih, N = zadnjih N dni
ALTER TABLE staff_role_permissions
  ADD COLUMN IF NOT EXISTS can_view_ghost_termini boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS past_appointments_days integer NULL
    CHECK (past_appointments_days IS NULL OR past_appointments_days >= 0);
