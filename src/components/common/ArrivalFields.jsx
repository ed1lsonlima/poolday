export default function ArrivalFields({ form, update }) {
  return <div className="space-y-4">
    <div><h2 className="font-bold text-gray-900">Onde fica o espaço?</h2><p className="text-sm text-gray-500 mt-1">Só o cliente com pagamento confirmado recebe o endereço completo.</p></div>
    <label className="block text-sm font-medium text-gray-700">Endereço completo *
      <input className="input-field mt-1" value={form.address} onChange={event => update('address', event.target.value)} placeholder="Rua ou estrada, número e complemento" />
    </label>
    <label className="block text-sm font-medium text-gray-700">Dica para chegar ou entrar (opcional)
      <textarea className="input-field mt-1 resize-y min-h-24" value={form.checkin_instructions} onChange={event => update('checkin_instructions', event.target.value)} placeholder="Ex.: entrada pelo portão azul. Para sítios, explique o caminho." />
    </label>
    <p className="text-xs text-gray-500">Não precisa copiar link do Google. Informe um endereço que o cliente consiga encontrar.</p>
    <details className="border-t border-gray-100 pt-3">
      <summary className="text-sm font-semibold text-primary-600 cursor-pointer">Mais detalhes de localização (opcional)</summary>
      <div className="space-y-3 mt-3">
        <label className="block text-sm text-gray-600">CEP<input className="input-field mt-1" inputMode="numeric" value={form.cep} onChange={event => update('cep', event.target.value)} placeholder="00000-000" /></label>
        <label className="block text-sm text-gray-600">Ponto de referência<input className="input-field mt-1" value={form.landmark} onChange={event => update('landmark', event.target.value)} placeholder="Ex.: depois da igreja" /></label>
        <label className="block text-sm text-gray-600">Link do mapa (opcional)<input className="input-field mt-1" value={form.map_url} onChange={event => update('map_url', event.target.value)} placeholder="Somente se quiser incluir Google Maps ou Waze" /></label>
      </div>
    </details>
  </div>
}
