import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SITE_URL } from '../lib/site'
import { referralLink } from '../lib/referral'
import ReferralView from '../components/referral/ReferralView'

const ERRORS = {
  CONTA_CLIENTE_NECESSARIA: 'O programa é para contas de cliente.',
  NOME_INVALIDO: 'Informe seu nome.',
  WHATSAPP_INVALIDO: 'Informe um WhatsApp válido com DDD.',
  PIX_INVALIDO: 'Informe uma chave Pix válida.',
}

const maskWhats = value => {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function IndiqueEGanhe() {
  const { user, profile } = useAuth()
  const notClient = profile?.role !== 'client'
  const [referrer, setReferrer] = useState(null)
  const [form, setForm] = useState({ nome: profile?.name || '', whatsapp: maskWhats(profile?.phone || ''), chave_pix: '' })
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (notClient || !user) return
    const [own, list] = await Promise.all([
      supabase.from('indicadores').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('minhas_indicacoes'),
    ])
    if (own.error || list.error) return toast.error('Não foi possível carregar suas indicações. Tente novamente.')
    if (own.data) {
      setReferrer(own.data)
      setForm({ nome: own.data.nome || '', whatsapp: maskWhats(own.data.whatsapp || ''), chave_pix: own.data.chave_pix || '' })
    }
    setHistory(list.data || [])
  }, [notClient, user])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    const { data, error } = await supabase.rpc('salvar_indicador', { p_nome: form.nome, p_whatsapp: form.whatsapp, p_chave_pix: form.chave_pix })
    setSaving(false)
    if (error) return toast.error(ERRORS[Object.keys(ERRORS).find(code => error.message?.includes(code))] || 'Não foi possível salvar. Tente novamente.')
    setReferrer(data)
    toast.success(referrer ? 'Dados atualizados.' : 'Pronto! Seu link foi gerado.')
  }

  const link = referrer ? referralLink(SITE_URL, referrer.codigo) : ''
  async function copy() {
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado.') }
    catch { toast.error('Não foi possível copiar. Selecione o link e copie manualmente.') }
  }

  return <ReferralView link={link} form={form} onChange={patch => setForm(current => ({ ...current, ...patch, ...(patch.whatsapp !== undefined && { whatsapp: maskWhats(patch.whatsapp) }) }))}
    onSave={save} saving={saving} inactive={referrer && !referrer.ativo} history={history} notClient={notClient} onCopy={copy}/>
}
