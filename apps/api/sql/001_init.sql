-- Esquema PostgreSQL de Trazo.
CREATE TABLE IF NOT EXISTS designs (
  id          text PRIMARY KEY,
  revision    integer NOT NULL DEFAULT 0,
  doc         jsonb NOT NULL,
  thumbnail   bytea,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS designs_updated_at_idx ON designs (updated_at DESC);

-- Log de operaciones (deltas) recibidas por WebSocket, para auditoría y depuración.
CREATE TABLE IF NOT EXISTS design_ops (
  design_id   text NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  revision    integer NOT NULL,
  client_id   text NOT NULL,
  patches     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (design_id, revision)
);

CREATE TABLE IF NOT EXISTS uploads (
  name        text PRIMARY KEY,
  mime        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Respuestas de formularios enviadas desde la presentación.
CREATE TABLE IF NOT EXISTS form_responses (
  id          text PRIMARY KEY,
  design_id   text NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  form_id     text NOT NULL,
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_responses_form_idx ON form_responses (design_id, form_id, created_at);
