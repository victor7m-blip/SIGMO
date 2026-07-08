import { useState } from 'react'

import painelOperacional from '../assets/painel-operacional.png'
import painelOperacionalMobile from '../assets/painel-operacional-mobile.png'

import AppShell from '../components/AppShell/AppShell'
import Locais from './Locais/Locais'
import Materiais from './Materiais/Materiais'
import Armas from './Armas/Armas'
import Policiais from './Policiais'
import Municoes from './Municoes/Municoes'

import './DashboardV2.css'

export default function DashboardV2({ user, onLogout }) {
  const [route, setRoute] = useState('dashboard')

  function renderPage() {
    if (route === 'locais') return <Locais user={user} />
    if (route === 'materiais') return <Materiais user={user} />
    if (route === 'armas') return <Armas user={user} />
    if (route === 'policiais') return <Policiais user={user} />
    if (route === 'municoes') return <Municoes user={user} />

    return (
      <main className="sigmo-dashboard-v2">
        <img
          src={painelOperacional}
          alt="Painel Operacional SIGMO"
          className="sigmo-mockup-image sigmo-desktop"
        />

        <img
          src={painelOperacionalMobile}
          alt="Painel Operacional SIGMO Mobile"
          className="sigmo-mockup-image sigmo-mobile"
        />
      </main>
    )
  }

  return (
    <AppShell
      user={user}
      route={route}
      setRoute={setRoute}
      onLogout={onLogout}
    >
      {renderPage()}
    </AppShell>
  )
}