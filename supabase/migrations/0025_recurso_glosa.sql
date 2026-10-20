-- 0025 · Recurso de glosa (convênios / TISS)
-- Acompanha o recurso de cada guia glosada: prazo, justificativa, protocolo e resultado.
-- recurso = { status: 'em_recurso'|'aceito'|'parcial'|'negado', prazo: 'yyyy-mm-dd', justificativa,
--             protocolo, aberto_em, resolvido_em, valor_recuperado }
alter table guias_tiss add column if not exists recurso jsonb;
create index if not exists guias_tiss_recurso_status_idx on guias_tiss ((recurso->>'status')) where recurso is not null;
