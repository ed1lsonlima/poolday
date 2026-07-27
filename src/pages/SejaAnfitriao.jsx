import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Waves } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

/* ════════════════════════════════════════════════════════════════
   LANDING PAGE — SEJA ANFITRIÃO  (rota: /seja-anfitriao)

   É esta a URL que vai no Google Ads. Página feita pra UMA coisa:
   transformar dono de espaço parado em anfitrião empolgado.

   Funil:
   1. Topo vende o GANHO  → 2. Simulador mostra números altos
   → 3. Confiança (grátis, você no controle, Pix seguro)
   → 4. Formulário curto (grava o lead no Supabase ANTES de tudo)
   → 5. Passo a passo animando a pessoa a cadastrar sozinha
   → 6. Botão grande "Criar minha conta"
   → 7. Rede de segurança discreta no WhatsApp (a gente cadastra pra você)

   A taxa de 15% aparece de leve e SEMPRE enquadrada como "quem paga é
   o cliente" — nunca como custo do anfitrião.
   ════════════════════════════════════════════════════════════════ */

// WhatsApp comercial do PoolDay (rede de segurança, não é o CTA principal)
const WHATSAPP = '5582996987838'

// ── GOOGLE ADS: preencha depois de criar as conversões no painel ──
// Peça ao Cláudio pra plugar, ou cole aqui. Enquanto vazio, não faz nada
// (nenhum erro). Formato do id: 'AW-XXXXXXXXX'
const GOOGLE_ADS = {
  id: '',                 // ex: 'AW-1234567890'
  label_formulario: '',   // conversão principal: enviou o formulário
  label_criar_conta: '',  // conversão secundária: clicou em criar conta
}
function dispararConversao(label) {
  try {
    if (typeof window !== 'undefined' && window.gtag && GOOGLE_ADS.id && label) {
      window.gtag('event', 'conversion', { send_to: `${GOOGLE_ADS.id}/${label}` })
    }
  } catch (_) { /* nunca deixa a medição quebrar a página */ }
}

// (Opcional) cole o ID de um vídeo do YouTube mostrando o cadastro.
// Ex: 'dQw4w9WgXcQ'. Vazio = mostra só os cartões de passo a passo.
const YOUTUBE_ID = ''

const BRL = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const TIPOS = ['Piscina', 'Chácara', 'Área de lazer / gourmet', 'Sítio', 'Salão de festas', 'Outro']

