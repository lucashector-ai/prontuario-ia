-- 0014 — Modelos de prontuário por especialidade
--
-- Modelos do SISTEMA (SOAP, Livre, Pediatria, Psiquiatria…) ficam embutidos no
-- código (lib/ai/modelos-prontuario.ts) e não dependem desta tabela.
-- Aqui ficam os modelos PERSONALIZADOS do médico/clínica.
-- medico_id null + clinica_id null = modelo do sistema gravado no banco (opcional).
--
-- secoes jsonb: [{ "id": "queixa", "titulo": "Queixa principal",
--                  "instrucao": "O que a IA deve escrever aqui", "obrigatoria": true }]

create table if not exists modelos_prontuario (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid,
  clinica_id uuid,
  nome text not null,
  especialidade text,
  secoes jsonb not null default '[]'::jsonb,
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table modelos_prontuario add column if not exists medico_id uuid;
alter table modelos_prontuario add column if not exists clinica_id uuid;
alter table modelos_prontuario add column if not exists especialidade text;
alter table modelos_prontuario add column if not exists secoes jsonb not null default '[]'::jsonb;
alter table modelos_prontuario add column if not exists padrao boolean not null default false;
alter table modelos_prontuario add column if not exists criado_em timestamptz not null default now();

create index if not exists modelos_prontuario_medico_idx on modelos_prontuario (medico_id);
create index if not exists modelos_prontuario_clinica_idx on modelos_prontuario (clinica_id);

-- /api/estruturar devolve `secoes` [{titulo, conteudo}] quando o modelo não é SOAP.
-- A nova consulta salva o prontuário inteiro em `consultas` (insert do body), então
-- a coluna precisa existir para não quebrar o insert.
alter table consultas add column if not exists secoes jsonb;
alter table consultas add column if not exists modelo_prontuario text;
