# Banco de dados (Supabase) — como montar e atualizar

Todas as migrations ficam em `supabase/migrations/` e são **idempotentes**: podem
rodar mais de uma vez e num banco que já tem parte das tabelas (usam
`create table if not exists`, `add column if not exists`, índices `if not exists`).

## Ordem de execução

Rode **sempre em ordem numérica**, de `0000` até a última:

| Arquivo | O que faz |
|---|---|
| `0000_base_reconstruida.sql` | Tabelas principais (médicos, clínicas, pacientes, agenda, consultas, WhatsApp, Sofia, formulários…). Reconstruída a partir do código — revisar antes de produção. |
| `0001_financeiro_base.sql` | Financeiro: formas de pagamento, migração de comandas/itens, recebimentos, despesas, caixa, trigger de comanda. |
| `0002_financeiro_repasses.sql` | Regras de repasse e repasses a profissionais. |
| `0003_financeiro_custos_procedimento.sql` | Custo de insumos/operacional em procedimentos. |
| `0004_financeiro_multiunidade_gateway.sql` | Unidades, gateway de pagamento e cobranças. |
| `0005_financeiro_medico_unidade.sql` | Unidade do médico. |
| `0006_financeiro_contas_bancarias.sql` | Contas bancárias. |
| `0007_financeiro_auditoria.sql` | Trilha de auditoria do financeiro. |
| `0008_financeiro_conciliacao.sql` | Conciliação do caixa. |
| `0009_chat_omnicanal.sql` | Chat: etapas do kanban, fixar/arquivar/silenciar, respostas rápidas. |
| `0010_confirmacoes_lista_espera.sql` | Confirmação automática (48h/24h/2h) e lista de espera. |
| `0011_retornos.sql` | Retornos previstos e campanhas de reativação de pacientes. |
| `0012_faturamento_tiss.sql` | Faturamento de convênios no padrão TISS (operadoras, guias, lotes). |
| `0013_auditoria_acessos.sql` | Registro de acessos ao prontuário (LGPD/CFM): quem viu/editou/exportou o quê. |
| `0014_modelos_prontuario.sql` | Modelos de prontuário personalizados por especialidade. |
| `0017_canais_conectados.sql` | Canais conectados por clínica (WhatsApp/Instagram/Messenger pelo botão "Conectar"). |
| `0018_atendimento_fila.sql` | Recepção, senhas, painel da TV e consultório (setores, consultórios, atendimentos, chamadas). Precisa do 0016. |
| `0019_saida_recepcao.sql` | Saída do consultório → recepção (retorno e recados do médico) e avisos em tempo real. |
| `0016_seguranca_rls.sql` | **Segurança**: liga o RLS em todas as tabelas com acesso por clínica (exige `SUPABASE_JWT_SECRET` no app). |
| `0015_automacoes_estado.sql` | Controle das automações a cada 15 min (evita disparo duplicado com várias abas abertas). |

Novas desta fase: **0010, 0011, 0012, 0013, 0014, 0015** (e a 0000, que documenta a base).

## Como rodar

**Opção A — SQL Editor do Supabase (mais simples)**

1. Painel do Supabase → *SQL Editor* → *New query*.
2. Cole o conteúdo de um arquivo, clique em *Run*. Um arquivo por vez, na ordem.
3. Confira a aba *Messages*: avisos `NOTICE` (ex.: "FK … não criada") não são
   erro — indicam algo que já existia ou dado antigo inconsistente. Anote e revise.

**Opção B — Supabase CLI**

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push            # aplica as migrations pendentes, em ordem
```

Ou, direto com `psql`:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
```

## Como verificar

```sql
-- tabelas existentes
select table_name from information_schema.tables
where table_schema = 'public' order by 1;

-- colunas de uma tabela
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'consultas' order by ordinal_position;

-- FKs criadas como NOT VALID (validar depois de limpar dados órfãos)
select conrelid::regclass as tabela, conname from pg_constraint
where contype = 'f' and not convalidated;
```

No app: abrir Agenda, Pacientes, uma ficha de paciente, Chat e Financeiro. Se
uma tela mostrar aviso "rode a migration 00XX", aquela migration não foi aplicada.

Depois de rodar DDL, se o app reclamar de "schema cache", recarregue o cache da
API: *Settings → API → Reload schema* (ou `notify pgrst, 'reload schema';`).

## O banco voltou vazio / sem tabelas — o que fazer

1. **Pare.** Não rode a `0000` ainda: ela cria tabelas vazias e pode atrapalhar
   uma restauração.
2. **Restaure o backup primeiro**: Supabase → *Database → Backups* (diário ou
   Point-in-Time Recovery, conforme o plano). Se o projeto foi pausado, só
   reative-o — os dados voltam.
3. Confirme que os dados voltaram (`select count(*) from pacientes;`).
4. Só então rode as migrations em ordem (0000 → 0015). Como são idempotentes,
   elas só acrescentam o que faltar, sem mexer nos dados.
5. Se **não houver backup**, aí sim rode tudo do zero (0000 → 0015) e, na 0000,
   descomente o bloco de *Realtime* (o Chat depende dele).

## Observações

- **RLS** fica ligado (0016). O login emite um token assinado com o JWT secret
  do Supabase (`SUPABASE_JWT_SECRET`) e as políticas liberam só os dados da
  clínica do token. Sem esse segredo configurado, o login não funciona.
- A `0000` cria FKs com `NOT VALID` e só se a coluna ainda não tiver FK (duas FKs
  para a mesma tabela quebram os joins do PostgREST).
- Prontuário tem guarda obrigatória (CFM 1.821/2007): consultas e prescrições não
  são apagadas em cascata.
