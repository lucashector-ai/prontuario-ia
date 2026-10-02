-- ============================================================================
-- Clinical 360 — TODAS as migrations (0000 → 0015) num arquivo só.
-- Cole tudo no Supabase → SQL Editor → Run.
-- Idempotente: só cria o que falta; pode rodar de novo sem perder dados.
-- ATENÇÃO: se o banco "sumiu", restaure o backup ANTES (ver LEIA-ME.md).
-- ============================================================================


-- ############################################################
-- 0000_base_reconstruida.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — 0000 · Base do banco (tabelas principais)
--
-- Reconstruído a partir do código em 2026-10-02 — revisar antes de rodar em produção.
--
-- Por quê: as tabelas principais (medicos, pacientes, agendamentos, consultas,
-- whatsapp_*, ...) foram criadas à mão no painel do Supabase e nunca tiveram
-- migration. Este arquivo descreve o schema que o CÓDIGO espera (varredura de
-- .from('tabela'), .select/.insert/.update/.eq/.order e joins em app/,
-- components/ e lib/), para conseguir recriar o banco do zero.
--
-- Como foi escrito (idempotente — pode rodar num banco que JÁ tem as tabelas):
--   * cada tabela: `create table if not exists t (id ...)` e depois
--     `add column if not exists` coluna por coluna — nada é apagado/alterado;
--   * colunas quase todas anuláveis (not null só com default), para não falhar
--     em linhas existentes;
--   * UNIQUE exigidos por upsert(onConflict) e FKs exigidas pelos joins do
--     PostgREST ficam em blocos separados no fim, protegidos: se já existir
--     FK na coluna ou houver dado inconsistente, só emite NOTICE e segue;
--   * FKs criadas com NOT VALID (não verificam linhas antigas; valem para
--     novas). Depois de limpar os dados: `alter table x validate constraint y`.
--   * Colunas que outras migrations já adicionam (0001..0009) NÃO estão aqui,
--     exceto quando a migration antiga assume que a coluna já existe.
--
-- Ordem: rodar ANTES de 0001. Ver supabase/LEIA-ME.md.
-- RLS: fora do escopo (projeto separado) — ver bloco comentado no fim.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid() (já vem no Supabase)


-- ────────────────────────────────────────────────────────────────────────────
-- 1. planos / clinicas / clinica_admins
-- ────────────────────────────────────────────────────────────────────────────
-- planos: só aparece em join `clinicas.select('*, planos(*)')` (limite de médicos).
create table if not exists planos (id uuid primary key default gen_random_uuid());
alter table planos add column if not exists nome          text;
alter table planos add column if not exists max_medicos   int;
alter table planos add column if not exists preco         numeric(10,2);
alter table planos add column if not exists criado_em     timestamptz default now();

create table if not exists clinicas (id uuid primary key default gen_random_uuid());
alter table clinicas add column if not exists nome          text;
alter table clinicas add column if not exists email         text;
alter table clinicas add column if not exists telefone      text;
alter table clinicas add column if not exists endereco      text;
alter table clinicas add column if not exists tipo          text default 'clinica';  -- clinica | autonomo
alter table clinicas add column if not exists plano         text;                    -- superadmin grava o nome do plano
alter table clinicas add column if not exists plano_id      uuid;                    -- FK p/ planos (join planos(*))
alter table clinicas add column if not exists ativo         boolean default true;
alter table clinicas add column if not exists email_admin   text;
alter table clinicas add column if not exists logo_url      text;                    -- hoje guarda base64
alter table clinicas add column if not exists slug_publico  text;
alter table clinicas add column if not exists site          text;
alter table clinicas add column if not exists horarios      text;
alter table clinicas add column if not exists descricao     text;
alter table clinicas add column if not exists criado_em     timestamptz default now();
create index if not exists idx_clinicas_slug_publico on clinicas(slug_publico);
create index if not exists idx_clinicas_email        on clinicas(email);

create table if not exists clinica_admins (id uuid primary key default gen_random_uuid());
alter table clinica_admins add column if not exists clinica_id           uuid;
alter table clinica_admins add column if not exists email                text;
alter table clinica_admins add column if not exists senha_hash           text;
alter table clinica_admins add column if not exists nome                 text;
alter table clinica_admins add column if not exists role                 text default 'owner';
alter table clinica_admins add column if not exists ativo                boolean default true;
alter table clinica_admins add column if not exists verificado           boolean default false;
alter table clinica_admins add column if not exists token_verificacao    text;
alter table clinica_admins add column if not exists token_expira_em      timestamptz;
alter table clinica_admins add column if not exists onboarding_concluido boolean default false;
alter table clinica_admins add column if not exists criado_em            timestamptz default now();
create index if not exists idx_clinica_admins_clinica on clinica_admins(clinica_id);
create index if not exists idx_clinica_admins_email   on clinica_admins(lower(email));


-- ────────────────────────────────────────────────────────────────────────────
-- 2. medicos (também recepcionistas/admins: coluna cargo)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists medicos (id uuid primary key default gen_random_uuid());
alter table medicos add column if not exists nome                  text;
alter table medicos add column if not exists email                 text;
alter table medicos add column if not exists senha_hash            text;           -- bcrypt
alter table medicos add column if not exists senha_provisoria      boolean default false;
alter table medicos add column if not exists crm                   text;
alter table medicos add column if not exists especialidade         text;
alter table medicos add column if not exists cpf                   text;
alter table medicos add column if not exists sexo                  text;
alter table medicos add column if not exists data_nascimento       date;
alter table medicos add column if not exists telefone              text;
alter table medicos add column if not exists clinica               text;           -- nome livre (perfil)
alter table medicos add column if not exists empresa_nome          text;           -- cadastro autônomo
alter table medicos add column if not exists bio                   text;
alter table medicos add column if not exists foto_url              text;           -- hoje guarda base64
alter table medicos add column if not exists cargo                 text default 'medico';  -- medico | admin | recepcionista
alter table medicos add column if not exists ativo                 boolean default true;
alter table medicos add column if not exists verificado            boolean default false;
alter table medicos add column if not exists token_verificacao     text;
alter table medicos add column if not exists token_expira_em       timestamptz;
alter table medicos add column if not exists onboarding_concluido  boolean default false;
alter table medicos add column if not exists is_atendente          boolean default false;
alter table medicos add column if not exists clinica_id            uuid;
alter table medicos add column if not exists cor                   text default '#6043C1';
alter table medicos add column if not exists comissao_tipo         text default 'sem';     -- sem | percentual | fixo
alter table medicos add column if not exists comissao_valor        numeric(10,2);
alter table medicos add column if not exists comissao_base         text default 'receita';
alter table medicos add column if not exists slug_publico          text;
alter table medicos add column if not exists agenda_publica_ativa  boolean default false;
alter table medicos add column if not exists agenda_publica_config jsonb;
alter table medicos add column if not exists api_key               text;
alter table medicos add column if not exists criado_em             timestamptz default now();
-- unidade_id: adicionada em 0005.
create index if not exists idx_medicos_clinica      on medicos(clinica_id);
create index if not exists idx_medicos_email        on medicos(lower(email));
create index if not exists idx_medicos_slug_publico on medicos(slug_publico);
create index if not exists idx_medicos_api_key      on medicos(api_key);

-- atendentes da equipe de chat (login em /login-atendente)
create table if not exists atendentes (id uuid primary key default gen_random_uuid());
alter table atendentes add column if not exists medico_id uuid;
alter table atendentes add column if not exists nome      text;
alter table atendentes add column if not exists email     text;
alter table atendentes add column if not exists senha     text;   -- ATENÇÃO: o código compara texto puro (ver app/api/atendentes)
alter table atendentes add column if not exists cargo     text default 'Atendente';
alter table atendentes add column if not exists ativo     boolean default true;
alter table atendentes add column if not exists criado_em timestamptz default now();
create index if not exists idx_atendentes_medico on atendentes(medico_id);
create index if not exists idx_atendentes_email  on atendentes(email);

create table if not exists password_resets (id uuid primary key default gen_random_uuid());
alter table password_resets add column if not exists medico_id uuid;      -- upsert onConflict medico_id
alter table password_resets add column if not exists token     text;
alter table password_resets add column if not exists expira_em timestamptz;
alter table password_resets add column if not exists criado_em timestamptz default now();
create index if not exists idx_password_resets_token on password_resets(token);

create table if not exists memed_tokens (id uuid primary key default gen_random_uuid());
alter table memed_tokens add column if not exists medico_id     uuid;     -- upsert onConflict medico_id
alter table memed_tokens add column if not exists memed_token   text;
alter table memed_tokens add column if not exists external_id   text;
alter table memed_tokens add column if not exists status        text;
alter table memed_tokens add column if not exists atualizado_em timestamptz default now();
alter table memed_tokens add column if not exists criado_em     timestamptz default now();


