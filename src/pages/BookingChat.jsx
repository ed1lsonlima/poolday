import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCheck, Flag, MessageCircle, MoreHorizontal, Pencil, Send, ShieldCheck, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { CHAT_NOTICES, CHAT_NOTICE_VERSION, QUICK_MESSAGES } from '../lib/chatSafety'
import { isNearChatBottom } from '../lib/chatScroll'

const supportUrl = bookingId => `https://wa.me/5582996987838?text=${encodeURIComponent(`Olá, equipe PoolDay! Preciso de ajuda com a reserva ${bookingId}.`)}`

async function request(bookingId, body, before) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Entre novamente na sua conta.')
  const response = await fetch(body ? '/api/booking-chat' : `/api/booking-chat?bookingId=${encodeURIComponent(bookingId)}${before ? `&before=${encodeURIComponent(before)}` : ''}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify({ bookingId, ...body }) }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a conversa.')
  return result
}

export default function BookingChat() {
  const { id } = useParams()
  const { user } = useAuth()
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [activeMenu, setActiveMenu] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const messageList = useRef(null)
  const followLatest = useRef(true)
  const olderScrollPosition = useRef(null)

  const load = useCallback(async (quiet = false) => {
    try {
      const next = await request(id)
      setState(previous => {
        if (!previous?.accepted || !next.accepted) return next
        const merged = new Map([...previous.messages, ...next.messages].map(message => [message.id, message]))
        return { ...next, messages: [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)), hasMore: previous.hasMore }
      })
      setError('')
    } catch (err) { if (!quiet) setError(err.message) }
  }, [id])

  useEffect(() => { if (user) load() }, [user, load])
  useEffect(() => {
    if (!state?.accepted) return
    const refresh = () => { if (document.visibilityState === 'visible') load(true) }
    const timer = setInterval(refresh, 3000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
  }, [state?.accepted, load])
  useLayoutEffect(() => {
    const list = messageList.current
    if (!list) return
    if (olderScrollPosition.current) {
      const { top, height } = olderScrollPosition.current
      list.scrollTop = top + list.scrollHeight - height
      olderScrollPosition.current = null
    } else if (followLatest.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [state?.accepted, state?.messages?.length])

  async function accept() {
    setBusy(true)
    try { await request(id, { action: 'accept', noticeVersion: CHAT_NOTICE_VERSION }); await load() }
    catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function send(content = draft, urgent = false) {
    if (!content.trim() || busy) return
    setBusy(true)
    try {
      await request(id, { action: 'send', content: content.trim(), urgent })
      setDraft('')
      followLatest.current = true
      await load(true)
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function loadOlder() {
    if (!state?.messages?.length || busy) return
    setBusy(true)
    try {
      const older = await request(id, null, state.messages[0].created_at)
      const list = messageList.current
      if (list && older.messages.length) olderScrollPosition.current = { top: list.scrollTop, height: list.scrollHeight }
      setState(previous => ({ ...previous, messages: [...older.messages, ...previous.messages], hasMore: older.hasMore }))
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function editMessage(event) {
    event.preventDefault()
    if (!editDraft.trim() || busy) return
    setBusy(true)
    try {
      await request(id, { action: 'edit', messageId: editingId, content: editDraft.trim() })
      setEditingId(null); setEditDraft('')
      await load(true)
      toast.success('Mensagem editada.')
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function deleteMessage(messageId) {
    if (!window.confirm('Excluir esta mensagem da conversa? A equipe PoolDay manterá o registro para segurança e suporte.')) return
    setBusy(true)
    try {
      await request(id, { action: 'delete', messageId })
      setActiveMenu(null)
      await load(true)
      toast.success('Mensagem excluída da conversa.')
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function report(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await request(id, { action: 'report', reason: reportReason })
      toast.success('Denúncia enviada à equipe PoolDay.')
      setReporting(false); setReportReason('')
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  const role = state?.role
  const notice = CHAT_NOTICES[role]
  return <div className="min-h-[80vh] bg-slate-50 px-4 py-6">
    <div className="max-w-3xl mx-auto">
      <Link to={role === 'host' ? '/anfitriao' : '/reservas'} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary-600 mb-5"><ArrowLeft size={17}/>Voltar às reservas</Link>
      <div className="bg-white border border-gray-100 rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden">
        <header className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-600"><MessageCircle size={23}/></span><div><h1 className="text-lg sm:text-xl font-extrabold text-gray-900">Conversa da reserva</h1><p className="text-xs text-gray-500 mt-0.5">Cliente e anfitrião · reserva {id.slice(0, 8)}</p></div></div>
          <a href={supportUrl(id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-green-50 text-green-700 px-3 py-2 text-xs font-bold hover:bg-green-100"><MessageCircle size={16}/>Falar com o PoolDay</a>
        </header>
        {error ? <div role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => load()} className="font-bold underline ml-2">Tentar novamente</button></div> : null}
        {!state && !error ? <p role="status" className="p-8 text-center text-sm text-gray-500">Carregando conversa...</p> : null}
        {state && !state.accepted && <section className="p-6 sm:p-8 max-w-2xl mx-auto">
          <ShieldCheck size={30} className="text-primary-500 mb-3"/>
          <h2 className="text-xl font-extrabold text-gray-900">{notice?.title}</h2>
          {notice?.paragraphs.map(paragraph => <p key={paragraph} className="text-sm text-gray-600 leading-relaxed mt-4">{paragraph}</p>)}
          {!state.canWrite && <p className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 mt-5">O chat será liberado após a confirmação do pagamento de uma reserva ativa.</p>}
          <button onClick={accept} disabled={!state.canWrite || busy} className="btn-primary w-full mt-6 disabled:opacity-50">{busy ? 'Aguarde...' : 'Li e concordo — abrir chat'}</button>
        </section>}
        {state?.accepted && <>
          <div ref={messageList} onScroll={event => { followLatest.current = isNearChatBottom(event.currentTarget) }} className="h-[min(55vh,520px)] min-h-72 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-3 bg-gradient-to-b from-slate-50 to-primary-50/30" aria-label="Mensagens da reserva">
            {state.hasMore && <button onClick={loadOlder} disabled={busy} className="block mx-auto text-xs font-bold text-primary-600 underline disabled:opacity-50">Carregar mensagens antigas</button>}
            {!state.messages.length && <p className="text-center text-sm text-gray-500 py-16">A conversa ainda não tem mensagens. Você pode começar.</p>}
            {state.messages.map((message, index) => {
              const own = message.sender_id === user.id
              const day = new Date(message.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
              const previousDay = index ? new Date(state.messages[index - 1].created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : null
              return <div key={message.id}>
                {day !== previousDay && <p className="mx-auto mb-4 w-fit rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm" aria-label={`Mensagens de ${day}`}>{day}</p>}
                <div className={`group flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative max-w-[88%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${own ? 'rounded-br-md bg-primary-600 text-white' : 'rounded-bl-md bg-white text-gray-800 border border-gray-100'}`}>
                    {editingId === message.id ? <form onSubmit={editMessage} className="min-w-[220px] space-y-2"><textarea autoFocus aria-label="Editar mensagem" className="w-full min-h-20 rounded-lg p-2 text-gray-900 text-sm" maxLength={1000} value={editDraft} onChange={event => setEditDraft(event.target.value)}/><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="rounded-lg px-2 py-1 text-xs text-white/90">Cancelar</button><button type="submit" disabled={busy || !editDraft.trim()} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-primary-700 disabled:opacity-50">Salvar</button></div></form> : <p className={`whitespace-pre-wrap break-words ${message.deleted_at ? 'italic opacity-70' : ''}`}>{message.deleted_at ? 'Mensagem excluída' : message.content}</p>}
                    <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? 'text-white/75' : 'text-gray-400'}`}><span>{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>{message.edited_at && !message.deleted_at && <span>· editada</span>}{own && !message.deleted_at && (message.read ? <CheckCheck size={13} aria-label="Lida"/> : <Check size={13} aria-label="Enviada"/>)}</div>
                    {own && !message.deleted_at && editingId !== message.id && <div className="absolute -left-10 top-1"><button type="button" aria-label="Opções da mensagem" aria-expanded={activeMenu === message.id} onClick={() => setActiveMenu(value => value === message.id ? null : message.id)} className="grid h-8 w-8 place-items-center rounded-full bg-white text-gray-500 shadow-sm hover:text-primary-600"><MoreHorizontal size={18}/></button>{activeMenu === message.id && <div className="absolute right-7 top-8 z-10 w-32 rounded-xl border border-gray-100 bg-white p-1 text-gray-700 shadow-xl"><button type="button" disabled={!state.canWrite || busy} onClick={() => { setEditingId(message.id); setEditDraft(message.content); setActiveMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"><Pencil size={14}/>Editar</button><button type="button" disabled={busy} onClick={() => deleteMessage(message.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14}/>Excluir</button></div>}</div>}
                  </div>
                </div>
              </div>
            })}
          </div>
          <div className="p-4 sm:p-5 border-t border-gray-100 bg-white">
            {state.canWrite ? <><div className="flex gap-2 overflow-x-auto pb-3">{QUICK_MESSAGES[role]?.map(text => <button key={text} onClick={() => send(text)} disabled={busy} className="shrink-0 border border-primary-100 bg-primary-50 text-primary-700 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{text}</button>)}</div>{state.bookingDate === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Maceio' }) && <button onClick={() => send('Preciso de ajuda agora com a chegada ou acesso ao espaço.', true)} disabled={busy} className="mb-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 text-xs font-bold disabled:opacity-50">Preciso de ajuda agora · avisar a outra pessoa</button>}<form onSubmit={event => { event.preventDefault(); send() }} className="flex gap-2"><input aria-label="Escreva sua mensagem" className="input-field flex-1 min-w-0" maxLength={1000} placeholder="Escreva sua mensagem..." value={draft} onChange={event => setDraft(event.target.value)}/><button type="submit" disabled={busy || !draft.trim()} className="btn-primary px-4 disabled:opacity-50" aria-label="Enviar mensagem"><Send size={19}/></button></form><p className="text-[11px] text-gray-400 mt-2">Mantenha pagamentos e combinações da diária no PoolDay. Não envie contatos externos.</p></> : <p className="text-sm text-gray-500">Esta conversa está disponível apenas para consulta.</p>}
            <button onClick={() => setReporting(value => !value)} className="inline-flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-3"><Flag size={13}/>Denunciar conversa</button>
            {reporting && <form onSubmit={report} className="mt-3 space-y-2"><textarea aria-label="Motivo da denúncia" className="input-field min-h-20" minLength={8} maxLength={500} required value={reportReason} onChange={event => setReportReason(event.target.value)} placeholder="Conte o que aconteceu para a equipe PoolDay."/><button disabled={busy} className="btn-primary text-sm disabled:opacity-50">Enviar denúncia</button></form>}
          </div>
        </>}
      </div>
    </div>
  </div>
}

