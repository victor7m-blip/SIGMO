import { useState } from 'react'

import Login from './pages/Login'
import DashboardV2 from './pages/DashboardV2'

import { loadSession, clearSession } from './services/authService'
import { registerAudit } from './services/auditoriaService'

export default function App() {
  const [user, setUser] = useState(loadSession)

  function logout() {
    registerAudit('LOGOUT', 'Usuário saiu do SIGMO.', user, 'Login')
    clearSession()
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return <DashboardV2 user={user} onLogout={logout} />
}