-- ────────────────────────────────────────────────────────────────────────────
-- 3. pacientes
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists pacientes (id uuid primary key default gen_random_uuid());
alter table pacientes add column if not exists nome             text;
alter table pacientes add column if not exists telefone         text;
alter table pacientes add column if not exists email            text;
alter table pacientes add column if not exists cpf              text;
alter table pacientes add column if not exists data_nascimento  date;
alter table pacientes add column if not exists sexo             text;
alter table pacientes add column if not exists genero           text;
alter table pacientes add column if not exists endereco         text;
alter table pacientes add column if not exists cidade           text;
alter table pacientes add column if not exists convenio         text;
alter table pacientes add column if not exists nr_carteirinha   text;
alter table pacientes add column if not exists alergias         text;
alter table pacientes add column if not exists comorbidades     text;
alter table pacientes add column if not exists medicamentos_uso text;
alter table pacientes add column if not exists cids_cronicos    jsonb;   -- [{codigo, descricao}]
alter table pacientes add column if not exists foto_url         text;    -- hoje guarda base64
alter table pacientes add column if not exists medico_id        uuid;
alter table pacientes add column if not exists clinica_id       uuid;
alter table pacientes add column if not exists criado_em        timestamptz default now();
create index if not exists idx_pacientes_medico    on pacientes(medico_id);
create index if not exists idx_pacientes_clinica   on pacientes(clinica_id);
create index if not exists idx_pacientes_telefone  on pacientes(telefone);
create index if not exists idx_pacientes_cpf       on pacientes(cpf);
create index if not exists idx_pacientes_nome      on pacientes(nome);
create index if not exists idx_pacientes_criado_em on pacientes(criado_em desc);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. procedimentos (custo_insumos/custo_operacional: 0003)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists procedimentos (id uuid primary key default gen_random_uuid());
alter table procedimentos add column if not exists clinica_id    uuid;
alter table procedimentos add column if not exists nome          text;
alter table procedimentos add column if not exists duracao       int default 30;   -- minutos
alter table procedimentos add column if not exists valor         numeric(10,2);
alter table procedimentos add column if not exists ativo         boolean default true;
alter table procedimentos add column if not exists criado_em     timestamptz default now();
alter table procedimentos add column if not exists atualizado_em timestamptz default now();
create index if not exists idx_procedimentos_clinica on procedimentos(clinica_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. agenda: agendamentos, bloqueios_agenda, agenda_publica_solicitacoes
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists agendamentos (id uuid primary key default gen_random_uuid());
alter table agendamentos add column if not exists medico_id                    uuid;
alter table agendamentos add column if not exists paciente_id                  uuid;
alter table agendamentos add column if not exists procedimento_id              uuid;
alter table agendamentos add column if not exists data_hora                    timestamptz;
alter table agendamentos add column if not exists duracao                      text default '30';  -- o código grava string ('30') e lê com Number()
alter table agendamentos add column if not exists tipo                         text default 'consulta';  -- consulta | retorno | exame | urgencia
alter table agendamentos add column if not exists status                       text default 'agendado';  -- agendado | confirmado | confirmacao_enviada | realizado | faltou | cancelado
alter table agendamentos add column if not exists titulo                       text;
alter table agendamentos add column if not exists motivo                       text;
alter table agendamentos add column if not exists observacoes                  text;
alter table agendamentos add column if not exists meet_link                    text;
alter table agendamentos add column if not exists meet_code                    text;
alter table agendamentos add column if not exists confirmacao_24h_enviada      boolean default false;
alter table agendamentos add column if not exists confirmacao_24h_status       text;     -- pendente | confirmado | nao_confirmado | reagendou
alter table agendamentos add column if not exists confirmacao_24h_resposta_em  timestamptz;
alter table agendamentos add column if not exists pre_consulta_enviada         boolean default false;
alter table agendamentos add column if not exists pre_consulta_contexto        text;
alter table agendamentos add column if not exists lembrete_teleconsulta_enviado boolean default false;
alter table agendamentos add column if not exists criado_em                    timestamptz default now();
create index if not exists idx_agendamentos_medico_data on agendamentos(medico_id, data_hora);
create index if not exists idx_agendamentos_paciente    on agendamentos(paciente_id);
create index if not exists idx_agendamentos_data_hora   on agendamentos(data_hora);
create index if not exists idx_agendamentos_status      on agendamentos(status);

create table if not exists bloqueios_agenda (id uuid primary key default gen_random_uuid());
alter table bloqueios_agenda add column if not exists medico_id   uuid;
alter table bloqueios_agenda add column if not exists clinica_id  uuid;
alter table bloqueios_agenda add column if not exists data_inicio timestamptz;
alter table bloqueios_agenda add column if not exists data_fim    timestamptz;
alter table bloqueios_agenda add column if not exists motivo      text;
alter table bloqueios_agenda add column if not exists recorrente  boolean default false;
alter table bloqueios_agenda add column if not exists dias_semana jsonb;    -- ex.: [1,3,5]
alter table bloqueios_agenda add column if not exists criado_em   timestamptz default now();
create index if not exists idx_bloqueios_medico_inicio on bloqueios_agenda(medico_id, data_inicio);

create table if not exists agenda_publica_solicitacoes (id uuid primary key default gen_random_uuid());
alter table agenda_publica_solicitacoes add column if not exists medico_id         uuid;
alter table agenda_publica_solicitacoes add column if not exists clinica_id        uuid;
alter table agenda_publica_solicitacoes add column if not exists agendamento_id    uuid;
alter table agenda_publica_solicitacoes add column if not exists nome_paciente     text;
alter table agenda_publica_solicitacoes add column if not exists telefone          text;
alter table agenda_publica_solicitacoes add column if not exists email             text;
alter table agenda_publica_solicitacoes add column if not exists data_hora         timestamptz;
alter table agenda_publica_solicitacoes add column if not exists motivo            text;
alter table agenda_publica_solicitacoes add column if not exists primeira_consulta boolean default true;
alter table agenda_publica_solicitacoes add column if not exists status            text default 'pendente';  -- pendente | confirmado | rejeitado
alter table agenda_publica_solicitacoes add column if not exists criado_em         timestamptz default now();
create index if not exists idx_agpub_sol_medico_data on agenda_publica_solicitacoes(medico_id, data_hora);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. prontuário: consultas, prescricoes, teleconsultas, sala_mensagens,
--    pre_consultas, dicionario_clinico
-- ────────────────────────────────────────────────────────────────────────────
-- consultas: /api/consultas faz insert do corpo inteiro vindo da IA (spread do
-- prontuário estruturado), então TODAS as chaves que a IA devolve precisam existir.
create table if not exists consultas (id uuid primary key default gen_random_uuid());
alter table consultas add column if not exists medico_id             uuid;
alter table consultas add column if not exists paciente_id           uuid;
alter table consultas add column if not exists transcricao           text;
alter table consultas add column if not exists subjetivo             text;
alter table consultas add column if not exists objetivo              text;
alter table consultas add column if not exists avaliacao             text;
alter table consultas add column if not exists plano                 text;
alter table consultas add column if not exists receita               text;
alter table consultas add column if not exists cids                  jsonb default '[]'::jsonb;  -- [{codigo, descricao, justificativa}]
alter table consultas add column if not exists hipoteses             jsonb default '[]'::jsonb;  -- [{nome, probabilidade, justificativa}]
alter table consultas add column if not exists alertas               jsonb default '[]'::jsonb;  -- ["..."]
alter table consultas add column if not exists resumo_copiloto       text;
alter table consultas add column if not exists diagnostico_principal text;
alter table consultas add column if not exists nps_enviado           boolean default false;
-- data_hora/prontuario: lidos por whatsapp-relatorio e whatsapp-aderencia (legado?)
alter table consultas add column if not exists data_hora             timestamptz default now();
alter table consultas add column if not exists prontuario            jsonb;
alter table consultas add column if not exists criado_em             timestamptz default now();
create index if not exists idx_consultas_medico_criado   on consultas(medico_id, criado_em desc);
create index if not exists idx_consultas_paciente_criado on consultas(paciente_id, criado_em desc);
create index if not exists idx_consultas_data_hora       on consultas(data_hora);

create table if not exists prescricoes (id uuid primary key default gen_random_uuid());
alter table prescricoes add column if not exists paciente_id            uuid;
alter table prescricoes add column if not exists medico_id              uuid;
alter table prescricoes add column if not exists clinica_id             uuid;
alter table prescricoes add column if not exists prescricao_id_memed    text;
alter table prescricoes add column if not exists prescricao_id_numerico text;   -- tipo incerto (pode ser bigint)
alter table prescricoes add column if not exists dados_memed            jsonb;
alter table prescricoes add column if not exists pdf_url                text;
alter table prescricoes add column if not exists excluida               boolean default false;
alter table prescricoes add column if not exists excluida_em            timestamptz;
alter table prescricoes add column if not exists dados_exclusao         jsonb;
alter table prescricoes add column if not exists criado_em              timestamptz default now();
create index if not exists idx_prescricoes_paciente on prescricoes(paciente_id, criado_em desc);
create index if not exists idx_prescricoes_medico   on prescricoes(medico_id);

-- teleconsultas: o insert NÃO informa sala_id, então ele precisa de default.
create table if not exists teleconsultas (id uuid primary key default gen_random_uuid());
alter table teleconsultas add column if not exists sala_id          text default substr(md5(gen_random_uuid()::text), 1, 12);
alter table teleconsultas add column if not exists medico_id        uuid;
alter table teleconsultas add column if not exists paciente_id      uuid;
alter table teleconsultas add column if not exists agendamento_id   uuid;
alter table teleconsultas add column if not exists titulo           text default 'Teleconsulta';
alter table teleconsultas add column if not exists status           text default 'aguardando';  -- aguardando | em_andamento | encerrada
alter table teleconsultas add column if not exists iniciada_em      timestamptz;
alter table teleconsultas add column if not exists encerrada_em     timestamptz;
alter table teleconsultas add column if not exists duracao_segundos int;
alter table teleconsultas add column if not exists criado_em        timestamptz default now();
create index if not exists idx_teleconsultas_medico  on teleconsultas(medico_id, criado_em desc);
create index if not exists idx_teleconsultas_sala_id on teleconsultas(sala_id);

-- sala_mensagens: só lida pelo app (histórico da sala). Colunas pelos campos exibidos.
create table if not exists sala_mensagens (id uuid primary key default gen_random_uuid());
alter table sala_mensagens add column if not exists sala_id      text;
alter table sala_mensagens add column if not exists de           text;   -- medico | paciente
alter table sala_mensagens add column if not exists msg          text;
alter table sala_mensagens add column if not exists hora         text;   -- 'HH:MM' exibido como veio
alter table sala_mensagens add column if not exists url          text;
alter table sala_mensagens add column if not exists nome_arquivo text;
alter table sala_mensagens add column if not exists criado_em    timestamptz default now();
create index if not exists idx_sala_mensagens_sala on sala_mensagens(sala_id, criado_em);

create table if not exists pre_consultas (id uuid primary key default gen_random_uuid());
alter table pre_consultas add column if not exists medico_id             uuid;
alter table pre_consultas add column if not exists paciente_id           uuid;
alter table pre_consultas add column if not exists agendamento_id        uuid;
alter table pre_consultas add column if not exists conversa_id           uuid;
alter table pre_consultas add column if not exists motivo_consulta       text;
alter table pre_consultas add column if not exists perguntas             jsonb default '[]'::jsonb;
alter table pre_consultas add column if not exists respostas             jsonb default '{}'::jsonb;
alter table pre_consultas add column if not exists conteudo              jsonb;   -- legado (PreConsultaCard lê respostas || conteudo)
alter table pre_consultas add column if not exists pergunta_atual_index  int default 0;
alter table pre_consultas add column if not exists status                text default 'aguardando_permissao';  -- aguardando_permissao | em_andamento | completo | recusado
alter table pre_consultas add column if not exists canal                 text default 'whatsapp';
alter table pre_consultas add column if not exists completado_em         timestamptz;
alter table pre_consultas add column if not exists criado_em             timestamptz default now();
create index if not exists idx_pre_consultas_agendamento on pre_consultas(agendamento_id);
create index if not exists idx_pre_consultas_conversa    on pre_consultas(conversa_id, status);
create index if not exists idx_pre_consultas_paciente    on pre_consultas(paciente_id, criado_em desc);
create index if not exists idx_pre_consultas_medico      on pre_consultas(medico_id);

create table if not exists dicionario_clinico (id uuid primary key default gen_random_uuid());
alter table dicionario_clinico add column if not exists medico_id uuid;
alter table dicionario_clinico add column if not exists termo     text;
alter table dicionario_clinico add column if not exists descricao text;
alter table dicionario_clinico add column if not exists categoria text;
alter table dicionario_clinico add column if not exists criado_em timestamptz default now();
create index if not exists idx_dicionario_medico on dicionario_clinico(medico_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. formulários pré-consulta
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists formularios_templates (id uuid primary key default gen_random_uuid());
alter table formularios_templates add column if not exists clinica_id    uuid;     -- null = template público do sistema
alter table formularios_templates add column if not exists nome          text;
alter table formularios_templates add column if not exists especialidade text;
alter table formularios_templates add column if not exists descricao     text;
alter table formularios_templates add column if not exists campos        jsonb default '[]'::jsonb;
alter table formularios_templates add column if not exists publico       boolean default false;
alter table formularios_templates add column if not exists criado_em     timestamptz default now();
create index if not exists idx_form_templates_clinica on formularios_templates(clinica_id);

create table if not exists formularios_envios (id uuid primary key default gen_random_uuid());
alter table formularios_envios add column if not exists template_id    uuid;
alter table formularios_envios add column if not exists clinica_id     uuid;
alter table formularios_envios add column if not exists medico_id      uuid;
alter table formularios_envios add column if not exists agendamento_id uuid;
alter table formularios_envios add column if not exists paciente_id    uuid;
alter table formularios_envios add column if not exists resposta_id    uuid;
alter table formularios_envios add column if not exists nome_paciente  text;
alter table formularios_envios add column if not exists telefone       text;
alter table formularios_envios add column if not exists email          text;
alter table formularios_envios add column if not exists token          text;
alter table formularios_envios add column if not exists expira_em      timestamptz;
alter table formularios_envios add column if not exists origem         text default 'manual';    -- manual | agenda_publica | agendamento_interno
alter table formularios_envios add column if not exists status         text default 'pendente';  -- pendente | preenchido | expirado | cancelado
alter table formularios_envios add column if not exists enviado_em     timestamptz default now();
alter table formularios_envios add column if not exists preenchido_em  timestamptz;
create index if not exists idx_form_envios_clinica on formularios_envios(clinica_id, enviado_em desc);
create index if not exists idx_form_envios_token   on formularios_envios(token);
create index if not exists idx_form_envios_paciente on formularios_envios(paciente_id);

create table if not exists formularios_respostas (id uuid primary key default gen_random_uuid());
alter table formularios_respostas add column if not exists envio_id       uuid;
alter table formularios_respostas add column if not exists template_id    uuid;
alter table formularios_respostas add column if not exists paciente_id    uuid;
alter table formularios_respostas add column if not exists agendamento_id uuid;
alter table formularios_respostas add column if not exists respostas      jsonb default '{}'::jsonb;
alter table formularios_respostas add column if not exists resumo_ia      text;
alter table formularios_respostas add column if not exists preenchido_em  timestamptz default now();
create index if not exists idx_form_respostas_envio on formularios_respostas(envio_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 8. WhatsApp / chat (0009 acrescenta etapa, fixada, arquivada, silenciada_ate, bloqueada, canal)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists whatsapp_config (id uuid primary key default gen_random_uuid());
alter table whatsapp_config add column if not exists medico_id        uuid;   -- upsert onConflict medico_id
alter table whatsapp_config add column if not exists phone_number_id  text;
alter table whatsapp_config add column if not exists phone_number     text;
alter table whatsapp_config add column if not exists access_token     text;
alter table whatsapp_config add column if not exists token            text;   -- duplicado de access_token (legado)
alter table whatsapp_config add column if not exists nome_exibicao    text;
alter table whatsapp_config add column if not exists sofia_instrucoes text;
alter table whatsapp_config add column if not exists ativo            boolean default true;
alter table whatsapp_config add column if not exists criado_em        timestamptz default now();
alter table whatsapp_config add column if not exists atualizado_em    timestamptz default now();
create index if not exists idx_whatsapp_config_phone on whatsapp_config(phone_number_id);

create table if not exists whatsapp_conversas (id uuid primary key default gen_random_uuid());
alter table whatsapp_conversas add column if not exists medico_id            uuid;
alter table whatsapp_conversas add column if not exists paciente_id          uuid;
alter table whatsapp_conversas add column if not exists telefone             text;   -- também guarda sender id de Instagram/Messenger
alter table whatsapp_conversas add column if not exists nome_contato         text;
alter table whatsapp_conversas add column if not exists foto_url             text;
alter table whatsapp_conversas add column if not exists modo                 text default 'ia';     -- ia | humano
alter table whatsapp_conversas add column if not exists status               text default 'ativa';  -- ativa | encerrada
alter table whatsapp_conversas add column if not exists atendente_nome       text;
alter table whatsapp_conversas add column if not exists ultimo_contato       timestamptz default now();
alter table whatsapp_conversas add column if not exists onboarding_completo  boolean default false;
alter table whatsapp_conversas add column if not exists onboarding_step      text;   -- tipo incerto
alter table whatsapp_conversas add column if not exists nps_nota             int;
alter table whatsapp_conversas add column if not exists estado_reagendamento jsonb;
alter table whatsapp_conversas add column if not exists canal                text;   -- whatsapp | instagram | messenger (também em 0009)
alter table whatsapp_conversas add column if not exists criado_em            timestamptz default now();
create index if not exists idx_wpp_conversas_medico_contato on whatsapp_conversas(medico_id, ultimo_contato desc);
create index if not exists idx_wpp_conversas_telefone       on whatsapp_conversas(telefone);
create index if not exists idx_wpp_conversas_paciente       on whatsapp_conversas(paciente_id);

create table if not exists whatsapp_mensagens (id uuid primary key default gen_random_uuid());
alter table whatsapp_mensagens add column if not exists conversa_id uuid;
alter table whatsapp_mensagens add column if not exists tipo        text;   -- recebida | enviada
alter table whatsapp_mensagens add column if not exists conteudo    text;
alter table whatsapp_mensagens add column if not exists lida        boolean default false;
alter table whatsapp_mensagens add column if not exists metadata    jsonb default '{}'::jsonb;
alter table whatsapp_mensagens add column if not exists criado_em   timestamptz default now();
create index if not exists idx_wpp_mensagens_conversa on whatsapp_mensagens(conversa_id, criado_em);
create index if not exists idx_wpp_mensagens_nao_lidas on whatsapp_mensagens(conversa_id) where lida = false;

-- whatsapp_alertas / whatsapp_nps: o app só LÊ (gravação fora do repo). Colunas pelos selects.
create table if not exists whatsapp_alertas (id uuid primary key default gen_random_uuid());
alter table whatsapp_alertas add column if not exists medico_id   uuid;
alter table whatsapp_alertas add column if not exists paciente_id uuid;
alter table whatsapp_alertas add column if not exists conversa_id uuid;
alter table whatsapp_alertas add column if not exists nivel       text;   -- ex.: baixo | medio | alto
alter table whatsapp_alertas add column if not exists mensagem    text;
alter table whatsapp_alertas add column if not exists lido        boolean default false;
alter table whatsapp_alertas add column if not exists criado_em   timestamptz default now();
create index if not exists idx_wpp_alertas_medico on whatsapp_alertas(medico_id, criado_em desc);

create table if not exists whatsapp_nps (id uuid primary key default gen_random_uuid());
alter table whatsapp_nps add column if not exists medico_id   uuid;
alter table whatsapp_nps add column if not exists paciente_id uuid;
alter table whatsapp_nps add column if not exists conversa_id uuid;
alter table whatsapp_nps add column if not exists consulta_id uuid;
alter table whatsapp_nps add column if not exists nota        int;
alter table whatsapp_nps add column if not exists comentario  text;
alter table whatsapp_nps add column if not exists criado_em   timestamptz default now();
create index if not exists idx_wpp_nps_medico on whatsapp_nps(medico_id, criado_em desc);

create table if not exists whatsapp_campanhas (id uuid primary key default gen_random_uuid());
alter table whatsapp_campanhas add column if not exists medico_id     uuid;
alter table whatsapp_campanhas add column if not exists mensagem      text;
alter table whatsapp_campanhas add column if not exists filtro        jsonb default '{}'::jsonb;
alter table whatsapp_campanhas add column if not exists total_enviado int default 0;
alter table whatsapp_campanhas add column if not exists total_destino int default 0;
alter table whatsapp_campanhas add column if not exists status        text;
alter table whatsapp_campanhas add column if not exists criado_em     timestamptz default now();
create index if not exists idx_wpp_campanhas_medico on whatsapp_campanhas(medico_id, criado_em desc);

create table if not exists whatsapp_aderencia (id uuid primary key default gen_random_uuid());
alter table whatsapp_aderencia add column if not exists medico_id           uuid;
alter table whatsapp_aderencia add column if not exists paciente_id         uuid;   -- upsert onConflict paciente_id
alter table whatsapp_aderencia add column if not exists paciente            text;   -- nome (desnormalizado)
alter table whatsapp_aderencia add column if not exists score               numeric;
alter table whatsapp_aderencia add column if not exists nivel               text;
alter table whatsapp_aderencia add column if not exists taxa_presenca       numeric;
alter table whatsapp_aderencia add column if not exists dias_ultimo_contato int;
alter table whatsapp_aderencia add column if not exists pontos_positivos    jsonb default '[]'::jsonb;
alter table whatsapp_aderencia add column if not exists pontos_atencao      jsonb default '[]'::jsonb;
alter table whatsapp_aderencia add column if not exists recomendacao        text;
alter table whatsapp_aderencia add column if not exists calculado_em        timestamptz default now();
create index if not exists idx_wpp_aderencia_medico on whatsapp_aderencia(medico_id, score);


-- ────────────────────────────────────────────────────────────────────────────
-- 9. Sofia (IA do WhatsApp), assistente, notificações
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists sofia_config (id uuid primary key default gen_random_uuid());
alter table sofia_config add column if not exists medico_id                    uuid;
alter table sofia_config add column if not exists ativa                        boolean default true;
alter table sofia_config add column if not exists autonomia                    text default 'auto';   -- auto | supervisionado
alter table sofia_config add column if not exists saudacao                     text;
alter table sofia_config add column if not exists horario_funcionamento        jsonb;
alter table sofia_config add column if not exists duracao_consulta_padrao      int default 30;
alter table sofia_config add column if not exists preco_consulta               numeric(10,2);
alter table sofia_config add column if not exists precos_tipos                 jsonb default '{}'::jsonb;
alter table sofia_config add column if not exists pre_atendimento_ativo        boolean default true;
alter table sofia_config add column if not exists pre_atendimento_automatico   boolean default true;
alter table sofia_config add column if not exists pre_atendimento_prompt_extra text;
alter table sofia_config add column if not exists relatorio_diario_ativo       boolean default true;
alter table sofia_config add column if not exists relatorio_diario_canais      jsonb default '["whatsapp"]'::jsonb;  -- tipo incerto (pode ser text[])
alter table sofia_config add column if not exists relatorio_diario_horario     text default '07:00';
alter table sofia_config add column if not exists relatorio_whatsapp           text;
alter table sofia_config add column if not exists relatorio_email              text;
alter table sofia_config add column if not exists tipos_consulta_aceitos       jsonb default '["presencial"]'::jsonb; -- tipo incerto (pode ser text[])
alter table sofia_config add column if not exists lembrete_teleconsulta_min    int default 10;
alter table sofia_config add column if not exists criado_em                    timestamptz default now();
alter table sofia_config add column if not exists atualizado_em                timestamptz default now();

create table if not exists sofia_relatorios_log (id uuid primary key default gen_random_uuid());
alter table sofia_relatorios_log add column if not exists medico_id       uuid;
alter table sofia_relatorios_log add column if not exists data_referencia date;   -- upsert onConflict (medico_id, data_referencia, canal)
alter table sofia_relatorios_log add column if not exists canal           text;
alter table sofia_relatorios_log add column if not exists destinatario    text;
alter table sofia_relatorios_log add column if not exists conteudo        text;
alter table sofia_relatorios_log add column if not exists sucesso         boolean default true;
alter table sofia_relatorios_log add column if not exists criado_em       timestamptz default now();

create table if not exists assistente_conversas (id uuid primary key default gen_random_uuid());
alter table assistente_conversas add column if not exists medico_id     uuid;
alter table assistente_conversas add column if not exists clinica_id    uuid;
alter table assistente_conversas add column if not exists titulo        text default 'Nova conversa';
alter table assistente_conversas add column if not exists criado_em     timestamptz default now();
alter table assistente_conversas add column if not exists atualizado_em timestamptz default now();
create index if not exists idx_assist_conversas_medico on assistente_conversas(medico_id, atualizado_em desc);

create table if not exists assistente_mensagens (id uuid primary key default gen_random_uuid());
alter table assistente_mensagens add column if not exists conversa_id uuid;
alter table assistente_mensagens add column if not exists papel       text;   -- user | assistant
alter table assistente_mensagens add column if not exists conteudo    text;   -- tipo incerto (pode ser jsonb se guardar blocos)
alter table assistente_mensagens add column if not exists criado_em   timestamptz default now();
create index if not exists idx_assist_mensagens_conversa on assistente_mensagens(conversa_id, criado_em);

-- notificacoes_medico: ATENÇÃO — a coluna de data é criada_em (feminino).
create table if not exists notificacoes_medico (id uuid primary key default gen_random_uuid());
alter table notificacoes_medico add column if not exists medico_id      uuid;
alter table notificacoes_medico add column if not exists agendamento_id uuid;
alter table notificacoes_medico add column if not exists paciente_id    uuid;
alter table notificacoes_medico add column if not exists tipo           text;
alter table notificacoes_medico add column if not exists titulo         text;
alter table notificacoes_medico add column if not exists descricao      text;
alter table notificacoes_medico add column if not exists mensagem       text;
alter table notificacoes_medico add column if not exists link           text;
alter table notificacoes_medico add column if not exists lida           boolean default false;
alter table notificacoes_medico add column if not exists criada_em      timestamptz default now();
create index if not exists idx_notif_medico_medico on notificacoes_medico(medico_id, criada_em desc);
create index if not exists idx_notif_medico_agend  on notificacoes_medico(agendamento_id, tipo);

create table if not exists notificacoes_admin (id uuid primary key default gen_random_uuid());
alter table notificacoes_admin add column if not exists medico_id uuid;
alter table notificacoes_admin add column if not exists titulo    text;
alter table notificacoes_admin add column if not exists mensagem  text;
alter table notificacoes_admin add column if not exists lida      boolean default false;
alter table notificacoes_admin add column if not exists criado_em timestamptz default now();
create index if not exists idx_notif_admin_medico on notificacoes_admin(medico_id, criado_em desc);


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Financeiro legado e comandas
-- ────────────────────────────────────────────────────────────────────────────
-- comandas / comanda_itens: a 0001 MIGRA estas tabelas (renomeia e acrescenta
-- colunas). Aqui criamos só o mínimo que a 0001 pressupõe existir.
create table if not exists comandas (id uuid primary key default gen_random_uuid());
alter table comandas add column if not exists paciente_id     uuid;
alter table comandas add column if not exists status          text default 'rascunho';
do $$ begin
  -- só cria profissional_id se não houver a coluna legada medico_id (a 0001 renomeia)
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'comandas' and column_name = 'medico_id') then
    alter table comandas add column if not exists profissional_id uuid;
  end if;
end $$;
create index if not exists idx_comandas_paciente on comandas(paciente_id);

create table if not exists comanda_itens (id uuid primary key default gen_random_uuid());
alter table comanda_itens add column if not exists comanda_id      uuid;
alter table comanda_itens add column if not exists procedimento_id uuid;
alter table comanda_itens add column if not exists descricao       text;
alter table comanda_itens add column if not exists quantidade      numeric(10,2) default 1;
alter table comanda_itens add column if not exists valor_unitario  numeric(10,2) default 0;
-- valor_total: a 0001 recria como coluna gerada.

-- Financeiro "v1" ainda usado pela Agenda ao marcar atendimento como realizado
-- (app/agenda/page.tsx). Não confundir com recebimentos/despesas da 0001.
create table if not exists financeiro_categorias (id uuid primary key default gen_random_uuid());
alter table financeiro_categorias add column if not exists clinica_id uuid;
alter table financeiro_categorias add column if not exists nome       text;
alter table financeiro_categorias add column if not exists tipo       text;   -- receita | despesa
alter table financeiro_categorias add column if not exists ativo      boolean default true;
alter table financeiro_categorias add column if not exists criado_em  timestamptz default now();
create index if not exists idx_fin_categorias_clinica on financeiro_categorias(clinica_id, tipo);

create table if not exists financeiro_movimentacoes (id uuid primary key default gen_random_uuid());
alter table financeiro_movimentacoes add column if not exists clinica_id        uuid;
alter table financeiro_movimentacoes add column if not exists tipo              text;   -- receita | despesa
alter table financeiro_movimentacoes add column if not exists valor             numeric(12,2);
alter table financeiro_movimentacoes add column if not exists descricao         text;
alter table financeiro_movimentacoes add column if not exists data_movimentacao date;
alter table financeiro_movimentacoes add column if not exists categoria_id      uuid;
alter table financeiro_movimentacoes add column if not exists metodo_pagamento  text;
alter table financeiro_movimentacoes add column if not exists status            text;
alter table financeiro_movimentacoes add column if not exists paciente_id       uuid;
alter table financeiro_movimentacoes add column if not exists medico_id         uuid;
alter table financeiro_movimentacoes add column if not exists agendamento_id    uuid;
alter table financeiro_movimentacoes add column if not exists criado_em         timestamptz default now();
create index if not exists idx_fin_mov_clinica_data on financeiro_movimentacoes(clinica_id, data_movimentacao);

create table if not exists financeiro_pacotes (id uuid primary key default gen_random_uuid());
alter table financeiro_pacotes add column if not exists clinica_id     uuid;
alter table financeiro_pacotes add column if not exists paciente_id    uuid;
alter table financeiro_pacotes add column if not exists nome           text;
alter table financeiro_pacotes add column if not exists valor          numeric(12,2);
alter table financeiro_pacotes add column if not exists total_sessoes  int default 1;
alter table financeiro_pacotes add column if not exists sessoes_usadas int default 0;
alter table financeiro_pacotes add column if not exists status         text default 'ativo';   -- ativo | concluido
alter table financeiro_pacotes add column if not exists criado_em      timestamptz default now();
alter table financeiro_pacotes add column if not exists atualizado_em  timestamptz default now();
create index if not exists idx_fin_pacotes_paciente on financeiro_pacotes(paciente_id, status);


-- ────────────────────────────────────────────────────────────────────────────
-- 11. UNIQUE exigidos por upsert(onConflict) e por regra de negócio
--     (protegido: se houver duplicata nos dados, só avisa)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function pg_temp.c360_unico(nome text, tabela text, colunas text) returns void
language plpgsql as $$
begin
  execute format('create unique index if not exists %I on %I (%s)', nome, tabela, colunas);
exception when others then
  raise notice 'UNIQUE % não criado (dados duplicados?): %', nome, sqlerrm;
end $$;

select pg_temp.c360_unico('uq_whatsapp_config_medico',     'whatsapp_config',      'medico_id');
select pg_temp.c360_unico('uq_memed_tokens_medico',        'memed_tokens',         'medico_id');
select pg_temp.c360_unico('uq_password_resets_medico',     'password_resets',      'medico_id');
select pg_temp.c360_unico('uq_sofia_config_medico',        'sofia_config',         'medico_id');
select pg_temp.c360_unico('uq_sofia_relatorios_log',       'sofia_relatorios_log', 'medico_id, data_referencia, canal');
select pg_temp.c360_unico('uq_whatsapp_aderencia_paciente','whatsapp_aderencia',   'paciente_id');
select pg_temp.c360_unico('uq_teleconsultas_sala_id',      'teleconsultas',        'sala_id');
select pg_temp.c360_unico('uq_formularios_envios_token',   'formularios_envios',   'token');


-- ────────────────────────────────────────────────────────────────────────────
-- 12. FOREIGN KEYS
--
-- Necessárias porque o app usa joins do PostgREST (ex.: agendamentos →
-- pacientes(nome), formularios_envios → formularios_templates(*), clinicas →
-- planos(*)). Sem a FK o join devolve erro.
--
-- Regras do bloco:
--   * NOT VALID: não verifica linhas antigas (não falha com dado órfão).
--   * Se a coluna JÁ tem alguma FK, não cria outra (duas FKs para a mesma
--     tabela deixam o join do PostgREST ambíguo e quebram a tela).
--   * Qualquer erro (tipo diferente, tabela ausente) vira NOTICE.
--   * on delete: registros clínicos (consultas, prescrições) NÃO são apagados
--     em cascata — prontuário tem guarda obrigatória (CFM 1.821/2007: 20 anos).
--     Filhos puros (mensagens, itens) usam cascade.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function pg_temp.c360_fk(tabela text, coluna text, alvo text, acao text) returns void
language plpgsql as $$
begin
  if to_regclass(tabela) is null or to_regclass(alvo) is null then return; end if;
  if exists (
    select 1 from pg_constraint k
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    where k.contype = 'f' and k.conrelid = to_regclass(tabela) and a.attname = coluna
  ) then return; end if;
  execute format('alter table %I add constraint %I foreign key (%I) references %I(id) on delete %s not valid',
                 tabela, tabela || '_' || coluna || '_fkey', coluna, alvo, acao);
exception when others then
  raise notice 'FK %.% → % não criada: %', tabela, coluna, alvo, sqlerrm;
end $$;

-- cadastro
select pg_temp.c360_fk('clinicas',        'plano_id',   'planos',   'set null');
select pg_temp.c360_fk('clinica_admins',  'clinica_id', 'clinicas', 'cascade');
select pg_temp.c360_fk('medicos',         'clinica_id', 'clinicas', 'set null');
select pg_temp.c360_fk('atendentes',      'medico_id',  'medicos',  'cascade');
select pg_temp.c360_fk('pacientes',       'medico_id',  'medicos',  'set null');   -- join medico:medico_id(...)
select pg_temp.c360_fk('pacientes',       'clinica_id', 'clinicas', 'set null');
select pg_temp.c360_fk('procedimentos',   'clinica_id', 'clinicas', 'cascade');
-- agenda
select pg_temp.c360_fk('agendamentos',    'paciente_id',     'pacientes',     'set null');  -- join pacientes(...)
select pg_temp.c360_fk('agendamentos',    'medico_id',       'medicos',       'set null');  -- join medicos(...)
select pg_temp.c360_fk('agendamentos',    'procedimento_id', 'procedimentos', 'set null');
-- prontuário
select pg_temp.c360_fk('consultas',       'paciente_id', 'pacientes', 'set null');   -- join pacientes(...)
select pg_temp.c360_fk('consultas',       'medico_id',   'medicos',   'set null');
select pg_temp.c360_fk('prescricoes',     'medico_id',   'medicos',   'set null');   -- join medicos:medico_id(...)
select pg_temp.c360_fk('prescricoes',     'paciente_id', 'pacientes', 'set null');
select pg_temp.c360_fk('teleconsultas',   'paciente_id', 'pacientes', 'set null');   -- join pacientes(...)
select pg_temp.c360_fk('teleconsultas',   'medico_id',   'medicos',   'set null');
-- formulários
select pg_temp.c360_fk('formularios_envios',    'template_id', 'formularios_templates', 'set null');  -- join formularios_templates(*)
select pg_temp.c360_fk('formularios_envios',    'clinica_id',  'clinicas',              'cascade');   -- join clinicas(...)
select pg_temp.c360_fk('formularios_envios',    'medico_id',   'medicos',               'set null');  -- join medicos(...)
select pg_temp.c360_fk('formularios_respostas', 'envio_id',    'formularios_envios',    'cascade');
-- whatsapp
select pg_temp.c360_fk('whatsapp_mensagens', 'conversa_id', 'whatsapp_conversas', 'cascade');   -- join nos dois sentidos
select pg_temp.c360_fk('whatsapp_conversas', 'paciente_id', 'pacientes',          'set null');
select pg_temp.c360_fk('whatsapp_alertas',   'paciente_id', 'pacientes',          'cascade');    -- join pacientes(...)
select pg_temp.c360_fk('whatsapp_alertas',   'conversa_id', 'whatsapp_conversas', 'cascade');    -- join whatsapp_conversas(...)
select pg_temp.c360_fk('whatsapp_nps',       'paciente_id', 'pacientes',          'set null');   -- join pacientes(...)
select pg_temp.c360_fk('whatsapp_aderencia', 'paciente_id', 'pacientes',          'cascade');    -- join pacientes(...)
-- assistente
select pg_temp.c360_fk('assistente_mensagens', 'conversa_id', 'assistente_conversas', 'cascade');
-- comandas (joins pacientes:paciente_id / medicos:profissional_id / comandas!inner)
select pg_temp.c360_fk('comandas',      'paciente_id',     'pacientes', 'set null');
select pg_temp.c360_fk('comandas',      'profissional_id', 'medicos',   'set null');
select pg_temp.c360_fk('comanda_itens', 'comanda_id',      'comandas',  'cascade');


-- ────────────────────────────────────────────────────────────────────────────
-- 13. Realtime (o Chat assina whatsapp_conversas e whatsapp_mensagens)
--     Descomente se o banco foi recriado do zero:
-- ────────────────────────────────────────────────────────────────────────────
-- alter publication supabase_realtime add table whatsapp_conversas;
-- alter publication supabase_realtime add table whatsapp_mensagens;


-- ────────────────────────────────────────────────────────────────────────────
-- 14. RLS — PROJETO SEPARADO. NÃO descomente sem as policies prontas: hoje o
--     cliente usa a chave anon direto do navegador; ligar RLS sem policies
--     derruba o app inteiro.
-- ────────────────────────────────────────────────────────────────────────────
-- alter table clinicas                    enable row level security;
-- alter table clinica_admins              enable row level security;
-- alter table medicos                     enable row level security;
-- alter table atendentes                  enable row level security;
-- alter table password_resets             enable row level security;
-- alter table memed_tokens                enable row level security;
-- alter table pacientes                   enable row level security;
-- alter table procedimentos               enable row level security;
-- alter table agendamentos                enable row level security;
-- alter table bloqueios_agenda            enable row level security;
-- alter table agenda_publica_solicitacoes enable row level security;
-- alter table consultas                   enable row level security;
-- alter table prescricoes                 enable row level security;
-- alter table teleconsultas               enable row level security;
-- alter table sala_mensagens              enable row level security;
-- alter table pre_consultas               enable row level security;
-- alter table dicionario_clinico          enable row level security;
-- alter table formularios_templates       enable row level security;
-- alter table formularios_envios          enable row level security;
-- alter table formularios_respostas       enable row level security;
-- alter table whatsapp_config             enable row level security;
-- alter table whatsapp_conversas          enable row level security;
-- alter table whatsapp_mensagens          enable row level security;
-- alter table whatsapp_alertas            enable row level security;
-- alter table whatsapp_nps                enable row level security;
-- alter table whatsapp_campanhas          enable row level security;
-- alter table whatsapp_aderencia          enable row level security;
-- alter table sofia_config                enable row level security;
-- alter table sofia_relatorios_log        enable row level security;
-- alter table assistente_conversas        enable row level security;
-- alter table assistente_mensagens        enable row level security;
-- alter table notificacoes_medico         enable row level security;
-- alter table notificacoes_admin          enable row level security;
-- alter table financeiro_categorias       enable row level security;
-- alter table financeiro_movimentacoes    enable row level security;
-- alter table financeiro_pacotes          enable row level security;

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0001_financeiro_base.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Módulo Financeiro (baseado em comanda)
-- Fase 0 + Fase 1 — datado 2026-05-21
--
-- Rodar UMA VEZ no SQL Editor do Supabase. Bloco idempotente: pode reexecutar.
-- RLS desligado em todas as tabelas (convenção do projeto para tabelas
-- financeiras / multi-tenant por clinica_id em camada de aplicação).
--
-- ATENÇÃO: as tabelas 'comandas' e 'comanda_itens' JÁ EXISTEM. Este script
-- as MIGRA via ALTER preservando os dados — não recria.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Função utilitária — touch de updated_at
-- ────────────────────────────────────────────────────────────────────────────
create or replace function fn_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. formas_pagamento — lookup
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists formas_pagamento (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  nome                 text not null,
  permite_parcelamento boolean not null default false,
  ordem                int not null default 0,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now()
);
alter table formas_pagamento disable row level security;

insert into formas_pagamento (codigo, nome, permite_parcelamento, ordem) values
  ('dinheiro',       'Dinheiro',          false, 1),
  ('pix',            'PIX',               false, 2),
  ('cartao_credito', 'Cartão de crédito', true,  3),
  ('cartao_debito',  'Cartão de débito',  false, 4),
  ('transferencia',  'Transferência',     false, 5),
  ('convenio',       'Convênio',          false, 6),
  ('boleto',         'Boleto',            true,  7)
on conflict (codigo) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. comandas — MIGRAÇÃO da tabela existente
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- renomeia colunas para o novo padrão
  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='medico_id')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='profissional_id')
  then alter table comandas rename column medico_id to profissional_id; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='observacao')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='observacoes')
  then alter table comandas rename column observacao to observacoes; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='total')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='valor_total')
  then alter table comandas rename column total to valor_total; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='criada_em')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='created_at')
  then alter table comandas rename column criada_em to created_at; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechada_em')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechado_em')
  then alter table comandas rename column fechada_em to fechado_em; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechada_por')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechado_por')
  then alter table comandas rename column fechada_por to fechado_por; end if;
