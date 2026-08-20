import { useEffect, useState } from 'react'

import Login from './pages/Login'
import DashboardV2 from './pages/DashboardV2'

import {
  loadSession,
  clearSession,
  startSessionMonitor
} from './services/authService'

import { supabase } from './services/supabaseClient'
import { registerAudit } from './services/auditoriaService'

import {
  obterPerfilTemporarioAtivo,
  PERFIS_TEMPORARIOS
} from './features/perfisTemporarios/services/perfisTemporariosService'

export default function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function revalidateSession() {
      const storedUser = loadSession()

      if (!storedUser?.id || !storedUser?.user_id) {
        clearSession()

        if (!cancelled) {
          setUser(null)
          setCheckingSession(false)
        }

        return
      }

      try {
        const {
          data: usuario,
          error: usuarioError
        } = await supabase
          .from('sigmo_users')
          .select('id, policial_id, perfil, ativo, exige_troca')
          .eq('id', storedUser.user_id)
          .eq('policial_id', storedUser.id)
          .eq('ativo', true)
          .maybeSingle()

        if (usuarioError) throw usuarioError

        if (!usuario || usuario.exige_troca) {
          clearSession()

          if (!cancelled) {
            setUser(null)
          }

          return
        }

        const {
          data: policial,
          error: policialError
        } = await supabase
          .from('policiais')
          .select(
            'id, re, nome, nome_guerra, posto_graduacao, companhia, pelotao'
          )
          .eq('id', usuario.policial_id)
          .maybeSingle()

        if (policialError) throw policialError

        if (!policial) {
          clearSession()

          if (!cancelled) {
            setUser(null)
          }

          return
        }

        let perfilTemporarioAtivo = null

        try {
          perfilTemporarioAtivo =
            await obterPerfilTemporarioAtivo({
              policialRe: policial.re,
              perfil:
                PERFIS_TEMPORARIOS
                  .AUXILIAR_SVDD_TEMPORARIO
            })
        } catch (perfilTemporarioError) {
          console.error(
            'Erro ao revalidar perfil temporário:',
            perfilTemporarioError
          )
        }

        const possuiAuxiliarTemporario = Boolean(
          perfilTemporarioAtivo?.valido
        )

        const validatedUser = {
          ...storedUser,
          id: policial.id,
          re: policial.re,
          nome: policial.nome,
          nome_guerra: policial.nome_guerra,
          posto_graduacao: policial.posto_graduacao,
          companhia: policial.companhia,
          pelotao: policial.pelotao,
          perfil: usuario.perfil,
          perfil_temporario:
            possuiAuxiliarTemporario
              ? 'AUXILIAR DO SVDD'
              : null,
          perfil_temporario_ativo:
            possuiAuxiliarTemporario,
          perfil_temporario_inicio:
            possuiAuxiliarTemporario
              ? perfilTemporarioAtivo?.inicio_em || null
              : null,
          perfil_temporario_fim:
            possuiAuxiliarTemporario
              ? perfilTemporarioAtivo?.expira_em || null
              : null,
          ativo: true,
          user_id: usuario.id,
          exige_troca: false
        }

        if (!cancelled) {
          setUser(validatedUser)
        }
      } catch (error) {
        console.error(
          'Falha ao revalidar sessão do SIGMO:',
          error
        )

        clearSession()

        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false)
        }
      }
    }

    revalidateSession()

    return () => {
      cancelled = true
    }
  }, [])

  function logout(reason = 'MANUAL') {
    let mensagem = 'Usuário saiu do SIGMO.'

    if (reason === 'INACTIVITY') {
      mensagem = 'Logout automático por inatividade.'
    }

    if (reason === 'SESSION_TIMEOUT') {
      mensagem = 'Logout automático por tempo máximo de sessão.'
    }

    registerAudit(
      'LOGOUT',
      mensagem,
      user,
      'Login'
    )

    clearSession()
    setUser(null)
  }

  useEffect(() => {
    if (!user) return

    const stopMonitor = startSessionMonitor({
      onLogout: logout
    })

    return stopMonitor
  }, [user])

  if (checkingSession) {
    return null
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <DashboardV2
      user={user}
      onLogout={logout}
    />
  )
}
