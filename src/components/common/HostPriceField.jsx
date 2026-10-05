import { useState } from 'react'
import { hostPayout, listedPriceForPayout } from '../../lib/hostPricing'

const money = value => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function HostPriceField({ value, onChange }) {
  const [desiredPayout, setDesiredPayout] = useState(null)
  const price = Number(value)
  const valid = Number.isFinite(price) && price >= 30
  const suggested = valid ? listedPriceForPayout(price) : 0

  return <div className="space-y-3">
    <div>
      <label htmlFor="poolday-daily-price" className="text-sm font-semibold text-gray-700 mb-1.5 block">Valor anunciado por diária *</label>
      <div className="relative">
        <span className="absolute left-3 top-3 text-gray-400">R$</span>
        <input id="poolday-daily-price" className="input-field pl-10" type="number" min="30" step="0.01" inputMode="decimal" placeholder="Ex.: 500" value={value}
          onChange={event => { setDesiredPayout(null); onChange(event.target.value) }} required />
      </div>
      <p className="text-xs text-gray-500 mt-1">É o preço da diária do seu anúncio. Você pode ajustar para receber o valor desejado depois da taxa.</p>
    </div>
    {valid && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm space-y-2">
      <div className="flex justify-between gap-3"><span className="text-emerald-800">Nas suas 3 primeiras reservas</span><b className="text-emerald-800">Você recebe R$ {money(price)}</b></div>
      <div className="flex justify-between gap-3"><span className="text-gray-700">A partir da 4ª reserva (taxa de 15%)</span><b className="text-gray-900">Você recebe R$ {money(hostPayout(price))}</b></div>
      {desiredPayout == null ? <div className="border-t border-emerald-200 pt-3">
        <p className="text-gray-700">Quer receber <b>R$ {money(price)}</b> mesmo após a promoção? Anuncie a diária por <b>R$ {money(suggested)}</b>.</p>
        <button type="button" className="mt-2 text-sm font-semibold text-primary-700 underline" onClick={() => { setDesiredPayout(price); onChange(String(suggested)) }}>Usar preço sugerido</button>
      </div> : <p className="border-t border-emerald-200 pt-3 text-emerald-800">Preço ajustado para você receber pelo menos R$ {money(desiredPayout)} por diária após a taxa do PoolDay.</p>}
      <p className="text-xs text-gray-500">Valores antes das tarifas de processamento do Mercado Pago.</p>
    </div>}
  </div>
}