end $$;

-- coluna legada substituída pela generated valor_final
alter table comandas drop column if exists total_liquido;

-- novas colunas
alter table comandas add column if not exists clinica_id      uuid;
alter table comandas add column if not exists agendamento_id  uuid;
alter table comandas add column if not exists profissional_id uuid;
alter table comandas add column if not exists origem          text not null default 'avulsa';
alter table comandas add column if not exists valor_estimado  numeric(10,2);
alter table comandas add column if not exists valor_total     numeric(10,2);
alter table comandas add column if not exists desconto        numeric(10,2);
alter table comandas add column if not exists acrescimo       numeric(10,2) not null default 0;
alter table comandas add column if not exists observacoes     text;
alter table comandas add column if not exists aberto_em       timestamptz;
alter table comandas add column if not exists fechado_em      timestamptz;
alter table comandas add column if not exists fechado_por     uuid;
alter table comandas add column if not exists created_at      timestamptz not null default now();
alter table comandas add column if not exists updated_at      timestamptz not null default now();

-- normaliza nulos antes de aplicar defaults / not null
update comandas set valor_total = 0  where valor_total is null;
update comandas set desconto    = 0  where desconto is null;
update comandas set acrescimo   = 0  where acrescimo is null;
update comandas set aberto_em   = created_at where aberto_em is null and status <> 'rascunho';

