import { useState } from 'react'

import CautelasUsuario from '../CautelasUsuario/CautelasUsuario'
import ReceberMaterial from './ReceberMaterial'

import './ReceberMaterialHibrido.css'

export default function ReceberMaterialHibrido({
  user,
  onVoltar = null,
  onConcluido = null
}) {
  const [aba, setAba] = useState('pessoal')

  return (
    <div className="receber-hibrido">
      <section className="receber-hibrido-seletor">
        <div>
          <span className="receber-hibrido-eyebrow">Receber material</span>
          <h2>Escolha o tipo de recebimento</h2>
          <p>
            Perfis operacionais também podem possuir cautelas destinadas
            pessoalmente ao seu RE.
          </p>
        </div>

        <div className="receber-hibrido-abas">
          <button
            type="button"
            className={aba === 'pessoal' ? 'ativo' : ''}
            onClick={() => setAba('pessoal')}
          >
            Materiais destinados a você
          </button>

          <button
            type="button"
            className={aba === 'operacional' ? 'ativo' : ''}
            onClick={() => setAba('operacional')}
          >
            Recebimentos operacionais
          </button>
        </div>
      </section>

      {aba === 'pessoal' ? (
        <CautelasUsuario
          user={user}
          modo="receber"
          onConcluido={onConcluido}
        />
      ) : (
        <ReceberMaterial
          user={user}
          onVoltar={onVoltar}
          onConcluido={onConcluido}
        />
      )}
    </div>
  )
}
