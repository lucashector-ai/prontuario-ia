'use client'

import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

export default function PrivacidadePage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: tokens.neutral[900] }}>
      <style>{`
        .priv-nav-back { display: inline-flex; align-items: center; gap: 6px; }
        .priv-section { padding: 48px 24px; }
        .priv-content h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 40px 0 12px; color: ${tokens.neutral[900]}; }
        .priv-content h2:first-child { margin-top: 0; }
        .priv-content h3 { font-size: 16px; font-weight: 600; margin: 24px 0 8px; color: ${tokens.neutral[900]}; }
        .priv-content p { font-size: 15px; line-height: 1.7; color: ${tokens.neutral[700]}; margin: 0 0 14px; }
        .priv-content ul { font-size: 15px; line-height: 1.7; color: ${tokens.neutral[700]}; padding-left: 22px; margin: 0 0 14px; }
        .priv-content li { margin-bottom: 6px; }
        .priv-content strong { color: ${tokens.neutral[900]}; font-weight: 600; }
        .priv-content a { color: ${tokens.brand.primary}; text-decoration: underline; }
        .priv-content table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 13px; }
        .priv-content th, .priv-content td { padding: 10px 12px; text-align: left; border-bottom: 1px solid ${tokens.neutral[150]}; vertical-align: top; }
        .priv-content th { background: ${tokens.bg.page}; font-weight: 600; color: ${tokens.neutral[900]}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .priv-content td { color: ${tokens.neutral[700]}; line-height: 1.5; }

        @media (max-width: 768px) {
          .priv-section { padding: 32px 20px !important; }
          .priv-content h2 { font-size: 19px !important; }
          .priv-content table { font-size: 12px; }
          .priv-content th, .priv-content td { padding: 8px 10px; }
        }
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${tokens.neutral[150]}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.push('/')} className="priv-nav-back" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: tokens.text.muted, fontWeight: 500, padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
          <img onClick={() => router.push('/')} src="/logo-clinical-360.svg" alt="Clinical 360" style={{ height: 26, cursor: 'pointer' }}/>
          <div style={{ width: 70 }}/>
        </div>
      </nav>

      <section className="priv-section" style={{ background: tokens.bg.page, borderBottom: `1px solid ${tokens.neutral[150]}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Política de Privacidade</p>
          <h1 style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px', color: tokens.neutral[900] }}>
            Como tratamos os seus dados.
          </h1>
          <p style={{ fontSize: 16, color: tokens.text.muted, margin: 0, lineHeight: 1.55 }}>
            Esta política descreve, em linguagem clara, como a Clinical 360 coleta, usa, armazena e protege dados pessoais e dados de saúde — em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
          <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: '18px 0 0' }}>
            Última atualização: 12 de maio de 2026 · Versão 1.0
          </p>
        </div>
      </section>

      <section className="priv-section">
        <div className="priv-content" style={{ maxWidth: 760, margin: '0 auto' }}>

          <h2>1. Quem somos</h2>
          <p>
            A Clinical 360 é uma plataforma de prontuário eletrônico com inteligência artificial operada pela <strong>Clinical Lab Ltda</strong>, inscrita no CNPJ sob o nº <strong>47.206.210/0001-02</strong>, com sede na Avenida Ibirapuera, 2907 — Indianópolis, São Paulo/SP, CEP 04029-200.
          </p>
          <p>
            Para fins desta política, a Clinical Lab Ltda atua como <strong>controladora</strong> dos dados pessoais de médicos, clínicas e demais usuários cadastrados na plataforma. Em relação aos dados de pacientes inseridos por médicos e clínicas, a Clinical 360 atua como <strong>operadora</strong> — quem decide o que coletar e por quanto tempo manter é o profissional de saúde, que figura como controlador desses dados.
          </p>

          <h2>2. Encarregado pelo tratamento de dados (DPO)</h2>
          <p>
            Em atendimento ao artigo 41 da LGPD, o encarregado pode ser contatado pelo e-mail <a href="mailto:privacidade@clinical360.app">privacidade@clinical360.app</a> para esclarecimentos, exercício de direitos do titular e demais comunicações relacionadas ao tratamento de dados pessoais.
          </p>

          <h2>3. Quais dados coletamos</h2>

          <h3>3.1. Dados do médico ou administrador da clínica</h3>
          <ul>
            <li>Dados de identificação: nome completo, CPF, data de nascimento, e-mail, telefone</li>
            <li>Dados profissionais: CRM, especialidade, dados da clínica (CNPJ, endereço)</li>
            <li>Credenciais de acesso: senha (armazenada com hash criptográfico)</li>
            <li>Dados de uso: IP de acesso, horários de login, ações realizadas na plataforma</li>
          </ul>

          <h3>3.2. Dados de pacientes (inseridos pelo médico)</h3>
          <ul>
            <li>Dados de identificação: nome, CPF, data de nascimento, e-mail, telefone, endereço</li>
            <li>Dados de saúde (categoria especial de dados pessoais sensíveis, conforme art. 5º, II da LGPD): histórico clínico, queixas, diagnósticos, CIDs, prescrições, exames, alergias, medicações em uso</li>
            <li>Gravações de áudio de consultas, quando autorizadas pelo paciente</li>
            <li>Transcrições e prontuários SOAP gerados a partir dessas gravações</li>
          </ul>

          <h3>3.3. Dados de pacientes via canais de mensagem</h3>
          <p>
            Quando o paciente interage com a clínica por WhatsApp, Instagram ou Messenger (via integração com a Meta), coletamos o conteúdo das mensagens trocadas, número de telefone ou identificador da rede social, e dados de envio (data, hora, status de entrega).
          </p>

          <h2>4. Para que usamos os dados</h2>
          <table>
            <thead>
              <tr>
                <th>Finalidade</th>
                <th>Base legal (LGPD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Execução do contrato com o médico ou clínica (acesso à plataforma, agendamento, prontuário, prescrição, teleconsulta)</td>
                <td>Execução de contrato (art. 7º, V)</td>
              </tr>
              <tr>
                <td>Tratamento de dados de saúde de pacientes para fins de tutela da saúde, em procedimento realizado por profissional de saúde</td>
                <td>Tutela da saúde (art. 11, II, "f")</td>
              </tr>
              <tr>
                <td>Geração de prontuário SOAP automático a partir de áudio de consulta</td>
                <td>Consentimento expresso do paciente (art. 11, I) + tutela da saúde</td>
              </tr>
              <tr>
                <td>Envio de mensagens automáticas ao paciente (confirmação, lembretes, retorno)</td>
                <td>Consentimento (art. 7º, I) + legítimo interesse na continuidade do atendimento (art. 7º, IX)</td>
              </tr>
              <tr>
                <td>Cumprimento de obrigações legais e regulatórias (Conselho Federal de Medicina, Receita Federal, ANPD)</td>
                <td>Obrigação legal (art. 7º, II)</td>
              </tr>
              <tr>
                <td>Segurança da plataforma, prevenção a fraudes e auditoria interna</td>
                <td>Legítimo interesse (art. 7º, IX)</td>
              </tr>
              <tr>
                <td>Comunicações comerciais sobre a plataforma (apenas para o usuário cadastrado)</td>
                <td>Consentimento revogável (art. 7º, I)</td>
              </tr>
            </tbody>
          </table>

          <h2>5. Com quem compartilhamos dados</h2>
          <p>
            A Clinical 360 não vende dados pessoais. Compartilhamos informações exclusivamente com prestadores de serviço necessários para operar a plataforma, sob obrigações contratuais de confidencialidade e segurança. Os principais subprocessadores são:
          </p>
          <table>
            <thead>
              <tr>
                <th>Subprocessador</th>
                <th>Finalidade</th>
                <th>Local</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase, Inc.</td>
                <td>Banco de dados, autenticação e armazenamento de arquivos</td>
                <td>Estados Unidos</td>
              </tr>
              <tr>
                <td>Vercel, Inc.</td>
                <td>Hospedagem da aplicação e entrega de conteúdo</td>
                <td>Estados Unidos</td>
              </tr>
              <tr>
                <td>Anthropic, PBC</td>
                <td>Modelo de IA para geração de prontuário SOAP e análises clínicas</td>
                <td>Estados Unidos</td>
              </tr>
              <tr>
                <td>Deepgram, Inc.</td>
                <td>Transcrição automática de áudio de consulta</td>
                <td>Estados Unidos</td>
              </tr>
              <tr>
                <td>Memed Tecnologia S.A.</td>
                <td>Prescrição médica digital com validade ICP-Brasil</td>
                <td>Brasil</td>
              </tr>
              <tr>
                <td>Meta Platforms, Inc.</td>
                <td>Integração com WhatsApp, Instagram e Messenger (quando habilitada)</td>
                <td>Estados Unidos</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, color: tokens.text.muted }}>
            Transferências internacionais ocorrem com base no art. 33 da LGPD, mediante cláusulas contratuais que asseguram nível de proteção adequado.
          </p>

          <h2>6. Por quanto tempo guardamos seus dados</h2>
          <ul>
            <li><strong>Prontuário médico:</strong> mínimo de 20 anos a partir do último registro, conforme Resolução CFM nº 1.821/2007</li>
            <li><strong>Gravações de áudio de consulta:</strong> mantidas até que o médico solicite exclusão ou por até 90 dias após o encerramento da conta, o que ocorrer primeiro</li>
            <li><strong>Dados de cadastro e identificação:</strong> enquanto a conta estiver ativa e por até 5 anos após o encerramento, para cumprimento de obrigações fiscais e atendimento a eventuais auditorias</li>
            <li><strong>Logs de acesso e auditoria:</strong> 6 meses</li>
            <li><strong>Backups automáticos (PITR):</strong> retenção rotativa de 7 dias</li>
          </ul>

          <h2>7. Como protegemos seus dados</h2>
          <ul>
            <li>Criptografia em trânsito (TLS 1.3) em todas as comunicações</li>
            <li>Criptografia em repouso para dados armazenados em banco de dados e storage</li>
            <li>Senhas armazenadas com hash criptográfico (bcrypt)</li>
            <li>Controle de acesso por autenticação individual, com possibilidade de troca de senha obrigatória</li>
            <li>Backups automáticos com point-in-time recovery (PITR)</li>
            <li>Segregação lógica de dados por médico e clínica</li>
            <li>Monitoramento contínuo de tentativas de acesso indevido</li>
          </ul>
          <p>
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados em prazo razoável, conforme previsto no art. 48 da LGPD.
          </p>

          <h2>8. Seus direitos como titular</h2>
          <p>
            Conforme o art. 18 da LGPD, você tem direito a, a qualquer momento e mediante requisição:
          </p>
          <ul>
            <li><strong>Confirmação</strong> da existência de tratamento dos seus dados</li>
            <li><strong>Acesso</strong> aos dados que mantemos sobre você</li>
            <li><strong>Correção</strong> de dados incompletos, inexatos ou desatualizados</li>
            <li><strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários, excessivos ou tratados em desconformidade com a lei</li>
            <li><strong>Portabilidade</strong> dos dados a outro fornecedor de serviço, em formato estruturado (JSON)</li>
            <li><strong>Eliminação</strong> dos dados pessoais tratados com base no seu consentimento</li>
            <li><strong>Informação</strong> sobre entidades públicas e privadas com as quais compartilhamos dados</li>
            <li><strong>Informação</strong> sobre a possibilidade de não fornecer consentimento e as consequências dessa negativa</li>
            <li><strong>Revogação</strong> do consentimento, quando o tratamento se baseia nele</li>
          </ul>
          <p>
            Médicos e administradores cadastrados podem exercer estes direitos diretamente no painel da plataforma, na seção <strong>Privacidade e LGPD</strong>, ou enviando solicitação para <a href="mailto:privacidade@clinical360.app">privacidade@clinical360.app</a>.
          </p>
          <p>
            Pacientes que tiveram dados inseridos por uma clínica devem, em primeiro lugar, contatar a clínica responsável (controladora dos dados). Caso não obtenham resposta adequada, podem nos acionar pelo mesmo e-mail para mediação.
          </p>

          <h2>9. Uso de inteligência artificial</h2>
          <p>
            A Clinical 360 utiliza modelos de inteligência artificial para apoiar o profissional de saúde — não para substituí-lo. Especificamente:
          </p>
          <ul>
            <li>Áudios de consulta são transcritos pela Deepgram e processados pela Anthropic (modelo Claude) para gerar um <strong>rascunho</strong> de prontuário SOAP</li>
            <li>Toda saída gerada por IA é apresentada como sugestão editável, sob revisão e responsabilidade exclusiva do médico</li>
            <li>Não tomamos decisões automatizadas que afetem o paciente sem intervenção humana</li>
            <li>Os áudios e transcrições não são utilizados para treinar modelos de terceiros</li>
          </ul>
          <p>
            Conforme o art. 20 da LGPD, o titular tem direito a solicitar revisão de decisões tomadas unicamente com base em tratamento automatizado de dados.
          </p>

          <h2>10. Cookies e tecnologias semelhantes</h2>
          <p>
            Utilizamos cookies estritamente necessários para o funcionamento da plataforma (autenticação, sessão, preferências de exibição). Não utilizamos cookies de rastreamento publicitário de terceiros. Você pode bloquear cookies nas configurações do navegador, mas isso pode prejudicar funcionalidades essenciais.
          </p>

          <h2>11. Crianças e adolescentes</h2>
          <p>
            A plataforma é destinada a profissionais de saúde maiores de idade. Quando o paciente atendido é menor de 18 anos, o tratamento de seus dados depende do consentimento específico e em destaque dado pelos pais ou responsáveis legais, conforme art. 14 da LGPD, sendo de responsabilidade do médico ou clínica obter este consentimento.
          </p>

          <h2>12. Alterações nesta política</h2>
          <p>
            Esta política pode ser atualizada para refletir mudanças legais, técnicas ou no funcionamento da plataforma. Alterações relevantes serão comunicadas por e-mail ao usuário cadastrado e por aviso na plataforma com antecedência mínima de 30 dias, exceto quando exigência legal impuser prazo diverso.
          </p>

          <h2>13. Contato e reclamações</h2>
          <p>
            Para dúvidas, solicitações de direitos ou reclamações relacionadas ao tratamento dos seus dados, entre em contato pelo e-mail <a href="mailto:privacidade@clinical360.app">privacidade@clinical360.app</a>.
          </p>
          <p>
            Caso entenda que sua solicitação não foi devidamente atendida, você tem o direito de apresentar reclamação à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> pelo site <a href="https://www.gov.br/anpd/" target="_blank" rel="noopener noreferrer">gov.br/anpd</a>.
          </p>

        </div>
      </section>

      <footer style={{ padding: '32px 24px', background: tokens.neutral[900], color: tokens.neutral[400], fontSize: 12, textAlign: 'center' }}>
        © 2026 Clinical Lab Ltda · CNPJ 47.206.210/0001-02 · Todos os direitos reservados
      </footer>
    </div>
  )
}
