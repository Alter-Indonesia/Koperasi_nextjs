-- db_koperasi · autentikasi: password & sesi login

ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS password_hash   text;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS gagal_login     int NOT NULL DEFAULT 0;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS terkunci_sampai timestamptz;

-- Sesi login. Cookie hanya berisi token acak; yang disimpan di DB adalah hash SHA-256-nya.
CREATE TABLE IF NOT EXISTS sesi (
  id               text PRIMARY KEY,                -- sha256(token) hex
  pengguna_id      int NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  dibuat_pada      timestamptz NOT NULL DEFAULT now(),
  terakhir_dipakai timestamptz NOT NULL DEFAULT now(),
  kedaluwarsa      timestamptz NOT NULL,
  user_agent       text,
  ip               text
);
CREATE INDEX IF NOT EXISTS sesi_pengguna_idx ON sesi (pengguna_id);
CREATE INDEX IF NOT EXISTS sesi_kedaluwarsa_idx ON sesi (kedaluwarsa);
