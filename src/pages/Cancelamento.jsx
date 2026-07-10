import LegalLayout from '../components/common/LegalLayout'

export default function Cancelamento() {
  return (
    <LegalLayout title="Politica de Cancelamento" updated="julho de 2026">
      <p>Esta politica explica como funcionam os cancelamentos de reservas feitas atraves do PoolDay, tanto por parte do Hospede quanto do Anfitriao.</p>

      <h2>1. Cancelamento pelo Hospede</h2>
      <p>Cancelamentos feitos com mais de 48 horas de antecedencia da data reservada tem direito a reembolso integral. Cancelamentos feitos entre 24h e 48h antes tem direito a reembolso de 50% do valor pago. Cancelamentos com menos de 24h de antecedencia nao tem direito a reembolso.</p>

      <h2>2. Cancelamento pelo Anfitriao</h2>
      <p>Se o Anfitriao cancelar uma reserva ja confirmada, o Hospede recebe reembolso integral do valor pago, independentemente do prazo. Cancelamentos frequentes por parte do Anfitriao podem resultar em penalidades no perfil ou suspensao do anuncio.</p>

      <h2>3. Prazo de reembolso</h2>
      <p>Os reembolsos sao processados atraves do Mercado Pago e podem levar alguns dias uteis para aparecer no extrato do Hospede, conforme prazos do proprio meio de pagamento.</p>

      <h2>4. Casos excepcionais</h2>
      <p>Em casos de forca maior (condicoes climaticas extremas, problemas estruturais no espaco, entre outros), o PoolDay pode avaliar o cancelamento e reembolso fora das regras padrao, mediante analise do caso.</p>

      <h2>5. Disputas</h2>
      <p>Em caso de divergencia entre Hospede e Anfitriao sobre um cancelamento, o PoolDay pode intermediar a conversa para buscar uma solucao, mas a decisao final sobre reembolsos segue as regras desta politica.</p>
    </LegalLayout>
  )
}
