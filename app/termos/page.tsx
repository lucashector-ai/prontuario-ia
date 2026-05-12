'use client'

import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

export default function TermosPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: tokens.neutral[900] }}>
      <style>{`
        .termos-nav-back { display: inline-flex; align-items: center; gap: 6px; }
        .termos-section { padding: 48px 24px; }
        .termos-content h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 40px 0 12px; color: ${tokens.neutral[900]}; }
        .termos-content h2:first-child { margin-top: 0; }
        .termos-content h3 { font-size: 16px; font-weight: 600; margin: 24px 0 8px; color: ${tokens.neutral[900]}; }
        .termos-content p { font-size: 15px; line-height: 1.7; color: ${tokens.neutral[700]}; margin: 0 0 14px; }
        .termos-content ul { font-size: 15px; line-height: 1.7; color: ${tokens.neutral[700]}; padding-left: 22px; margin: 0 0 14px; }
        .termos-content li { margin-bottom: 6px; }
        .termos-content strong { color: ${tokens.neutral[900]}; font-weight: 600; }
        .termos-content a { color: ${tokens.brand.primary}; text-decoration: underline; }
        .termos-content table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 13px; }
        .termos-content th, .termos-content td { padding: 10px 12px; text-align: left; border-bottom: 1px solid ${tokens.neutral[150]}; vertical-align: top; }
        .termos-content th { background: ${tokens.bg.page}; font-weight: 600; color: ${tokens.neutral[900]}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .termos-content td { color: ${tokens.neutral[700]}; line-height: 1.5; }
        .termos-callout { background: ${tokens.bg.page}; border-left: 3px solid ${tokens.brand.primary}; padding: 14px 18px; margin: 16px 0 22px; border-radius: 6px; }
        .termos-callout p { margin: 0; font-size: 14px; }

        @media (max-width: 768px) {
          .termos-section { padding: 32px 20px !important; }
          .termos-content h2 { font-size: 19px !important; }
          .termos-content table { font-size: 12px; }
          .termos-content th, .termos-content td { padding: 8px 10px; }
        }
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${tokens.neutral[150]}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.push('/')} className="termos-nav-back" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: tokens.text.muted, fontWeight: 500, padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
          <img onClick={() => router.push('/')} src="/logo-clinical-360.svg" alt="Clinical 360" style={{ height: 26, cursor: 'pointer' }}/>
          <div style={{ width: 70 }}/>
        </div>
      </nav>

      <section className="termos-section" style={{ background: tokens.bg.page, borderBottom: `1px solid ${tokens.neutral[150]}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Termos de Uso</p>
          <h1 style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px', color: tokens.neutral[900] }}>
            As regras pra usar o Clinical 360.
          </h1>
          <p style={{ fontSize: 16, color: tokens.text.muted, margin: 0, lineHeight: 1.55 }}>
            Este documento estabelece os termos e condições para uso da plataforma Clinical 360. Ao se cadastrar ou utilizar nossos serviços, você concorda com tudo o que está descrito aqui.
          </p>
          <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: '18px 0 0' }}>
            Última atualização: 12 de maio de 2026 · Versão 1.0
          </p>
        </div>
      </section>

      <section className="termos-section">
        <div className="termos-content" style={{ maxWidth: 760, margin: '0 auto' }}>

          <h2>1. Identificação das partes</h2>
          <p>
            Estes Termos de Uso são celebrados entre a <strong>Clinical Lab Ltda</strong>, inscrita no CNPJ sob o nº <strong>47.206.210/0001-02</strong>, com sede na Avenida Ibirapuera, 2907 — Indianópolis, São Paulo/SP, CEP 04029-200, doravante denominada <strong>"Clinical 360"</strong>, e o usuário pessoa física ou jurídica que se cadastra na plataforma, doravante denominado <strong>"Usuário"</strong>.
          </p>
          <p>
            A aceitação destes Termos ocorre no ato do cadastro, mediante manifestação inequívoca do Usuário, e tem força contratual entre as partes nos termos do Código Civil e do Marco Civil da Internet.
          </p>

          <h2>2. Objeto do serviço</h2>
          <p>
            O Clinical 360 é uma plataforma SaaS (software como serviço) voltada a profissionais e estabelecimentos de saúde, oferecendo, entre outros recursos:
          </p>
          <ul>
            <li>Prontuário eletrônico do paciente (PEP)</li>
            <li>Agenda médica com confirmação automatizada</li>
            <li>Transcrição de consultas e geração assistida de prontuário SOAP por inteligência artificial</li>
            <li>Prescrição digital com validade ICP-Brasil, mediante integração com a Memed</li>
            <li>Teleconsulta com sala de vídeo nativa</li>
            <li>Atendimento ao paciente por WhatsApp, Instagram e Messenger, quando habilitado</li>
            <li>Painéis e relatórios de gestão</li>
          </ul>
          <p>
            As funcionalidades disponíveis variam conforme o plano contratado e podem ser atualizadas, ampliadas ou descontinuadas pela Clinical 360, mediante comunicação prévia ao Usuário, sempre que tais alterações afetarem materialmente o serviço.
          </p>

          <h2>3. Cadastro e elegibilidade</h2>
          <p>
            Para utilizar a plataforma, o Usuário deve ser maior de 18 anos, ter capacidade civil plena e, quando aplicável ao plano contratado, comprovar registro ativo em conselho profissional competente (CRM, COREN, CRO, CRP ou equivalente).
          </p>
          <p>
            Ao se cadastrar, o Usuário declara que todas as informações fornecidas são verdadeiras, completas e atualizadas, e compromete-se a mantê-las assim durante todo o período de uso. A Clinical 360 pode, a qualquer tempo, solicitar comprovação documental dos dados informados.
          </p>
          <p>
            Cada conta é pessoal e intransferível. O compartilhamento de credenciais entre múltiplos usuários é vedado e pode resultar na suspensão imediata da conta. Clínicas com múltiplos profissionais devem contratar plano compatível com o número de usuários.
          </p>

          <h2>4. Planos, pagamento e renovação</h2>

          <h3>4.1. Modalidades de cobrança</h3>
          <p>
            Os planos da Clinical 360 são oferecidos em ciclo mensal ou anual, com valores publicados na página de planos da plataforma. O Usuário escolhe a modalidade no ato da contratação.
          </p>

          <h3>4.2. Trial gratuito</h3>
          <p>
            O plano Solo oferece período de teste gratuito de 7 (sete) dias corridos, contados a partir do cadastro. Durante o trial, o Usuário tem acesso pleno ao plano, sem cobrança e sem necessidade de cadastrar meio de pagamento. Ao final do período, o acesso é interrompido até que a assinatura seja confirmada.
          </p>

          <h3>4.3. Renovação automática</h3>
          <p>
            Assinaturas mensais e anuais são renovadas automaticamente ao fim de cada ciclo, mediante cobrança no meio de pagamento cadastrado, pelo valor vigente à data da renovação. O Usuário pode desativar a renovação automática a qualquer momento dentro da plataforma.
          </p>

          <h3>4.4. Reajuste de preços</h3>
          <p>
            A Clinical 360 reserva-se o direito de reajustar os valores dos planos, mediante comunicação prévia de no mínimo 30 (trinta) dias ao Usuário. Caso o Usuário não concorde com o reajuste, poderá cancelar a assinatura sem ônus antes que o novo valor entre em vigor.
          </p>

          <h3>4.5. Inadimplência</h3>
          <p>
            Em caso de falha na cobrança, o Usuário será notificado por e-mail e disporá de 7 (sete) dias para regularizar o pagamento. Após esse prazo, o acesso poderá ser suspenso até a regularização. A persistência da inadimplência por mais de 30 dias autoriza o encerramento da conta, observado o disposto na cláusula 11.
          </p>

          <h3>4.6. Custos de mensagens WhatsApp</h3>
          <p>
            Mensagens enviadas pela Sofia (assistente de IA) ou outras integrações Meta WhatsApp Business são cobradas conforme tarifa publicada na página de planos, repassando o custo da Meta sem margem adicional. O consumo é faturado mensalmente em conjunto com a assinatura.
          </p>

          <h2>5. Cancelamento</h2>
          <p>
            O Usuário pode cancelar sua assinatura a qualquer momento, diretamente na plataforma, sem multa ou fidelidade. O cancelamento produz efeitos ao fim do ciclo de cobrança vigente — o serviço continua disponível até essa data, e nenhuma cobrança adicional ocorrerá.
          </p>
          <p>
            Para assinaturas anuais canceladas antes do fim do ciclo, não há reembolso proporcional, exceto nos casos previstos no Código de Defesa do Consumidor (art. 49 — direito de arrependimento em 7 dias após a contratação).
          </p>
          <p>
            Após o cancelamento, o Usuário poderá exportar todos os seus dados em formato JSON pela seção <strong>Privacidade e LGPD</strong> da plataforma. A retenção e exclusão dos dados após o encerramento da conta seguem o estabelecido na <a href="/privacidade">Política de Privacidade</a>.
          </p>

          <h2>6. Responsabilidades do Usuário</h2>
          <p>
            O Usuário é integralmente responsável por:
          </p>
          <ul>
            <li>Veracidade das informações inseridas na plataforma, incluindo prontuários, prescrições e dados de pacientes</li>
            <li>Cumprimento das normas do conselho profissional ao qual está vinculado, em especial a Resolução CFM nº 2.314/2022 (telemedicina) e a Resolução CFM nº 1.821/2007 (prontuário eletrônico)</li>
            <li>Obtenção de consentimento livre, informado e específico do paciente para gravação de consulta, geração de prontuário por IA e envio de mensagens automatizadas</li>
            <li>Guarda segura das credenciais de acesso e comunicação imediata à Clinical 360 em caso de suspeita de acesso indevido</li>
            <li>Uso dos recursos da plataforma exclusivamente para finalidades lícitas e compatíveis com o exercício profissional declarado</li>
            <li>Cumprimento de todas as obrigações fiscais, tributárias e trabalhistas relacionadas à sua atividade</li>
          </ul>

          <div className="termos-callout">
            <p>
              <strong>Importante:</strong> a relação clínica entre médico e paciente, incluindo o conteúdo do prontuário, das prescrições e das condutas adotadas, é de responsabilidade exclusiva do profissional de saúde. A Clinical 360 fornece a tecnologia, mas não pratica ato médico nem se responsabiliza por decisões clínicas.
            </p>
          </div>

          <h2>7. Inteligência artificial — natureza assistiva</h2>
          <p>
            A Clinical 360 emprega modelos de inteligência artificial para apoiar o médico em tarefas como transcrição de áudio, geração de rascunho de prontuário SOAP, sugestão de CIDs e análise de exames. Estes recursos têm <strong>natureza estritamente assistiva</strong>.
          </p>
          <p>
            Todo conteúdo gerado por IA é apresentado ao médico como sugestão editável, sob revisão obrigatória. A decisão final sobre diagnóstico, conduta, prescrição e qualquer informação registrada no prontuário é de responsabilidade exclusiva do profissional de saúde, conforme art. 1º do Código de Ética Médica.
          </p>
          <p>
            A Clinical 360 não garante exatidão absoluta das saídas geradas por IA e não se responsabiliza por danos decorrentes do uso de informações geradas automaticamente sem a devida revisão profissional.
          </p>

          <h2>8. Prescrição digital (Memed)</h2>
          <p>
            A funcionalidade de prescrição digital é oferecida em integração com a Memed Tecnologia S.A., responsável pela emissão de receitas com validade legal e assinatura ICP-Brasil. O Usuário, ao utilizar o módulo de prescrição, adere também aos Termos de Uso da Memed, disponíveis em <a href="https://memed.com.br" target="_blank" rel="noopener noreferrer">memed.com.br</a>.
          </p>
          <p>
            A Clinical 360 atua como integradora da plataforma Memed e não responde por indisponibilidades, falhas ou erros de emissão originados no provedor de prescrição.
          </p>

          <h2>9. Propriedade intelectual</h2>
          <p>
            Todos os direitos de propriedade intelectual sobre a plataforma Clinical 360 — incluindo código-fonte, design, marca, logotipos, interface, documentação e materiais de marketing — pertencem à Clinical Lab Ltda e são protegidos pela Lei nº 9.610/1998 (Direitos Autorais) e Lei nº 9.279/1996 (Propriedade Industrial).
          </p>
          <p>
            O contrato de assinatura concede ao Usuário licença <strong>não exclusiva, intransferível, revogável e limitada</strong> de uso da plataforma, restrita às finalidades previstas nestes Termos e à vigência da assinatura.
          </p>
          <p>
            Os dados inseridos pelo Usuário (prontuários, pacientes, agendamentos) permanecem de sua titularidade ou de seus pacientes, conforme o caso. A Clinical 360 não reivindica propriedade sobre esses dados e os trata conforme a <a href="/privacidade">Política de Privacidade</a>.
          </p>

          <h2>10. Condutas vedadas</h2>
          <p>
            É expressamente vedado ao Usuário:
          </p>
          <ul>
            <li>Utilizar a plataforma para fins ilícitos, fraudulentos, antiéticos ou em desacordo com normas profissionais aplicáveis</li>
            <li>Inserir dados falsos, difamatórios, discriminatórios ou que violem direitos de terceiros</li>
            <li>Compartilhar credenciais com pessoas não autorizadas ou permitir uso por terceiros não cadastrados</li>
            <li>Tentar acesso não autorizado a contas de outros usuários, a sistemas internos ou a dados que não lhe pertencem</li>
            <li>Realizar engenharia reversa, descompilação, cópia ou redistribuição de partes da plataforma</li>
            <li>Utilizar a plataforma para envio de comunicações não solicitadas (spam) ou em violação à legislação aplicável a marketing direto</li>
            <li>Interferir no funcionamento da plataforma por meio de scripts automatizados, bots ou outras ferramentas não autorizadas</li>
            <li>Utilizar os recursos de IA para gerar conteúdo enganoso, prescrições sem revisão profissional ou em desvio da finalidade médica</li>
          </ul>

          <h2>11. Suspensão e encerramento da conta</h2>
          <p>
            A Clinical 360 pode suspender ou encerrar a conta do Usuário, com ou sem aviso prévio conforme a gravidade, nas seguintes hipóteses:
          </p>
          <ul>
            <li>Violação destes Termos ou da Política de Privacidade</li>
            <li>Inadimplência superior a 30 dias após notificação</li>
            <li>Uso fraudulento, malicioso ou em desacordo com a finalidade profissional declarada</li>
            <li>Determinação judicial ou de autoridade competente</li>
            <li>Suspeita fundada de risco à segurança da plataforma ou de outros usuários</li>
          </ul>
          <p>
            Em caso de encerramento, o Usuário será notificado por e-mail e terá prazo de 30 (trinta) dias para exportar seus dados antes da exclusão definitiva, exceto quando o encerramento decorrer de ordem judicial que imponha procedimento diverso.
          </p>

          <h2>12. Limitação de responsabilidade</h2>
          <p>
            Nos limites da legislação aplicável, a responsabilidade civil da Clinical 360 perante o Usuário, por quaisquer danos diretos comprovadamente causados em decorrência do uso da plataforma, fica limitada ao valor total pago pelo Usuário nos 12 (doze) meses anteriores ao evento que originou a responsabilização.
          </p>
          <p>
            A Clinical 360 não responde por danos indiretos, lucros cessantes ou perda de oportunidade, nem por interrupções de serviço causadas por:
          </p>
          <ul>
            <li>Caso fortuito ou força maior</li>
            <li>Falhas de infraestrutura de terceiros (provedores de internet, energia, hospedagem, gateways de pagamento)</li>
            <li>Ataques cibernéticos não previsíveis pelo estado da arte em segurança</li>
            <li>Uso indevido da plataforma pelo próprio Usuário ou por pessoas a quem ele concedeu acesso</li>
            <li>Atos, omissões ou decisões clínicas tomadas pelo profissional de saúde</li>
          </ul>
          <p>
            A Clinical 360 envida esforços razoáveis para manter disponibilidade contínua da plataforma, mas não garante operação ininterrupta, livre de erros ou imune a indisponibilidades programadas para manutenção.
          </p>

          <h2>13. Confidencialidade e segurança</h2>
          <p>
            A Clinical 360 mantém medidas técnicas e organizacionais para preservar a confidencialidade, integridade e disponibilidade dos dados, conforme descrito na <a href="/privacidade">Política de Privacidade</a>. O Usuário compromete-se a manter sigilo equivalente quanto a credenciais e informações sensíveis de pacientes.
          </p>

          <h2>14. Comunicações</h2>
          <p>
            As comunicações entre a Clinical 360 e o Usuário ocorrem preferencialmente por e-mail cadastrado e por notificações dentro da plataforma. É responsabilidade do Usuário manter dados de contato atualizados.
          </p>
          <p>
            Comunicações de caráter contratual relevante (mudanças de preço, alteração nestes Termos, encerramento de conta) serão enviadas com antecedência mínima conforme previsto em cada cláusula específica ou na legislação aplicável.
          </p>

          <h2>15. Alterações nestes Termos</h2>
          <p>
            A Clinical 360 pode alterar estes Termos de Uso para refletir mudanças legais, regulatórias, técnicas ou no funcionamento da plataforma. Alterações materiais serão comunicadas com antecedência mínima de 30 (trinta) dias por e-mail e por aviso na plataforma.
          </p>
          <p>
            A continuidade do uso após a entrada em vigor da nova versão configura aceitação das alterações. Caso o Usuário não concorde, poderá cancelar a assinatura sem ônus antes da data de vigência.
          </p>

          <h2>16. Lei aplicável e foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial:
          </p>
          <ul>
            <li>Código Civil (Lei nº 10.406/2002)</li>
            <li>Código de Defesa do Consumidor (Lei nº 8.078/1990), quando aplicável</li>
            <li>Marco Civil da Internet (Lei nº 12.965/2014)</li>
            <li>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</li>
            <li>Resoluções do Conselho Federal de Medicina aplicáveis ao exercício da telemedicina e ao prontuário eletrônico</li>
          </ul>
          <p>
            Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja, ressalvado o direito do Usuário consumidor de eleger o foro de seu domicílio nos termos do Código de Defesa do Consumidor.
          </p>

          <h2>17. Disposições gerais</h2>
          <p>
            A eventual tolerância de qualquer das partes quanto ao descumprimento de obrigações previstas nestes Termos não configura novação nem renúncia ao direito de exigir o cumprimento futuro. Caso qualquer cláusula seja considerada inválida ou inexequível por decisão judicial, as demais permanecem em pleno vigor.
          </p>
          <p>
            Estes Termos, em conjunto com a <a href="/privacidade">Política de Privacidade</a>, constituem o acordo integral entre as partes em relação ao uso da plataforma, prevalecendo sobre quaisquer entendimentos anteriores, verbais ou escritos.
          </p>

          <h2>18. Contato</h2>
          <p>
            Dúvidas sobre estes Termos podem ser encaminhadas para <a href="mailto:privacidade@clinical360.app">privacidade@clinical360.app</a>.
          </p>

        </div>
      </section>

      <footer style={{ padding: '32px 24px', background: tokens.neutral[900], color: tokens.neutral[400], fontSize: 12, textAlign: 'center' }}>
        © 2026 Clinical Lab Ltda · CNPJ 47.206.210/0001-02 · Todos os direitos reservados
      </footer>
    </div>
  )
}
