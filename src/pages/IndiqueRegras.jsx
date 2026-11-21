import { Link } from 'react-router-dom'
import LegalLayout from '../components/common/LegalLayout'
import useReferralProgram from '../components/referral/useReferralProgram'
import { PRAZO_ANALISE_DIAS, PRAZO_LINK_DIAS, PRAZO_PIX_DIAS, reais, TOLERANCIA_DIAS } from '../lib/referralProgram'

export default function IndiqueRegras() {
  const { valor_centavos: valor, vagas } = useReferralProgram()
  return (
    <LegalLayout title="Regulamento: Indique um anfitrião" updated="novembro de 2026">
      <p>Este regulamento explica como funciona o programa de indicação de anfitriões do PoolDay. Em resumo: você recebe {reais(valor)} quando o espaço que você indicou for cadastrado completo e aprovado pelo PoolDay. Só indicar, ou só o anfitrião criar a conta, não gera pagamento.</p>

      <h2>1. Quem pode participar</h2>
      <p>Qualquer pessoa maior de 18 anos com conta no PoolDay, que informe nome, WhatsApp, CPF e chave Pix válidos e aceite este regulamento.</p>

      <h2>2. Valor</h2>
      <p>{reais(valor)} por dono de espaço indicado, uma vez só por anfitrião, mesmo que ele cadastre mais de um espaço. Cada anfitrião só pode ter um indicador: vale o primeiro código registrado no cadastro dele.</p>

      <h2>3. Quando o valor é liberado</h2>
      <p>Quando o primeiro espaço do anfitrião indicado for aprovado pelo PoolDay. Para ser aprovado, o anúncio precisa estar completo (fotos reais, preço, dias disponíveis, regras e endereço) e o PoolDay precisa confirmar que o espaço é real. Não é preciso ter reserva.</p>

      <h2>4. Como é a verificação</h2>
      <p>O PoolDay analisa o anúncio, confere fotos e endereço, fala com o anfitrião pelo WhatsApp e pode pedir um vídeo curto ou uma chamada de vídeo mostrando o espaço. A análise costuma levar até {PRAZO_ANALISE_DIAS} dias depois que o anúncio está completo. Anúncio incompleto fica em análise e não é pago enquanto não for aprovado.</p>

      <h2>5. Limite de vagas</h2>
      <p>O programa vale para os {vagas} primeiros espaços aprovados. Quando as vagas acabam, não é possível gerar links novos. Indicações que já estavam em andamento recebem normalmente se forem aprovadas em até {TOLERANCIA_DIAS} dias depois do encerramento. Depois disso, a indicação aprovada fica sem recompensa.</p>

      <h2>6. Prazos</h2>
      <p>O anfitrião indicado precisa criar a conta em até {PRAZO_LINK_DIAS} dias depois de clicar no seu link. O Pix é pago em até {PRAZO_PIX_DIAS} dias depois da aprovação do espaço.</p>

      <h2>7. O que não vale</h2>
      <ul>
        <li>Indicar a si mesmo: mesmo CPF, e-mail, WhatsApp ou chave Pix entre quem indica e o anfitrião.</li>
        <li>Indicar quem já era anfitrião cadastrado no PoolDay antes da indicação.</li>
        <li>Espaço falso, copiado da internet, de outra pessoa sem autorização, ou que não passou na verificação.</li>
        <li>Anúncio incompleto.</li>
        <li>Envio em massa ou spam do link.</li>
      </ul>

      <h2>8. Como é pago</h2>
      <p>Por Pix, feito manualmente pelo PoolDay para a chave informada no cadastro de indicador. Confira se a chave está correta: o PoolDay não se responsabiliza por chave errada informada por você.</p>

      <h2>9. Fraude</h2>
      <p>O PoolDay pode reprovar espaço que não comprovar ser real. Se descobrir depois que um espaço era falso ou que houve fraude, a indicação é invalidada e o indicador é bloqueado no programa.</p>

      <h2>10. Seus dados</h2>
      <p>CPF e chave Pix são usados só para pagar o Pix e evitar fraude. Só a administração do PoolDay vê esses dados. Veja também a <Link to="/privacidade">Política de Privacidade</Link>.</p>

      <h2>11. Mudanças e encerramento</h2>
      <p>O PoolDay pode mudar ou encerrar o programa com aviso nesta página, sem afetar as indicações já aprovadas.</p>
    </LegalLayout>
  )
}
