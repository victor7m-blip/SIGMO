import { useState } from 'react'
import Layout from './components/layout/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import Auditoria from './pages/Auditoria'
import Placeholder from './pages/Placeholder'

import { loadSession, clearSession } from './services/auth'
import { registerAudit } from './services/audit'

export default function App() {
  const [user, setUser] = useState(loadSession)
  const [route, setRoute] = useState('dashboard')

  function logout() {
    registerAudit('LOGOUT', 'Usuário saiu do SIGMO.', user, 'Login')
    clearSession()
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  let page = <Dashboard />

  if (route === 'usuarios') page = <Usuarios user={user} />
  if (route === 'auditoria') page = <Auditoria />
  if (route === 'materiais') page = <Placeholder title="Cadastro de Materiais" />
  if (route === 'entrega') page = <Placeholder title="Entrega de Material" />
  if (route === 'relatorios') page = <Placeholder title="Relatórios" />

  return (
    <Layout user={user} route={route} setRoute={setRoute} onLogout={logout}>
      {page}
    </Layout>
  )
}