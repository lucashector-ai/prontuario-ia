-- 0028 · Consentimento do paciente para gravar a consulta (LGPD, dado sensível)
-- Registrado quando o médico marca "O paciente autorizou a gravação" antes de gravar.
alter table consultas add column if not exists gravacao_autorizada boolean;
alter table consultas add column if not exists gravacao_autorizada_em timestamptz;
