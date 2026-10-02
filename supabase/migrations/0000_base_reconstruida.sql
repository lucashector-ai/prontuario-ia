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
