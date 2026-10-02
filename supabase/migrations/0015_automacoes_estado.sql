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