alter table comandas alter column valor_total set default 0;
alter table comandas alter column valor_total set not null;
alter table comandas alter column desconto    set default 0;
alter table comandas alter column desconto    set not null;
alter table comandas alter column status      set default 'rascunho';

-- valor_final = valor_total - desconto + acrescimo (coluna gerada)
alter table comandas add column if not exists valor_final numeric(10,2)
  generated always as (coalesce(valor_total,0) - coalesce(desconto,0) + coalesce(acrescimo,0)) stored;

-- recria check de status com os novos estados
alter table comandas drop constraint if exists comandas_status_check;
alter table comandas add  constraint comandas_status_check
  check (status in ('rascunho','aberta','fechada','paga','cancelada'));

alter table comandas drop constraint if exists comandas_origem_check;
alter table comandas add  constraint comandas_origem_check
  check (origem in ('agendamento','avulsa'));

create index if not exists idx_comandas_clinica          on comandas(clinica_id);
create index if not exists idx_comandas_clinica_status   on comandas(clinica_id, status);
create index if not exists idx_comandas_clinica_paciente on comandas(clinica_id, paciente_id);
create index if not exists idx_comandas_agendamento      on comandas(agendamento_id);

drop trigger if exists trg_comandas_touch on comandas;
create trigger trg_comandas_touch before update on comandas
  for each row execute function fn_touch_updated_at();

