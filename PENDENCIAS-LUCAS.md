# O que depende do Lucas

Lista viva: o Claude vai acrescentando à medida que o trabalho avança. Risque o que já fez.

## Banco de dados (Supabase → SQL Editor, rodar na ordem)
- [ ] `supabase/migrations/0021_totem.sql`: conferido em 20/10, ainda não rodou (totem e senhas de balcão)
- [ ] `supabase/migrations/0022_avisos_painel.sql`: conferido em 20/10, ainda não rodou (recados e atraso na TV)
- [ ] `supabase/migrations/0023_prontuario_privado.sql`: prontuário só de quem atendeu. Até rodar, tudo funciona como antes.
- [ ] `supabase/migrations/0024_contas_unidades.sql`: contas com várias unidades (organização, pessoas e vínculos). Até rodar, a aba Unidades avisa que não está ativa e o resto segue igual.

## Decisões
- [ ] Pedido de "plano completo": como quer receber? (WhatsApp, qual número / email / lista no superadmin). Hoje fica gravado em `notificacoes_admin`.
- [ ] Limites do plano Grátis estão bons? (1 usuário, 20 consultas com IA por mês) — `lib/planos.ts`

## Testar com login real
- [ ] Criar uma conta "Atendo sozinho(a)" em produção e fazer uma consulta (o cadastro de autônomo mudou).
- [ ] Equipe: cadastrar e editar alguém (as rotas de equipe ganharam checagem de segurança).
- [ ] Plano Grátis: numa conta nova, abrir a Central de atendimento e ver a tela de "plano completo".
- [ ] Equipe: convidar alguém pelo link (/convite/...) e entrar com a senha nova; cadastrar uma pessoa de Enfermagem e um atendente do chat.
- [ ] Central de atendimento (/atendimento): Agora, Recepção, Triagem, Consultório, Saídas, TV e totem, "Fixar como meu posto" e tela cheia (tecla F).
- [ ] Várias unidades (depois da 0024): Minha clínica → Unidades → Nova unidade; entrar nela pelo menu da conta; cadastrar um médico que já trabalha na outra unidade (mesmo email entra nas duas).
- [ ] Memed, teleconsulta e gravação de consulta depois dos cabeçalhos de segurança (CSP).

## Meta / WhatsApp
- [ ] Coexistência (QR / app do celular): a Meta ainda não libera para o app 959392466549100. Abrir chamado no suporte de desenvolvedores da Meta, ou testar pelo app Nexxus.
