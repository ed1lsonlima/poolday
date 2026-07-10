import LegalLayout from '../components/common/LegalLayout'

export default function Privacidade() {
  return (
    <LegalLayout title="Politica de Privacidade" updated="julho de 2026">
      <p>Esta Politica explica como o PoolDay coleta, usa e protege as informacoes de Hospedes e Anfitrioes.</p>

      <h2>1. Dados que coletamos</h2>
      <p>Coletamos os dados fornecidos no cadastro (nome, e-mail, telefone, cidade), dados dos anuncios cadastrados pelos Anfitrioes (fotos, localizacao, precos), e dados de uso da plataforma (reservas, avaliacoes, mensagens trocadas entre usuarios).</p>

      <h2>2. Como usamos seus dados</h2>
      <p>Usamos os dados para viabilizar reservas, processar pagamentos via Mercado Pago, exibir anuncios e perfis publicos, enviar comunicacoes sobre suas reservas, e melhorar a experiencia da plataforma.</p>

      <h2>3. Compartilhamento de dados</h2>
      <p>Compartilhamos os dados estritamente necessarios entre Hospede e Anfitriao para viabilizar uma reserva (por exemplo, nome e telefone). Dados de pagamento sao processados diretamente pelo Mercado Pago e nao ficam armazenados em nossos servidores.</p>

      <h2>4. Armazenamento e seguranca</h2>
      <p>Os dados sao armazenados em infraestrutura do Supabase, com controle de acesso por usuario. Adotamos medidas tecnicas razoaveis para proteger as informacoes contra acesso nao autorizado.</p>

      <h2>5. Seus direitos</h2>
      <p>Voce pode solicitar a atualizacao ou exclusao dos seus dados pessoais a qualquer momento, entrando em contato pelos canais de suporte da plataforma, nos termos da Lei Geral de Protecao de Dados (LGPD).</p>

      <h2>6. Cookies</h2>
      <p>Utilizamos cookies e ferramentas de analise (como o Google Analytics) para entender o uso da plataforma e melhorar a experiencia dos usuarios.</p>

      <h2>7. Alteracoes nesta politica</h2>
      <p>Esta politica pode ser atualizada periodicamente. A versao mais recente estara sempre disponivel nesta pagina.</p>
    </LegalLayout>
  )
}