alter table comandas disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. comanda_itens — MIGRAÇÃO da tabela existente
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if  exists (select 1 from information_schema.columns where table_name='comanda_itens' and column_name='criado_em')
  and not exists (select 1 from information_schema.columns where table_name='comanda_itens' and column_name='created_at')
  then alter table comanda_itens rename column criado_em to created_at; end if;
end $$;

alter table comanda_itens add column if not exists tipo            text not null default 'outro';
alter table comanda_itens add column if not exists profissional_id uuid;
alter table comanda_itens add column if not exists observacoes     text;
alter table comanda_itens add column if not exists created_at      timestamptz not null default now();

update comanda_itens set quantidade = 1 where quantidade is null;
alter table comanda_itens alter column quantidade set default 1;

-- valor_total passa a ser coluna gerada (quantidade * valor_unitario)
alter table comanda_itens drop column if exists valor_total;
alter table comanda_itens add  column valor_total numeric(10,2)
  generated always as (coalesce(quantidade,1) * coalesce(valor_unitario,0)) stored;

alter table comanda_itens drop constraint if exists comanda_itens_tipo_check;
alter table comanda_itens add  constraint comanda_itens_tipo_check
  check (tipo in ('consulta','procedimento','exame','produto','pacote','outro'));

create index if not exists idx_comanda_itens_comanda on comanda_itens(comanda_id);

