import LegalLayout from '../components/common/LegalLayout'

export default function Privacidade() {
  return (
    <LegalLayout title="Política de Privacidade" updated="julho de 2026">
      <p>Esta Política explica como o PoolDay coleta, usa e protege as informações de Hóspedes e Anfitriões.</p>

      <h2>1. Dados que coletamos</h2>
      <p>Coletamos os dados fornecidos no cadastro (nome, e-mail, telefone, cidade), dados dos anúncios cadastrados pelos Anfitriões (fotos, localização, preços), e dados de uso da plataforma (reservas, avaliações, mensagens trocadas entre usuários).</p>

      <h2>2. Como usamos seus dados</h2>
      <p>Usamos os dados para viabilizar reservas, processar pagamentos via Mercado Pago, exibir anúncios e perfis públicos, enviar comunicações sobre suas reservas, e melhorar a experiência da plataforma.</p>

      <h2>3. Compartilhamento de dados</h2>
      <p>Compartilhamos os dados estritamente necessários entre Hóspede e Anfitrião para viabilizar uma reserva (por exemplo, nome e telefone). Dados de pagamento são processados diretamente pelo Mercado Pago e não ficam armazenados em nossos servidores.</p>

      <h2>4. Armazenamento e segurança</h2>
      <p>Os dados são armazenados em infraestrutura do Supabase, com controle de acesso por usuário. Adotamos medidas técnicas razoáveis para proteger as informações contra acesso não autorizado.</p>

      <h2>5. Seus direitos</h2>
      <p>Você pode solicitar a atualização ou exclusão dos seus dados pessoais a qualquer momento, entrando em contato pelos canais de suporte da plataforma, nos termos da Lei Geral de Proteção de Dados (LGPD).</p>

      <h2>6. Cookies</h2>
      <p>Utilizamos cookies e ferramentas de análise (como o Google Analytics) para entender o uso da plataforma e melhorar a experiência dos usuários.</p>

      <h2>7. Alterações nesta política</h2>
      <p>Esta política pode ser atualizada periodicamente. A versão mais recente estará sempre disponível nesta página.</p>
    </LegalLayout>
  )
}
