import { useState } from 'react'

import painelOperacional from '../assets/painel-operacional.png'
import painelOperacionalMobile from '../assets/painel-operacional-mobile.png'

import Materiais from './Materiais/Materiais'

import './DashboardV2.css'

export default function DashboardV2({ user, onLogout }) {
  const [route, setRoute] = useState('dashboard')

  if (route === 'materiais') {
    return (
      <Materiais
        user={user}
        onBack={() => setRoute('dashboard')}
      />
    )
  }

  return (
    <main className="sigmo-dashboard-v2">
      <button
        className="sigmo-floating-logout"
        onClick={onLogout}
        title="Sair"
      >
        Sair
      </button>

      <button
        className="sigmo-open-materials"
        onClick={() => setRoute('materiais')}
      >
        Materiais
      </button>

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