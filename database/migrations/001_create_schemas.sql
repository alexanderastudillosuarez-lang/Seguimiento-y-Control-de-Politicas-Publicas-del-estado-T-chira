-- ============================================================
-- SIMGP-TÁCHIRA | Migración 001 — Esquemas y extensiones
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS contenido;
CREATE SCHEMA IF NOT EXISTS metricas;
CREATE SCHEMA IF NOT EXISTS alertas;
CREATE SCHEMA IF NOT EXISTS etl;
CREATE SCHEMA IF NOT EXISTS reportes;
CREATE SCHEMA IF NOT EXISTS audit;