alter table comanda_itens disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. recebimentos — contas a receber
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists recebimentos (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references clinicas(id) on delete cascade,
  comanda_id         uuid references comandas(id) on delete set null,
  paciente_id        uuid references pacientes(id) on delete set null,
  forma_pagamento_id uuid references formas_pagamento(id),
  status             text not null default 'pendente'
                       check (status in ('pendente','pago','parcial','atrasado','cancelado','reembolsado')),
  valor              numeric(10,2) not null,
  valor_pago         numeric(10,2) not null default 0,
  parcela_numero     int,
  parcela_total      int,
  vencimento         date,
  pago_em            timestamptz,
  pago_por           uuid,
  observacoes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_recebimentos_clinica            on recebimentos(clinica_id);
create index if not exists idx_recebimentos_clinica_status     on recebimentos(clinica_id, status);
create index if not exists idx_recebimentos_clinica_vencimento on recebimentos(clinica_id, vencimento);
create index if not exists idx_recebimentos_comanda            on recebimentos(comanda_id);

drop trigger if exists trg_recebimentos_touch on recebimentos;
create trigger trg_recebimentos_touch before update on recebimentos
  for each row execute function fn_touch_updated_at();

alter table recebimentos disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. despesas — contas a pagar (tabela já criada; UI virá na Fase 2)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists despesas (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null references clinicas(id) on delete cascade,
  categoria                text,
  descricao                text not null,
  fornecedor               text,
  valor                    numeric(10,2) not null,
  vencimento               date,
  status                   text not null default 'pendente'
                             check (status in ('pendente','pago','atrasado','cancelado')),
  pago_em                  timestamptz,
  forma_pagamento_id       uuid references formas_pagamento(id),
  recorrente               boolean not null default false,
  recorrencia_periodicidade text check (recorrencia_periodicidade in ('semanal','mensal','anual')),
  observacoes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_despesas_clinica            on despesas(clinica_id);
create index if not exists idx_despesas_clinica_status     on despesas(clinica_id, status);
create index if not exists idx_despesas_clinica_vencimento on despesas(clinica_id, vencimento);

drop trigger if exists trg_despesas_touch on despesas;
create trigger trg_despesas_touch before update on despesas
  for each row execute function fn_touch_updated_at();

alter table despesas disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. movimentacoes_caixa — fluxo de caixa unificado
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists movimentacoes_caixa (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references clinicas(id) on delete cascade,
  tipo               text not null check (tipo in ('entrada','saida')),
  origem             text not null check (origem in ('recebimento','despesa','ajuste_manual','estorno')),
  recebimento_id     uuid references recebimentos(id) on delete set null,
  despesa_id         uuid references despesas(id) on delete set null,
  forma_pagamento_id uuid references formas_pagamento(id),
  valor              numeric(10,2) not null,
  data_movimentacao  date not null default current_date,
  descricao          text,
  criado_por         uuid,
  created_at         timestamptz not null default now()
);
create index if not exists idx_movcaixa_clinica      on movimentacoes_caixa(clinica_id);
create index if not exists idx_movcaixa_clinica_data on movimentacoes_caixa(clinica_id, data_movimentacao);

alter table movimentacoes_caixa disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Trigger — cria comanda rascunho quando agendamento vira 'confirmado'
-- ────────────────────────────────────────────────────────────────────────────
create or replace function fn_criar_comanda_agendamento()
returns trigger as $$
declare
  v_clinica_id uuid;
  v_valor      numeric(10,2);
begin
  if new.status = 'confirmado'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmado') then

    -- não duplica se já existe comanda para este agendamento
    if not exists (select 1 from comandas where agendamento_id = new.id) then
      select clinica_id into v_clinica_id from medicos where id = new.medico_id;
      select valor      into v_valor      from procedimentos where id = new.procedimento_id;

      insert into comandas
        (clinica_id, agendamento_id, paciente_id, profissional_id,
         valor_estimado, status, origem)
      values
        (v_clinica_id, new.id, new.paciente_id, new.medico_id,
         v_valor, 'rascunho', 'agendamento');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_criar_comanda_agendamento on agendamentos;
create trigger trg_criar_comanda_agendamento
  after insert or update of status on agendamentos
  for each row execute function fn_criar_comanda_agendamento();

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0002_financeiro_repasses.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 3
-- Repasse médico / comissões — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql. Idempotente.
-- A tabela 'despesas' já foi criada na Fase 1 — esta fase só adiciona repasses.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. repasse_regras — configuração de comissão por profissional
--    tipo_item NULL = regra padrão do profissional; preenchido = regra específica
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists repasse_regras (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references clinicas(id) on delete cascade,
  profissional_id uuid not null references medicos(id) on delete cascade,
  tipo_item       text check (tipo_item in ('consulta','procedimento','exame','produto','pacote','outro')),
  percentual      numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_repasse_regras_clinica      on repasse_regras(clinica_id);
create index if not exists idx_repasse_regras_profissional on repasse_regras(clinica_id, profissional_id);

drop trigger if exists trg_repasse_regras_touch on repasse_regras;
create trigger trg_repasse_regras_touch before update on repasse_regras
  for each row execute function fn_touch_updated_at();

alter table repasse_regras disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. repasses — repasses gerados (1 por item de comanda paga)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists repasses (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references clinicas(id) on delete cascade,
  profissional_id uuid not null references medicos(id) on delete cascade,
  comanda_id      uuid references comandas(id) on delete set null,
  comanda_item_id uuid references comanda_itens(id) on delete set null,
  descricao       text,
  base_calculo    numeric(10,2) not null,
  percentual      numeric(5,2) not null,
  valor           numeric(10,2) not null,
  status          text not null default 'pendente'
                    check (status in ('pendente','aprovado','pago','cancelado')),
  competencia     date not null,
  pago_em         timestamptz,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_repasses_clinica         on repasses(clinica_id);
create index if not exists idx_repasses_clinica_status  on repasses(clinica_id, status);
create index if not exists idx_repasses_profissional    on repasses(clinica_id, profissional_id);
create index if not exists idx_repasses_competencia     on repasses(clinica_id, competencia);
create index if not exists idx_repasses_comanda         on repasses(comanda_id);

drop trigger if exists trg_repasses_touch on repasses;
create trigger trg_repasses_touch before update on repasses
  for each row execute function fn_touch_updated_at();

alter table repasses disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. movimentacoes_caixa — inclui 'repasse' como origem de saída
-- ────────────────────────────────────────────────────────────────────────────
alter table movimentacoes_caixa drop constraint if exists movimentacoes_caixa_origem_check;
alter table movimentacoes_caixa add  constraint movimentacoes_caixa_origem_check
  check (origem in ('recebimento','despesa','ajuste_manual','estorno','repasse'));

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0003_financeiro_custos_procedimento.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 4
-- Custo de procedimentos (para cálculo de margem) — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql. Idempotente.
-- ============================================================================

-- Custos por procedimento — usados para calcular margem e ROI por serviço.
alter table procedimentos add column if not exists custo_insumos     numeric(10,2) not null default 0;
alter table procedimentos add column if not exists custo_operacional numeric(10,2) not null default 0;

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0004_financeiro_multiunidade_gateway.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 6
-- Multiunidade + scaffold de gateway de pagamento — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql. Idempotente.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. unidades — filiais / unidades da clínica
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists unidades (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references clinicas(id) on delete cascade,
  nome        text not null,
  endereco    text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_unidades_clinica on unidades(clinica_id);

drop trigger if exists trg_unidades_touch on unidades;
create trigger trg_unidades_touch before update on unidades
  for each row execute function fn_touch_updated_at();

alter table unidades disable row level security;

-- unidade_id nas tabelas financeiras (nulo = consolidado / matriz)
alter table comandas            add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table despesas            add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table recebimentos        add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table movimentacoes_caixa add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table repasses            add column if not exists unidade_id uuid references unidades(id) on delete set null;

create index if not exists idx_comandas_unidade            on comandas(unidade_id);
create index if not exists idx_despesas_unidade            on despesas(unidade_id);
create index if not exists idx_recebimentos_unidade        on recebimentos(unidade_id);
create index if not exists idx_movcaixa_unidade            on movimentacoes_caixa(unidade_id);
create index if not exists idx_repasses_unidade            on repasses(unidade_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. gateway_config — configuração do provedor de pagamento (scaffold)
--    Credenciais sensíveis NÃO ficam aqui — entram via env quando o
--    provedor real for conectado. 'config' guarda apenas ajustes não-secretos.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists gateway_config (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null unique references clinicas(id) on delete cascade,
  provedor    text,
  ativo       boolean not null default false,
  ambiente    text not null default 'sandbox' check (ambiente in ('sandbox','producao')),
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_gateway_config_touch on gateway_config;
create trigger trg_gateway_config_touch before update on gateway_config
  for each row execute function fn_touch_updated_at();

alter table gateway_config disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. cobrancas — cobranças geradas via gateway (PIX, cartão, boleto, link)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists cobrancas (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null references clinicas(id) on delete cascade,
  unidade_id     uuid references unidades(id) on delete set null,
  recebimento_id uuid references recebimentos(id) on delete set null,
  paciente_id    uuid references pacientes(id) on delete set null,
  valor          numeric(10,2) not null,
  metodo         text not null check (metodo in ('pix','cartao','boleto','link')),
  provedor       text,
  status         text not null default 'pendente'
                   check (status in ('pendente','pago','expirado','cancelado','erro')),
  link_pagamento text,
  qr_code        text,
  external_id    text,
  expira_em      timestamptz,
  pago_em        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_cobrancas_clinica        on cobrancas(clinica_id);
create index if not exists idx_cobrancas_clinica_status on cobrancas(clinica_id, status);
create index if not exists idx_cobrancas_recebimento    on cobrancas(recebimento_id);

drop trigger if exists trg_cobrancas_touch on cobrancas;
create trigger trg_cobrancas_touch before update on cobrancas
  for each row execute function fn_touch_updated_at();

alter table cobrancas disable row level security;

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0005_financeiro_medico_unidade.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 7
-- Multiunidade: vínculo médico ↔ unidade — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql e fase6. Idempotente.
-- ============================================================================

-- Unidade principal do médico. Comandas geradas a partir de agendamentos
-- confirmados herdam a unidade do médico responsável.
alter table medicos add column if not exists unidade_id uuid references unidades(id) on delete set null;
create index if not exists idx_medicos_unidade on medicos(unidade_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger atualizado — comanda herda a unidade do médico do agendamento
-- ────────────────────────────────────────────────────────────────────────────
create or replace function fn_criar_comanda_agendamento()
returns trigger as $$
declare
  v_clinica_id uuid;
  v_unidade_id uuid;
  v_valor      numeric(10,2);
begin
  if new.status = 'confirmado'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmado') then

    if not exists (select 1 from comandas where agendamento_id = new.id) then
      select clinica_id, unidade_id
        into v_clinica_id, v_unidade_id
        from medicos where id = new.medico_id;
      select valor into v_valor from procedimentos where id = new.procedimento_id;

      insert into comandas
        (clinica_id, unidade_id, agendamento_id, paciente_id, profissional_id,
         valor_estimado, status, origem)
      values
        (v_clinica_id, v_unidade_id, new.id, new.paciente_id, new.medico_id,
         v_valor, 'rascunho', 'agendamento');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0006_financeiro_contas_bancarias.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Financeiro 2.0 · Estágio 1
-- Contas bancárias — datado 2026-05-21
--
-- Rodar DEPOIS de 0001..0005. Idempotente.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. contas_bancarias — onde o dinheiro fica (bancos, caixa, carteiras)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists contas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid not null references clinicas(id) on delete cascade,
  unidade_id    uuid references unidades(id) on delete set null,
  nome          text not null,
  instituicao   text,
  tipo          text not null default 'corrente'
                  check (tipo in ('corrente','poupanca','caixa','carteira_digital')),
  saldo_inicial numeric(12,2) not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_contas_bancarias_clinica on contas_bancarias(clinica_id);

drop trigger if exists trg_contas_bancarias_touch on contas_bancarias;
create trigger trg_contas_bancarias_touch before update on contas_bancarias
  for each row execute function fn_touch_updated_at();

alter table contas_bancarias disable row level security;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. movimentacoes_caixa — cada movimento pertence a uma conta
-- ────────────────────────────────────────────────────────────────────────────
alter table movimentacoes_caixa
  add column if not exists conta_id uuid references contas_bancarias(id) on delete set null;
create index if not exists idx_movcaixa_conta on movimentacoes_caixa(conta_id);

-- 'transferencia' entra como origem válida (transferência entre contas)
alter table movimentacoes_caixa drop constraint if exists movimentacoes_caixa_origem_check;
alter table movimentacoes_caixa add  constraint movimentacoes_caixa_origem_check
  check (origem in ('recebimento','despesa','ajuste_manual','estorno','repasse','transferencia'));

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0007_financeiro_auditoria.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Financeiro 2.0 · Estágio 3
-- Log de auditoria — datado 2026-05-21
--
-- Rodar DEPOIS de 0001..0006. Idempotente.
-- ============================================================================

-- Trilha de auditoria: registra cada ação financeira sensível (fechamento de
-- comanda, baixas, pagamentos, transferências, ajustes) para rastrear erros.
create table if not exists financeiro_auditoria (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references clinicas(id) on delete cascade,
  usuario_id  uuid,
  acao        text not null,
  entidade    text,
  entidade_id uuid,
  detalhe     text,
  valor       numeric(12,2),
  created_at  timestamptz not null default now()
);
create index if not exists idx_fin_auditoria_clinica      on financeiro_auditoria(clinica_id);
create index if not exists idx_fin_auditoria_clinica_data on financeiro_auditoria(clinica_id, created_at desc);

alter table financeiro_auditoria disable row level security;

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0008_financeiro_conciliacao.sql
-- ############################################################
-- ============================================================================
-- Clinical 360 — Financeiro 2.0 · Estágio 4
-- Conciliação bancária — datado 2026-05-21
--
-- Rodar DEPOIS de 0001..0007. Idempotente.
-- ============================================================================

-- Marca de conciliação: indica que a movimentação foi confirmada contra o
-- extrato bancário importado.
alter table movimentacoes_caixa
  add column if not exists conciliado    boolean not null default false;
alter table movimentacoes_caixa
  add column if not exists conciliado_em timestamptz;

create index if not exists idx_movcaixa_conciliacao
  on movimentacoes_caixa(conta_id, conciliado);

-- ============================================================================
-- FIM
-- ============================================================================


-- ############################################################
-- 0009_chat_omnicanal.sql
-- ############################################################
-- 0009 — Chat omnicanal (WhatsApp, Instagram, Messenger) dentro do app
--
-- As tabelas whatsapp_conversas / whatsapp_mensagens foram criadas fora do repo.
-- Aqui só ACRESCENTAMOS colunas (idempotente) para: etapa do kanban, fixar,
-- arquivar, silenciar, bloquear — e a tabela de respostas rápidas.
-- Notas internas usam whatsapp_mensagens.metadata->>'nota' = 'true' (sem coluna nova).

alter table whatsapp_conversas add column if not exists etapa text;            -- novo | atendimento | aguardando | agendado | concluido
alter table whatsapp_conversas add column if not exists fixada boolean not null default false;
alter table whatsapp_conversas add column if not exists arquivada boolean not null default false;
alter table whatsapp_conversas add column if not exists silenciada_ate timestamptz; -- null = não silenciada; 'infinity' = sempre
alter table whatsapp_conversas add column if not exists bloqueada boolean not null default false;
alter table whatsapp_conversas add column if not exists canal text;            -- já usado pelos webhooks de Instagram/Messenger

create index if not exists whatsapp_conversas_medico_etapa_idx on whatsapp_conversas (medico_id, etapa);

create table if not exists chat_respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  atalho text not null,          -- ex.: "horarios" → digitar /horarios no chat
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists chat_respostas_rapidas_medico_idx on chat_respostas_rapidas (medico_id);


-- ############################################################
-- 0010_confirmacoes_lista_espera.sql
-- ############################################################
-- 0010 — Confirmação automática (48h / 24h / 2h), combate à falta e lista de espera real
--
-- Idempotente: pode rodar mais de uma vez.
-- Usado por: /api/cron/confirmacoes (cron), /api/lista-espera (Agenda),
-- components/minha-clinica/Automacoes.tsx (aba Confirmações).

-- ── Configuração por médico ────────────────────────────────────────────────
create table if not exists confirmacao_config (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null unique,
  lembrete_48h boolean not null default true,
  confirmacao_24h boolean not null default true,
  lembrete_2h boolean not null default true,
  oferecer_vaga_lista boolean not null default true,
  -- Placeholders: {nome} {data} {hora} {medico} {clinica}. Null = modelo padrão do sistema.
  modelo_48h text,
  modelo_24h text,
  modelo_2h text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ── Agendamentos: controle de lembretes e confirmação ─────────────────────
-- (confirmacao_24h_enviada / confirmacao_24h_status já existem no banco)
alter table agendamentos add column if not exists confirmacao_24h_enviada boolean default false;
alter table agendamentos add column if not exists confirmacao_24h_status text;
alter table agendamentos add column if not exists confirmacao_24h_resposta_em timestamptz;
alter table agendamentos add column if not exists lembrete_48h_enviado boolean default false;
alter table agendamentos add column if not exists lembrete_2h_enviado boolean default false;
alter table agendamentos add column if not exists confirmado_em timestamptz;
alter table agendamentos add column if not exists confirmado_via text;   -- whatsapp | manual | telefone

create index if not exists agendamentos_medico_data_idx on agendamentos (medico_id, data_hora);

-- ── Lista de espera ────────────────────────────────────────────────────────
create table if not exists lista_espera (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  paciente_id uuid,                       -- null = contato avulso (nome + telefone)
  nome text not null,
  telefone text,
  tipo text not null default 'consulta' check (tipo in ('consulta', 'retorno', 'exame')),
  preferencia_dias int[] not null default '{}',   -- 0 = domingo … 6 = sábado; vazio = qualquer dia
  preferencia_periodo text not null default 'qualquer' check (preferencia_periodo in ('manha', 'tarde', 'noite', 'qualquer')),
  observacao text,
  prioridade int not null default 0,      -- 0 normal, 1 alta, 2 urgente
  status text not null default 'aguardando' check (status in ('aguardando', 'oferecido', 'agendado', 'removido')),
  oferecido_em timestamptz,
  oferta_data_hora timestamptz,           -- horário oferecido por WhatsApp (resposta "Quero esse horário")
  oferta_duracao int,
  agendamento_id uuid,
  criado_em timestamptz not null default now()
);

alter table lista_espera add column if not exists oferta_data_hora timestamptz;
alter table lista_espera add column if not exists oferta_duracao int;

create index if not exists lista_espera_medico_status_idx on lista_espera (medico_id, status);
create index if not exists lista_espera_telefone_idx on lista_espera (telefone) where status = 'oferecido';


-- ############################################################
-- 0011_retornos.sql
-- ############################################################
-- 0011 — Retornos e reativação de pacientes
--
-- retornos               : retorno previsto de um paciente (manual, sugerido pela IA ou vindo da consulta).
--                          O cron /api/cron/retornos lembra o paciente N dias antes (lembrete_enviado_em).
-- campanhas_reativacao   : campanha de WhatsApp para pacientes inativos.
-- campanhas_envios       : uma linha por destinatário da campanha.
--                          Além de enviado|falhou|respondeu, usa 'pendente' (fila) e 'processando'
--                          (reservado por um lote) para o envio ser retomável e nunca duplicar.
-- Idempotente.

create table if not exists retornos (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  consulta_id uuid,
  data_prevista date not null,
  motivo text,
  origem text not null default 'manual',
  status text not null default 'pendente',
  lembrete_enviado_em timestamptz,
  agendamento_id uuid,
  criado_em timestamptz not null default now()
);

do $$ begin
  alter table retornos add constraint retornos_origem_chk check (origem in ('manual', 'ia', 'consulta'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table retornos add constraint retornos_status_chk check (status in ('pendente', 'lembrado', 'agendado', 'concluido', 'descartado'));
exception when duplicate_object then null; end $$;

create index if not exists retornos_medico_data_idx on retornos (medico_id, data_prevista);
create index if not exists retornos_medico_status_idx on retornos (medico_id, status);
create index if not exists retornos_paciente_idx on retornos (paciente_id);
-- Cron: pendentes ainda sem lembrete
create index if not exists retornos_lembrete_idx on retornos (data_prevista) where status = 'pendente' and lembrete_enviado_em is null;

create table if not exists campanhas_reativacao (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  nome text not null,
  mensagem text not null,
  filtro jsonb not null default '{}'::jsonb,
  total_destinatarios integer not null default 0,
  enviados integer not null default 0,
  falhas integer not null default 0,
  status text not null default 'rascunho',
  criado_em timestamptz not null default now(),
  concluida_em timestamptz
);

do $$ begin
  alter table campanhas_reativacao add constraint campanhas_reativacao_status_chk check (status in ('rascunho', 'enviando', 'concluida'));
exception when duplicate_object then null; end $$;

create index if not exists campanhas_reativacao_medico_idx on campanhas_reativacao (medico_id, criado_em desc);
create index if not exists campanhas_reativacao_status_idx on campanhas_reativacao (status) where status = 'enviando';

create table if not exists campanhas_envios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas_reativacao(id) on delete cascade,
  paciente_id uuid,
  telefone text,
  status text not null default 'pendente',
  erro text,
  enviado_em timestamptz
);

do $$ begin
  alter table campanhas_envios add constraint campanhas_envios_status_chk check (status in ('pendente', 'processando', 'enviado', 'falhou', 'respondeu'));
exception when duplicate_object then null; end $$;

create index if not exists campanhas_envios_campanha_idx on campanhas_envios (campanha_id, status);
create unique index if not exists campanhas_envios_unico_idx on campanhas_envios (campanha_id, paciente_id);
create index if not exists campanhas_envios_paciente_idx on campanhas_envios (paciente_id);


-- ############################################################
-- 0012_faturamento_tiss.sql
-- ############################################################
-- 0012 — Faturamento de convênios no padrão TISS (ANS)
--
-- Fluxo: operadora → guias (consulta / SP-SADT) → lote → XML TISS exportado e
-- enviado no portal/webservice da operadora → retorno (pagamento / glosa).
-- Escopo: cada operadora pertence a uma clínica (clinica_id) OU a um médico
-- autônomo (medico_id). Guias e lotes herdam o escopo pela operadora.
-- Idempotente: pode rodar mais de uma vez.

create table if not exists operadoras (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid,
  medico_id uuid,
  nome text not null,
  registro_ans varchar(6) not null,                 -- registro da operadora na ANS (6 dígitos)
  codigo_prestador varchar(20),                     -- código do prestador (clínica/médico) NA operadora
  cnpj_operadora varchar(14),
  cnes varchar(7) default '9999999',                -- CNES do prestador (9999999 = não possui)
  nome_contratado text,                             -- razão social / nome do prestador
  versao_tiss varchar(10) not null default '4.01.00',
  prazo_pagamento_dias int default 30,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table operadoras add column if not exists cnes varchar(7) default '9999999';
alter table operadoras add column if not exists nome_contratado text;
alter table operadoras add column if not exists ultimo_numero_guia int not null default 0;  -- sequencial de guias
alter table operadoras add column if not exists ultimo_numero_lote int not null default 0;  -- sequencial de lotes
create index if not exists operadoras_clinica_idx on operadoras (clinica_id);
create index if not exists operadoras_medico_idx on operadoras (medico_id);

create table if not exists tabela_precos (
  id uuid primary key default gen_random_uuid(),
  operadora_id uuid not null references operadoras(id) on delete cascade,
  codigo_tuss varchar(10) not null,
  descricao text not null,
  valor numeric(12,2) not null default 0,
  criado_em timestamptz not null default now()
);
create unique index if not exists tabela_precos_operadora_codigo_uk on tabela_precos (operadora_id, codigo_tuss);

create table if not exists lotes_tiss (
  id uuid primary key default gen_random_uuid(),
  operadora_id uuid not null references operadoras(id) on delete cascade,
  numero_lote int not null,
  tipo_guia text not null default 'consulta' check (tipo_guia in ('consulta','sp_sadt')),  -- TISS: um lote só tem um tipo de guia
  competencia varchar(7) not null,                  -- yyyy-mm
  quantidade_guias int not null default 0,
  valor_total numeric(12,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto','enviado','processado')),
  enviado_em timestamptz,
  protocolo text,
  xml_hash varchar(32),
  criado_em timestamptz not null default now()
);
alter table lotes_tiss add column if not exists tipo_guia text not null default 'consulta';
create unique index if not exists lotes_tiss_operadora_numero_uk on lotes_tiss (operadora_id, numero_lote);

create table if not exists guias_tiss (
  id uuid primary key default gen_random_uuid(),
  operadora_id uuid not null references operadoras(id) on delete restrict,
  medico_id uuid,
  paciente_id uuid,
  consulta_id uuid,
  agendamento_id uuid,
  tipo text not null default 'consulta' check (tipo in ('consulta','sp_sadt')),
  numero_guia_prestador varchar(20) not null,        -- sequencial por operadora
  numero_guia_operadora varchar(20),                 -- senha/nº de autorização, quando houver
  numero_carteira varchar(20),
  nome_beneficiario text,
  data_atendimento date not null default current_date,
  cid_principal varchar(6),                          -- uso interno (as guias de consulta/SP-SADT TISS 4 não levam CID)
  procedimentos jsonb not null default '[]'::jsonb,  -- [{codigo_tuss, descricao, quantidade, valor_unitario}]
  valor_total numeric(12,2) not null default 0,
  tipo_consulta varchar(1) default '1',              -- 1 primeira | 2 seguimento | 3 pré-natal | 4 por encaminhamento
  tipo_atendimento varchar(2) default '05',          -- SP/SADT (tabela 50): 04 consulta, 05 exame ambulatorial...
  indicacao_acidente varchar(1) not null default '9',-- 9 = não acidente
  carater_atendimento varchar(1) not null default '1',-- 1 eletivo | 2 urgência/emergência
  profissional jsonb,                                -- {nome, conselho:'06', numero, uf:'35', cbos}
  observacao text,
  status text not null default 'rascunho'
    check (status in ('rascunho','pronta','em_lote','enviada','paga','glosada','paga_parcial')),
  valor_pago numeric(12,2),
  valor_glosado numeric(12,2),
  motivo_glosa text,
  retorno_em timestamptz,
  historico jsonb not null default '[]'::jsonb,      -- [{em, evento, detalhe}]
  lote_id uuid references lotes_tiss(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table guias_tiss add column if not exists numero_guia_operadora varchar(20);
alter table guias_tiss add column if not exists tipo_atendimento varchar(2) default '05';
alter table guias_tiss add column if not exists profissional jsonb;
alter table guias_tiss add column if not exists observacao text;
alter table guias_tiss add column if not exists retorno_em timestamptz;
alter table guias_tiss add column if not exists historico jsonb not null default '[]'::jsonb;

create unique index if not exists guias_tiss_operadora_numero_uk on guias_tiss (operadora_id, numero_guia_prestador);
create index if not exists guias_tiss_operadora_status_idx on guias_tiss (operadora_id, status);
create index if not exists guias_tiss_lote_idx on guias_tiss (lote_id);
create index if not exists guias_tiss_consulta_idx on guias_tiss (consulta_id);
create index if not exists guias_tiss_data_idx on guias_tiss (data_atendimento);


-- ############################################################
-- 0013_auditoria_acessos.sql
-- ############################################################
-- 0013 — Registro de acessos ao prontuário (LGPD art. 37 / CFM 1.821/2007 e 2.299/2021)
--
-- Uma linha por acesso relevante a dado de saúde: quem (usuário), o quê (ação +
-- recurso), de qual paciente, quando, de onde (IP / user-agent).
-- Gravado por POST /api/auditoria (service role) — lib/auditoria.ts no cliente.
-- Lido por GET /api/auditoria (PainelAuditoria e AcessosDoPaciente).
--
-- Tabela só de INSERÇÃO: o app nunca atualiza nem apaga linhas daqui.
-- Idempotente: pode rodar mais de uma vez.

create table if not exists auditoria_acessos (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid,
  medico_id    uuid,                -- médico "dono" do contexto (para admin/recepção: o médico da clínica)
  usuario_id   uuid,
  usuario_nome text,
  usuario_tipo text not null default 'medico',
  acao         text not null,
  recurso      text not null,
  recurso_id   text,                -- text: alguns recursos (sala, exame) não usam uuid
  paciente_id  uuid,
  detalhes     jsonb not null default '{}'::jsonb,
  ip           text,
  user_agent   text,
  criado_em    timestamptz not null default now()
);

do $$ begin
  alter table auditoria_acessos add constraint auditoria_acessos_usuario_tipo_chk
    check (usuario_tipo in ('medico', 'admin', 'recepcionista', 'atendente'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table auditoria_acessos add constraint auditoria_acessos_acao_chk
    check (acao in ('visualizou', 'editou', 'exportou', 'imprimiu', 'excluiu'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table auditoria_acessos add constraint auditoria_acessos_recurso_chk
    check (recurso in ('paciente', 'consulta', 'prontuario', 'exame', 'conversa'));
exception when duplicate_object then null; end $$;

create index if not exists idx_auditoria_acessos_paciente on auditoria_acessos (paciente_id, criado_em desc);
create index if not exists idx_auditoria_acessos_medico   on auditoria_acessos (medico_id, criado_em desc);
create index if not exists idx_auditoria_acessos_clinica  on auditoria_acessos (clinica_id, criado_em desc);
create index if not exists idx_auditoria_acessos_usuario  on auditoria_acessos (usuario_id, criado_em desc);
create index if not exists idx_auditoria_acessos_criado   on auditoria_acessos (criado_em desc);

-- Sem FK de propósito: o registro precisa sobreviver à exclusão do paciente/usuário.
-- RLS: projeto separado. Quando ligar, a política deve permitir só INSERT pelo
-- service role e SELECT por clinica_id/medico_id do usuário.
-- alter table auditoria_acessos enable row level security;


-- ############################################################
-- 0014_modelos_prontuario.sql
-- ############################################################
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


-- ############################################################
-- 0015_automacoes_estado.sql
-- ############################################################
-- 0015 — Controle de execução das automações (confirmações, retornos).
-- O app chama /api/automacoes/tick a cada 15 min enquanto alguém usa o sistema
-- (o plano Hobby da Vercel só permite cron diário). Esta tabela garante que,
-- com várias abas/usuários abertos, cada automação rode no máximo uma vez por janela.

create table if not exists automacoes_estado (
  chave            text primary key,
  ultima_execucao  timestamptz not null default 'epoch',
  ultimo_resultado jsonb,
  atualizado_em    timestamptz default now()
);

insert into automacoes_estado (chave) values ('confirmacoes'), ('retornos')
on conflict (chave) do nothing;


-- Recarrega o cache da API para o app enxergar as tabelas novas
notify pgrst, 'reload schema';
