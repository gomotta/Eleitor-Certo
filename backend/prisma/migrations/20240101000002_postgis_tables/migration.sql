-- Tabela de zonas eleitorais (geometria como GeoJSON em TEXT — sem PostGIS)
CREATE TABLE IF NOT EXISTS zonas_eleitorais (
  id           SERIAL PRIMARY KEY,
  numero_zona  VARCHAR(10) NOT NULL,
  municipio    VARCHAR(100) NOT NULL,
  uf           CHAR(2) NOT NULL,
  latitude     DECIMAL(10, 8),
  longitude    DECIMAL(11, 8),
  geometria    TEXT  -- GeoJSON armazenado como string
);

CREATE INDEX IF NOT EXISTS idx_zonas_uf ON zonas_eleitorais (uf);
CREATE INDEX IF NOT EXISTS idx_zonas_municipio ON zonas_eleitorais (municipio);

-- Tabela votos_2024 particionada por UF
CREATE TABLE IF NOT EXISTS votos_2024 (
  id                  BIGSERIAL,
  zona_eleitoral_id   INTEGER REFERENCES zonas_eleitorais(id),
  candidato_nome      VARCHAR(200) NOT NULL,
  candidato_numero    VARCHAR(10) NOT NULL,
  partido_sigla       VARCHAR(10),
  cargo               VARCHAR(50) NOT NULL,
  uf                  CHAR(2) NOT NULL,
  municipio           VARCHAR(100),
  quantidade_votos    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, uf)
) PARTITION BY LIST (uf);

-- Partições por UF (todas as 27 UFs)
CREATE TABLE votos_2024_ac PARTITION OF votos_2024 FOR VALUES IN ('AC');
CREATE TABLE votos_2024_al PARTITION OF votos_2024 FOR VALUES IN ('AL');
CREATE TABLE votos_2024_am PARTITION OF votos_2024 FOR VALUES IN ('AM');
CREATE TABLE votos_2024_ap PARTITION OF votos_2024 FOR VALUES IN ('AP');
CREATE TABLE votos_2024_ba PARTITION OF votos_2024 FOR VALUES IN ('BA');
CREATE TABLE votos_2024_ce PARTITION OF votos_2024 FOR VALUES IN ('CE');
CREATE TABLE votos_2024_df PARTITION OF votos_2024 FOR VALUES IN ('DF');
CREATE TABLE votos_2024_es PARTITION OF votos_2024 FOR VALUES IN ('ES');
CREATE TABLE votos_2024_go PARTITION OF votos_2024 FOR VALUES IN ('GO');
CREATE TABLE votos_2024_ma PARTITION OF votos_2024 FOR VALUES IN ('MA');
CREATE TABLE votos_2024_mg PARTITION OF votos_2024 FOR VALUES IN ('MG');
CREATE TABLE votos_2024_ms PARTITION OF votos_2024 FOR VALUES IN ('MS');
CREATE TABLE votos_2024_mt PARTITION OF votos_2024 FOR VALUES IN ('MT');
CREATE TABLE votos_2024_pa PARTITION OF votos_2024 FOR VALUES IN ('PA');
CREATE TABLE votos_2024_pb PARTITION OF votos_2024 FOR VALUES IN ('PB');
CREATE TABLE votos_2024_pe PARTITION OF votos_2024 FOR VALUES IN ('PE');
CREATE TABLE votos_2024_pi PARTITION OF votos_2024 FOR VALUES IN ('PI');
CREATE TABLE votos_2024_pr PARTITION OF votos_2024 FOR VALUES IN ('PR');
CREATE TABLE votos_2024_rj PARTITION OF votos_2024 FOR VALUES IN ('RJ');
CREATE TABLE votos_2024_rn PARTITION OF votos_2024 FOR VALUES IN ('RN');
CREATE TABLE votos_2024_ro PARTITION OF votos_2024 FOR VALUES IN ('RO');
CREATE TABLE votos_2024_rr PARTITION OF votos_2024 FOR VALUES IN ('RR');
CREATE TABLE votos_2024_rs PARTITION OF votos_2024 FOR VALUES IN ('RS');
CREATE TABLE votos_2024_sc PARTITION OF votos_2024 FOR VALUES IN ('SC');
CREATE TABLE votos_2024_se PARTITION OF votos_2024 FOR VALUES IN ('SE');
CREATE TABLE votos_2024_sp PARTITION OF votos_2024 FOR VALUES IN ('SP');
CREATE TABLE votos_2024_to PARTITION OF votos_2024 FOR VALUES IN ('TO');

-- Índices compostos para consultas frequentes
CREATE INDEX idx_votos_uf_municipio_cargo ON votos_2024 (uf, municipio, cargo);
CREATE INDEX idx_votos_candidato_uf ON votos_2024 (candidato_numero, uf);
CREATE INDEX idx_votos_zona ON votos_2024 (zona_eleitoral_id);

-- Materialized view para agregações do mapa (consultas instantâneas)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_votos_por_zona AS
SELECT
  v.zona_eleitoral_id,
  v.candidato_nome,
  v.candidato_numero,
  v.partido_sigla,
  v.cargo,
  v.uf,
  v.municipio,
  SUM(v.quantidade_votos) AS total_votos,
  RANK() OVER (
    PARTITION BY v.zona_eleitoral_id, v.cargo
    ORDER BY SUM(v.quantidade_votos) DESC
  ) AS ranking_zona,
  SUM(SUM(v.quantidade_votos)) OVER (
    PARTITION BY v.zona_eleitoral_id, v.cargo
  ) AS total_votos_zona,
  ROUND(
    100.0 * SUM(v.quantidade_votos) /
    NULLIF(SUM(SUM(v.quantidade_votos)) OVER (PARTITION BY v.zona_eleitoral_id, v.cargo), 0),
    2
  ) AS percentual_votos_validos
FROM votos_2024 v
GROUP BY
  v.zona_eleitoral_id,
  v.candidato_nome,
  v.candidato_numero,
  v.partido_sigla,
  v.cargo,
  v.uf,
  v.municipio;

CREATE UNIQUE INDEX idx_mv_votos_por_zona
  ON mv_votos_por_zona (zona_eleitoral_id, candidato_numero, cargo);

CREATE INDEX idx_mv_votos_candidato
  ON mv_votos_por_zona (candidato_numero, uf, cargo);
