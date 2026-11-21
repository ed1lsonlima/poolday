import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PROGRAMA_PADRAO } from '../../lib/referralProgram'

// Valor, vagas e situação do programa, direto do banco. Enquanto carrega, mostra os valores padrão.
export default function useReferralProgram() {
  const [programa, setPrograma] = useState({ ...PROGRAMA_PADRAO, carregando: true })
  useEffect(() => {
    let vivo = true
    supabase.rpc('programa_indicacao_publico').then(({ data, error }) => {
      if (!vivo) return
      const row = Array.isArray(data) ? data[0] : data
      setPrograma(error || !row ? { ...PROGRAMA_PADRAO, carregando: false } : { ...row, carregando: false })
    }, () => vivo && setPrograma({ ...PROGRAMA_PADRAO, carregando: false }))
    return () => { vivo = false }
  }, [])
  return programa
}
