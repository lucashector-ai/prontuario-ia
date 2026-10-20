# O que depende do Lucas

## 🔴 URGENTE
- [ ] **Pagar a fatura da Vercel** (vercel.com → Settings → Billing → Pay Invoices). Em 20/10 o painel avisa "Payment failed, pay any open invoices before your account is shut down". Se desligarem a conta, o clinical360.vercel.app sai do ar.
- [ ] **Recarregar os créditos da Anthropic** (console.anthropic.com → Plans & Billing). Desde 20/10 a IA do prontuário responde "credit balance is too low": nenhum médico consegue gerar prontuário com IA. Enquanto isso, o sistema já oferece "Salvar o texto sem a IA".

Lista viva: o Claude vai acrescentando à medida que o trabalho avança. Risque o que já fez.

## Banco de dados (Supabase → SQL Editor, rodar na ordem)
_Conferido em 20/10: 0021 a 0024 aplicadas (4 organizações, 10 pessoas, 10 vínculos). 0025 (recurso de glosa), 0026 (portal do paciente), 0027 (créditos), 0028 (consentimento de gravação) , 0029 (arquivos do portal) , 0030 (orçamentos) e 0031 (salas e equipamentos) aplicadas pelo Claude em 20/10._
- [x] `supabase/migrations/0021_totem.sql`: conferido em 20/10, ainda não rodou (totem e senhas de balcão)
- [x] `supabase/migrations/0022_avisos_painel.sql`: conferido em 20/10, ainda não rodou (recados e atraso na TV)
- [x] `supabase/migrations/0023_prontuario_privado.sql`: prontuário só de quem atendeu. Até rodar, tudo funciona como antes.
- [x] `supabase/migrations/0024_contas_unidades.sql`: contas com várias unidades (organização, pessoas e vínculos). Até rodar, a aba Unidades avisa que não está ativa e o resto segue igual.

## Decisões
- [x] Planos com créditos de IA (feito em 20/10): Solo R$297 (250), Clínica R$597 (400), Pro R$999 (1.000), Grátis 10. Pacotes 100/R$89 e 300/R$249, profissional extra R$97 (+100). Anual 10% menos.
- [x] Consentimento para gravar a consulta (LGPD): feito em 20/10. O médico marca "o paciente autorizou" antes de gravar e a consulta guarda o registro. Se quiser outro texto (ex.: termo assinado), me diga.
- [ ] Assinatura digital dos documentos (ICP-Brasil, CFM 1.821/2007): hoje atestado, pedido de exames e prontuário saem para assinar à mão. A receita já é assinada pela Memed.
- [ ] Apagar contas de teste: o sistema não me deixa apagar dados de produção. Apague pelo Supabase (Table Editor) ou libere a permissão para eu escrever o script. Antes, confirme as clínicas "Enfermeiros Care" (itsmarisantos2000@gmail.com) e "Clínica ZenCardio" (juniorrosalvo2015@gmail.com), que parecem clientes reais, e a "Clínica Demonstração" (revisao.meta@clinical360.app), usada na revisão da Meta.
- [ ] Pacote de créditos comprado: hoje chega um email de pedido; libere em /superadmin → "+ créditos" na clínica.
- [ ] Cobrança automática dos planos: hoje "Quero o plano" manda um pedido por email e o plano é trocado no /superadmin. Para pagar e liberar sozinho, escolher o meio de pagamento (Asaas, Mercado Pago ou Stripe).
- [x] Pedido de "plano completo": por email (feito).
- [x] Plano Grátis: 1 usuário, 10 consultas com IA por mês (feito).

## Vercel (Settings → Environment Variables)
- [ ] `EMAIL_PEDIDOS_PLANO`: email que recebe os pedidos de plano completo (sem ela, vai para contato@clinical360.app).
- [ ] `RESEND_API_KEY` e `RESEND_FROM` (ex.: `Clinical 360 <nao-responda@seudominio.com.br>`, com o domínio verificado no Resend). Sem a chave o email não sai; o pedido fica guardado no banco mesmo assim.

## Testar com login real
- [ ] Criar uma conta com o seu email (pode ser 1lucashector+teste@gmail.com, que cai na mesma caixa) para revisarmos o sistema juntos com dados reais.
- [ ] Criar uma conta "Atendo sozinho(a)" em produção e fazer uma consulta (o cadastro de autônomo mudou).
- [ ] Equipe: cadastrar e editar alguém (as rotas de equipe ganharam checagem de segurança).
- [ ] Plano Grátis: numa conta nova, abrir a Central de atendimento e ver a tela de "plano completo".
- [ ] Equipe: convidar alguém pelo link (/convite/...) e entrar com a senha nova; cadastrar uma pessoa de Enfermagem e um atendente do chat.
- [ ] Central de atendimento (/atendimento): Agora, Recepção, Triagem, Consultório, Saídas, TV e totem, "Fixar como meu posto" e tela cheia (tecla F).
- [ ] Várias unidades (depois da 0024): Minha clínica → Unidades → Nova unidade; entrar nela pelo menu da conta; cadastrar um médico que já trabalha na outra unidade (mesmo email entra nas duas).
- [ ] Memed, teleconsulta e gravação de consulta depois dos cabeçalhos de segurança (CSP).

## Meta / WhatsApp
- [ ] Coexistência (QR / app do celular): a Meta ainda não libera para o app 959392466549100. Abrir chamado no suporte de desenvolvedores da Meta, ou testar pelo app Nexxus.
- [ ] Chamado na Meta nº 28707411205581053 (atendente Arvin; caso para anexos 29082093431426410). Diagnóstico: a checagem interna diz que +55 11 92748-8081 "não existe no WhatsApp" e por isso a opção de coexistência some. Aguardando correção. Antes: Chamado aberto no Suporte direto da Meta (Gerenciador de Negócios → Suporte direto → tópico "WhatsApp Tech Provider: Onboarding"). Quando responderem, mostrar a resposta ao Claude.
