import { useState } from 'react'
import { alterarPin } from '../../services/credenciaisService'

export default function SenhaObrigatoriaModal({
  open,
  user,
  onConcluido
}) {

  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) {
    return null
  }

  async function salvar() {

    setErro('')

    if (pin1.length !== 6) {
      setErro('PIN deve possuir 6 dígitos.')
      return
    }

    if (pin1 !== pin2) {
      setErro('Os PINs não conferem.')
      return
    }

    try {

      setLoading(true)

      await alterarPin(
        user.user_id,
        pin1
      )

      onConcluido()

    } catch {

      setErro(
        'Erro ao alterar PIN.'
      )

    } finally {

      setLoading(false)

    }

  }

  return (

    <div className="solicitacao-modal-overlay">

      <div className="solicitacao-modal">

        <div className="solicitacao-modal-header">

          <div>

            <span>

              PRIMEIRO ACESSO

            </span>

            <h2>

              Alteração obrigatória do PIN

            </h2>

            <p>

              Defina um novo PIN de acesso.

            </p>

          </div>

        </div>

        <div
          style={{
            padding:24,
            display:'grid',
            gap:14
          }}
        >

          <input
            type="password"
            maxLength={6}
            value={pin1}
            onChange={(e)=>
              setPin1(
                e.target.value.replace(/\D/g,'')
              )
            }
            placeholder="Novo PIN"
          />

          <input
            type="password"
            maxLength={6}
            value={pin2}
            onChange={(e)=>
              setPin2(
                e.target.value.replace(/\D/g,'')
              )
            }
            placeholder="Confirmar PIN"
          />

          {erro && (

            <div className="error">

              {erro}

            </div>

          )}

        </div>

        <div className="solicitacao-modal-actions">

          <button
            className="solicitacao-btn-aprovar"
            disabled={loading}
            onClick={salvar}
          >

            {loading
              ? 'Salvando...'
              : 'Salvar PIN'}

          </button>

        </div>

      </div>

    </div>

  )

}