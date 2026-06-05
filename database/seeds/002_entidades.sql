-- ============================================================
-- SEED 002 — Entidades principales del Estado Táchira
-- ============================================================

-- Gobernación
INSERT INTO core.entidades (nombre, nombre_corto, tipo, nivel, titular, cargo_titular, sitio_web, redes_sociales) VALUES
(
    'Gobernación del Estado Táchira',
    'Gobernación Táchira',
    'gobernacion',
    'estadal',
    'Freddy Bernal',
    'Gobernador',
    'https://www.tachira.gob.ve',
    '{"instagram":"@gobernaciontachira","twitter":"@FreddyBernal","facebook":"GobernacionTachira","telegram":"@FreddyBernalVzla"}'
);

-- Alcaldías (muestra de las principales)
INSERT INTO core.entidades (nombre, nombre_corto, tipo, nivel, municipio_id, cargo_titular, redes_sociales) VALUES
('Alcaldía del Municipio San Cristóbal',  'Alcaldía San Cristóbal', 'alcaldia', 'municipal',
 (SELECT id FROM core.municipios WHERE nombre='San Cristóbal'), 'Alcalde', '{}'),
('Alcaldía del Municipio Cárdenas',       'Alcaldía Cárdenas',      'alcaldia', 'municipal',
 (SELECT id FROM core.municipios WHERE nombre='Cárdenas'),      'Alcalde', '{}'),
('Alcaldía del Municipio Junín',          'Alcaldía Junín',         'alcaldia', 'municipal',
 (SELECT id FROM core.municipios WHERE nombre='Junín'),         'Alcalde', '{}'),
('Alcaldía del Municipio Bolívar',        'Alcaldía San Antonio',   'alcaldia', 'municipal',
 (SELECT id FROM core.municipios WHERE nombre='Bolívar'),       'Alcalde', '{}'),
('Alcaldía del Municipio Ayacucho',       'Alcaldía Colón',         'alcaldia', 'municipal',
 (SELECT id FROM core.municipios WHERE nombre='Ayacucho'),      'Alcalde', '{}');

-- Institutos Autónomos
INSERT INTO core.entidades (nombre, nombre_corto, tipo, nivel, cargo_titular) VALUES
('Instituto Regional de la Vivienda del Táchira',  'INVIVIENDA Táchira', 'instituto_autonomo', 'estadal', 'Presidente'),
('Instituto de Vialidad y Transporte del Táchira', 'INVIAL Táchira',     'instituto_autonomo', 'estadal', 'Presidente'),
('Instituto de Deporte del Táchira',               'INDET',              'instituto_autonomo', 'estadal', 'Presidente');