export default function SejaAnfitriao() {
  // ── Simulador ──────────────────────────────────────────────
  const [diaria, setDiaria] = useState(350)      // o que o anfitrião quer receber
  const [reservas, setReservas] = useState(8)    // reservas por mês
  const ganhoMes = useMemo(() => diaria * reservas, [diaria, reservas])
  const ganhoAno = ganhoMes * 12
  const clientePaga = Math.round(diaria * 1.15)   // taxa vai por conta do cliente

  // ── Formulário ─────────────────────────────────────────────
  const [form, setForm] = useState({ nome: '', whatsapp: '', cidade: '', tipo: 'Piscina' })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const formRef = useRef(null)
  const passosRef = useRef(null)

  const scrollTo = (ref) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const maskWhats = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  const handleSubmit = async () => {
    const nome = form.nome.trim()
    const whatsDigits = form.whatsapp.replace(/\D/g, '')
    if (nome.length < 2) return toast.error('Digite seu nome')
    if (whatsDigits.length < 10) return toast.error('Digite um WhatsApp válido com DDD')

    setEnviando(true)
    try {
      const { error } = await supabase.from('leads_anfitriao').insert({
        nome,
        whatsapp: whatsDigits,
        cidade: form.cidade.trim() || null,
        tipo_espaco: form.tipo,
        origem: 'google-ads',
      })
      if (error) throw error

      dispararConversao(GOOGLE_ADS.label_formulario)   // conversão principal
      setEnviado(true)
      toast.success('Recebido! Agora é só criar sua conta 👇')
      setTimeout(() => scrollTo(passosRef), 120)
    } catch (e) {
      console.error(e)
      toast.error('Não deu pra enviar agora. Tente de novo em instantes.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Barra superior enxuta (sem menu = menos distração) ── */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Waves className="text-primary-500" size={26} />
            <span className="text-xl font-bold text-gray-800 tracking-tight">PoolDay</span>
          </Link>
          <button
            onClick={() => scrollTo(formRef)}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            Começar agora
          </button>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-500 to-primary-700 text-white">
        <FloatingBubbles />
        <div className="relative max-w-5xl mx-auto px-5 pt-14 pb-16 md:pt-20 md:pb-24 text-center">
          <span className="inline-block bg-white/15 backdrop-blur px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            🏊 Seu espaço parado pode virar renda
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight max-w-3xl mx-auto">
            Transforme sua piscina em{' '}
            <span className="text-orange-400">dinheiro todo fim de semana</span>
          </h1>
          <p className="mt-5 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            Anunciar é <b>grátis</b>. Você define o preço, controla sua agenda e recebe
            direto no Pix. Enquanto seu espaço fica parado, ele podia estar te pagando.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => scrollTo(formRef)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg py-4 px-8 rounded-2xl shadow-lg transition-all active:scale-[0.97]"
            >
              Quero anunciar meu espaço
            </button>
            <a
              href="#simulador"
              onClick={(e) => { e.preventDefault(); document.getElementById('simulador')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-white font-semibold text-lg py-4 px-8 rounded-2xl transition-all"
            >
              Ver quanto posso ganhar
            </a>
          </div>
          <p className="mt-5 text-sm text-white/70">
            Sem mensalidade • Cadastro em minutos • Você no controle
          </p>
        </div>
        {/* onda decorativa */}
        <svg viewBox="0 0 1440 60" className="block w-full text-white" preserveAspectRatio="none">
          <path fill="currentColor" d="M0,32 C240,64 480,0 720,16 C960,32 1200,64 1440,32 L1440,60 L0,60 Z" />
        </svg>
      </section>

      {/* ══ FAIXA: BRASIL INTEIRO / MOVIMENTO ══ */}
      <FaixaBrasil />

      {/* ══ SIMULADOR ══ */}
      <section id="simulador" className="max-w-3xl mx-auto px-5 py-14 md:py-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold">
            Faça as contas: <span className="text-primary-500">quanto o seu espaço rende?</span>
          </h2>
          <p className="mt-2 text-gray-500">Arraste e veja o valor que pode cair no seu bolso.</p>
        </div>

        <div className="card p-6 md:p-8 shadow-md border-gray-100">
          {/* Diária */}
          <div className="mb-7">
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-semibold text-gray-700">Sua diária</label>
              <span className="text-2xl font-extrabold text-primary-500">{BRL(diaria)}</span>
            </div>
            <input
              type="range" min={150} max={800} step={50}
              value={diaria}
              onChange={(e) => setDiaria(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>R$ 150</span><span>R$ 800</span>
            </div>
          </div>

          {/* Reservas por mês */}
          <div className="mb-8">
            <label className="font-semibold text-gray-700 block mb-3">
              Reservas por mês
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[4, 8, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => setReservas(n)}
                  className={`py-3 rounded-xl font-bold border-2 transition-all ${
                    reservas === n
                      ? 'bg-primary-500 border-primary-500 text-white shadow'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {n}
                  <span className="block text-xs font-normal opacity-80">
                    {n === 4 ? '1 por semana' : n === 8 ? '2 por semana' : '3 por semana'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Resultado — número GRANDE */}
          <div className="bg-gradient-to-br from-orange-50 to-primary-50 rounded-2xl p-6 text-center border border-orange-100">
            <p className="text-gray-600 font-medium">Você pode receber até</p>
            <p className="text-4xl md:text-5xl font-extrabold text-orange-600 my-1">
              {BRL(ganhoMes)}
            </p>
            <p className="text-gray-600 font-medium">por mês</p>
            <p className="mt-3 text-sm text-primary-600 font-semibold">
              São {BRL(ganhoAno)} por ano com um espaço que hoje está parado 💰
            </p>
          </div>

          {/* A taxa, de leve e enquadrada como custo do cliente */}
          <div className="mt-4 flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
            <span className="text-lg leading-none">✅</span>
            <p>
              O melhor: <b>a taxa de serviço é paga por quem aluga, não por você.</b>{' '}
              Se você quer receber {BRL(diaria)}, o cliente paga {BRL(clientePaga)} e{' '}
              <b>os {BRL(diaria)} caem 100% pra você</b>. Simples assim.
            </p>
          </div>

          <button
            onClick={() => scrollTo(formRef)}
            className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-[0.98]"
          >
            Quero ganhar isso todo mês
          </button>
        </div>
      </section>

      {/* ══ CONFIANÇA ══ */}
      <section className="bg-primary-50/60 py-14 md:py-16">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-center text-2xl md:text-3xl font-extrabold mb-10">
            Por que anunciar no PoolDay
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            <Beneficio
              emoji="🆓"
              titulo="Anunciar é grátis"
              texto="Sem mensalidade e sem taxa pra cadastrar. Você só ganha — nunca paga pra ter seu espaço na plataforma."
            />
            <Beneficio
              emoji="🎯"
              titulo="Você no controle total"
              texto="Você decide o preço, os dias e horários disponíveis. Bloqueou a data? Ninguém reserva. É a sua casa, suas regras."
            />
            <Beneficio
              emoji="🔒"
              titulo="Pagamento seguro no Pix"
              texto="O cliente paga antes pelo Mercado Pago e o dinheiro vem direto pra você. Sem calote, sem dor de cabeça."
            />
          </div>
        </div>
      </section>

      {/* ══ TELAS POR DENTRO (iPhones) ══ */}
      <TelasPorDentro onCta={() => scrollTo(formRef)} />

      {/* ══ FORMULÁRIO ══ */}
      <section ref={formRef} className="max-w-xl mx-auto px-5 py-14 md:py-20">
        {!enviado ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-extrabold">
                Comece agora. <span className="text-primary-500">Leva 1 minuto.</span>
              </h2>
              <p className="mt-2 text-gray-500">
                Preencha e a gente já te mostra o passo a passo pra colocar seu espaço no ar.
              </p>
            </div>

            <div className="card p-6 md:p-8 shadow-md space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Seu nome *</label>
                <input
                  className="input-field"
                  placeholder="Como podemos te chamar?"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">WhatsApp *</label>
                <input
                  className="input-field"
                  inputMode="numeric"
                  placeholder="(82) 99999-9999"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: maskWhats(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Sua cidade</label>
                <input
                  className="input-field"
                  placeholder="Ex: Maceió"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">O que você quer alugar?</label>
                <select
                  className="input-field"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={enviando}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {enviando ? 'Enviando...' : 'Quero começar a ganhar dinheiro'}
              </button>
              <p className="text-center text-xs text-gray-400">
                Seus dados são usados só pra te ajudar a começar. Sem spam.
              </p>
            </div>
          </>
        ) : (
          <PassoAPasso ref={passosRef} nome={form.nome} />
        )}
      </section>

      {/* ══ RODAPÉ ══ */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <Link to="/" className="inline-flex items-center gap-2">
          <Waves className="text-primary-500" size={20} />
          <span className="font-bold text-gray-700">PoolDay</span>
        </Link>
        <p className="mt-2">Seu espaço de lazer, gerando renda.</p>
      </footer>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   PASSO A PASSO (aparece depois que o lead é enviado)
   É o momento de pico de empolgação — aqui a gente empurra pro
   cadastro sozinho, reforçando o ganho em cada etapa.
   ───────────────────────────────────────────────────────────── */
import { forwardRef } from 'react'

const PASSOS = [
  {
    n: 1, emoji: '📝', titulo: 'Crie sua conta grátis',
    texto: 'Leva menos de 2 minutos. É de graça e não tem pegadinha.',
  },
  {
    n: 2, emoji: '📸', titulo: 'Coloque boas fotos do seu espaço',
    texto: 'Espaços com fotos caprichadas alugam muito mais. Capriche que o retorno vem.',
  },
  {
    n: 3, emoji: '💰', titulo: 'Defina o seu preço',
    texto: 'Você escolhe quanto quer receber por diária — e é isso que cai pra você, 100%.',
  },
  {
    n: 4, emoji: '🎉', titulo: 'Pronto! Comece a receber reservas',
    texto: 'Seu espaço parado agora trabalha por você todo fim de semana.',
  },
]

const PassoAPasso = forwardRef(function PassoAPasso({ nome }, ref) {
  return (
    <div ref={ref} className="text-center">
      <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center text-3xl mb-4">
        ✅
      </div>
      <h2 className="text-2xl md:text-3xl font-extrabold">
        {nome ? `Boa, ${nome.split(' ')[0]}!` : 'Boa!'} Agora falta pouco 🚀
      </h2>
      <p className="mt-2 text-gray-500 max-w-md mx-auto">
        Seu espaço está a 4 passos de começar a te render dinheiro. Olha como é simples:
      </p>

      {YOUTUBE_ID && (
        <div className="mt-6 aspect-video rounded-2xl overflow-hidden shadow-md">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${YOUTUBE_ID}`}
            title="Como cadastrar seu espaço no PoolDay"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div className="mt-8 space-y-3 text-left">
        {PASSOS.map((p) => (
          <div key={p.n} className="card p-4 flex items-start gap-4 shadow-sm">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center text-2xl">
              {p.emoji}
            </div>
            <div>
              <p className="font-bold text-gray-800">
                <span className="text-primary-500">{p.n}.</span> {p.titulo}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{p.texto}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/cadastro?tipo=anfitriao"
        onClick={() => dispararConversao(GOOGLE_ADS.label_criar_conta)}
        className="mt-8 block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-[0.98]"
      >
        Criar minha conta no PoolDay
      </Link>

      {/* Rede de segurança discreta pra quem é leigo e trava */}
      <a
        href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Oi! Preenchi o formulário do PoolDay e queria uma ajuda pra cadastrar meu espaço.')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-sm text-gray-500 hover:text-primary-600"
      >
        Travou em alguma parte? <b className="underline">A gente cadastra pra você</b> →
      </a>
    </div>
  )
})

/* ── Cartão de benefício ── */
function Beneficio({ emoji, titulo, texto }) {
  return (
    <div className="card p-6 text-center shadow-sm h-full">
      <div className="text-4xl mb-3">{emoji}</div>
      <h3 className="font-bold text-lg text-gray-800 mb-1">{titulo}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{texto}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FAIXA "BRASIL INTEIRO" — prova social sem números inventados.
   (Quando você tiver métricas reais, dá pra trocar as frases por
    contadores de verdade — é só pedir pro Cláudio.)
   ───────────────────────────────────────────────────────────── */
function FaixaBrasil() {
  const cidades = ['Maceió', 'Recife', 'Salvador', 'São Paulo', 'Fortaleza', 'Rio de Janeiro', 'Brasília', 'Curitiba']
  return (
    <section className="bg-white border-y border-gray-100 py-8">
      <div className="max-w-5xl mx-auto px-5 text-center">
        <p className="text-2xl md:text-3xl font-extrabold">
          🇧🇷 O PoolDay é no <span className="text-primary-500">Brasil inteiro</span>
        </p>
        <p className="mt-2 text-gray-500 max-w-xl mx-auto">
          Todo dia mais gente entra na plataforma procurando um espaço pra alugar —
          do Nordeste ao Sul. Coloque o seu no mapa e comece a aparecer pra esses clientes.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {cidades.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 bg-primary-50 text-primary-600 text-sm font-medium px-3 py-1.5 rounded-full">
              📍 {c}
            </span>
          ))}
          <span className="inline-flex items-center bg-orange-50 text-orange-600 text-sm font-semibold px-3 py-1.5 rounded-full">
            e a sua cidade também
          </span>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   TELAS POR DENTRO — três iPhones com recriações das telas do site.
   ───────────────────────────────────────────────────────────── */
function Phone({ children }) {
  return (
    <div className="relative mx-auto" style={{ width: 210 }}>
      <div className="relative rounded-[2.2rem] bg-gray-900 p-2 shadow-2xl" style={{ height: 430 }}>
        {/* notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-b-2xl z-10" />
        <div className="w-full h-full rounded-[1.7rem] overflow-hidden bg-white relative">
          {children}
        </div>
      </div>
    </div>
  )
}

function TelasPorDentro({ onCta }) {
  return (
    <section className="bg-gradient-to-b from-primary-50/40 to-white py-14 md:py-20">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold">
            Veja como é <span className="text-primary-500">por dentro</span>
          </h2>
          <p className="mt-2 text-gray-500 max-w-xl mx-auto">
            Uma plataforma bonita e simples — do jeito que seus clientes vão ver o seu espaço.
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-end gap-6 md:gap-8">
          {/* Tela 1 — Home */}
          <Phone>
            <div className="h-[46%] bg-gradient-to-b from-primary-500 to-primary-700 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                <span className="absolute rounded-full bg-white/40" style={{ width: 40, height: 40, left: 20, top: 30 }} />
                <span className="absolute rounded-full bg-white/30" style={{ width: 26, height: 26, right: 24, top: 60 }} />
                <span className="absolute rounded-full bg-white/25" style={{ width: 60, height: 60, left: 70, top: 80 }} />
              </div>
              <div className="relative pt-7 px-4 text-white">
                <div className="flex items-center gap-1 text-sm font-bold"><Waves size={16} /> PoolDay</div>
                <p className="mt-6 text-[15px] font-extrabold leading-tight">Alugue piscinas e espaços por hora</p>
              </div>
            </div>
            <div className="p-3">
              <div className="bg-white rounded-xl shadow -mt-6 relative p-2.5 border border-gray-100">
                <div className="h-2 w-16 bg-gray-200 rounded mb-2" />
                <div className="h-7 bg-primary-500 rounded-lg text-white text-[11px] font-semibold flex items-center justify-center">Buscar espaço</div>
              </div>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 h-14 rounded-lg bg-gradient-to-br from-orange-200 to-orange-400" />
                <div className="flex-1 h-14 rounded-lg bg-gradient-to-br from-primary-200 to-primary-400" />
              </div>
            </div>
          </Phone>

          {/* Tela 2 — Espaço/Explorar (destaque central, um pouco maior) */}
          <div className="order-first md:order-none -mb-2 md:mb-0 md:scale-110 md:mx-2">
            <Phone>
              <div className="h-[42%] bg-gradient-to-br from-primary-300 to-primary-500 relative">
                <span className="absolute top-2 right-2 bg-white/90 text-primary-600 text-[10px] font-bold px-2 py-0.5 rounded-full">R$ 350/diária</span>
                <span className="absolute bottom-2 left-2 text-white text-[10px] font-medium">☀️ Piscina + área gourmet</span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-gray-300 rounded" />
                  <span className="text-[10px] font-bold text-orange-500">★ 4,9</span>
                </div>
                <div className="mt-1 h-2 w-16 bg-gray-200 rounded" />
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {['👥 20','🕐 8h','🅿️ Sim'].map((t) => (
                    <div key={t} className="text-[9px] text-gray-500 bg-gray-50 rounded py-1 text-center">{t}</div>
                  ))}
                </div>
                <div className="mt-3 h-8 bg-orange-500 rounded-lg text-white text-[11px] font-semibold flex items-center justify-center">Reservar agora</div>
              </div>
            </Phone>
          </div>

          {/* Tela 3 — Reserva confirmada */}
          <Phone>
            <div className="h-full flex flex-col items-center justify-center px-5 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-3xl mb-3">✅</div>
              <p className="font-extrabold text-gray-800">Reserva confirmada!</p>
              <p className="text-[11px] text-gray-500 mt-1">Pagamento via Pix aprovado. O valor cai direto pra você.</p>
              <div className="mt-4 w-full bg-gray-50 rounded-xl p-3 text-left">
                <div className="flex justify-between text-[11px] mb-1.5"><span className="text-gray-400">Espaço</span><span className="font-semibold text-gray-700">Piscina do Sítio</span></div>
                <div className="flex justify-between text-[11px] mb-1.5"><span className="text-gray-400">Data</span><span className="font-semibold text-gray-700">Sáb, 09/08</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-gray-400">Você recebe</span><span className="font-extrabold text-green-600">R$ 350</span></div>
              </div>
            </div>
          </Phone>
        </div>

        <div className="text-center mt-12">
          <button
            onClick={onCta}
            className="bg-primary-500 hover:bg-primary-600 text-white font-bold text-lg py-4 px-8 rounded-2xl transition-all active:scale-[0.97]"
          >
            Quero meu espaço aparecendo assim
          </button>
        </div>
      </div>
    </section>
  )
}


/* ── Bolhas decorativas do hero (leves, sem custo de lib) ── */
function FloatingBubbles() {
  const bolhas = [
    { l: '8%', s: 90, d: '0s', o: 0.12 },
    { l: '22%', s: 46, d: '1.4s', o: 0.16 },
    { l: '40%', s: 130, d: '0.6s', o: 0.08 },
    { l: '58%', s: 60, d: '2.1s', o: 0.14 },
    { l: '74%', s: 100, d: '0.9s', o: 0.10 },
    { l: '88%', s: 54, d: '1.8s', o: 0.15 },
  ]
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bolhas.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: b.l,
            bottom: -40,
            width: b.s,
            height: b.s,
            opacity: b.o,
            background:
              'radial-gradient(circle at 32% 30%, rgba(255,255,255,0.7), rgba(255,255,255,0.05) 70%)',
            animation: `bubble-rise ${9 + i}s linear ${b.d} infinite`,
          }}
        />
      ))}
    </div>
  )
}
