import { useEffect, useState } from 'react'

import Login from './pages/Login'
import DashboardV2 from './pages/DashboardV2'

import {
  loadSession,
  clearSession,
  startSessionMonitor
} from './services/authService'

import { registerAudit } from './services/auditoriaService'

export default function App() {
  const [user, setUser] = useState(loadSession)

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