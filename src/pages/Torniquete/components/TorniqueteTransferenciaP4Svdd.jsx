import {
  useState
} from 'react'

import {
  transferirTorniqueteParaSvdd
} from '../../../services/torniquetesService'

export default function TorniqueteTransferenciaP4Svdd({
  saldoP4 = 0,
  onConcluido
}) {
  const [
    aberto,
    setAberto
  ] = useState(false)

  const [
    quantidade,
    setQuantidade
  ] = useState(1)

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const saldo =
    Math.max(
      0,
      Number(saldoP4) || 0
    )

  function fechar() {
    if (salvando) return

    setAberto(false)
    setQuantidade(1)
    setErro('')
  }

  async function confirmar() {
    const qtd =
      Number(quantidade)

    if (
      !Number.isInteger(qtd) ||
      qtd <= 0
    ) {
      setErro(
        'Informe uma quantidade inteira maior que zero.'
      )
      return
    }

    if (qtd > saldo) {
      setErro(
        `Saldo insuficiente no Cofre do P4. Disponível: ${saldo}.`
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await transferirTorniqueteParaSvdd({
        quantidade: qtd
      })

      setAberto(false)
      setQuantidade(1)

      await onConcluido?.(
        `Transferência concluída: ${qtd} torniquete(s) do P4 para o SVDD.`
      )
    } catch (error) {
      console.error(
        'Erro ao transferir torniquete para o SVDD:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível concluir a transferência.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <section className="coletes-operation-group">
        <div className="coletes-operation-group-header">
          <span className="coletes-operation-group-icon">
            ↔
          </span>

          <div>
            <h3>
              Transferência P4 → SVDD
            </h3>

            <p>
              Envie torniquetes do Cofre do P4 para o Cofre do SVDD por quantidade.
            </p>
          </div>
        </div>

        <div className="coletes-operation-actions">
          <button
            type="button"
            onClick={() => {
              setErro('')
              setQuantidade(1)
              setAberto(true)
            }}
            disabled={saldo <= 0}
          >
            <strong>
              Transferir para SVDD
            </strong>

            <span>
              {saldo > 0
                ? `${saldo} disponível(is) no P4`
                : 'Sem saldo disponível no P4'}
            </span>
          </button>
        </div>
      </section>

      {aberto && (
        <div
          role="presentation"
          onClick={fechar}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10020,
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background:
              'rgba(3, 15, 32, .72)'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Transferir torniquetes do P4 para o SVDD"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                'min(520px, 100%)',
              borderRadius: '20px',
              border:
                '1px solid rgba(30, 92, 153, .28)',
              background: '#ffffff',
              boxShadow:
                '0 28px 70px rgba(0, 0, 0, .30)',
              overflow: 'hidden'
            }}
          >
            <header
              style={{
                padding: '22px 24px',
                color: '#ffffff',
                background:
                  'linear-gradient(135deg, #071d39 0%, #0b315a 100%)'
              }}
            >
              <span
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  color: '#8fc8ff',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '.1em'
                }}
              >
                TRANSFERÊNCIA DE ESTOQUE
              </span>

              <h2
                style={{
                  margin: 0,
                  fontSize: '22px'
                }}
              >
                P4 → SVDD
              </h2>

              <p
                style={{
                  margin: '7px 0 0',
                  opacity: .88,
                  lineHeight: 1.45
                }}
              >
                Informe somente a quantidade de torniquetes.
              </p>
            </header>

            <div
              style={{
                display: 'grid',
                gap: '16px',
                padding: '22px 24px'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '12px'
                }}
              >
                <label>
                  <span
                    style={{
                      display: 'block',
                      marginBottom: '7px',
                      color: '#344054',
                      fontSize: '12px',
                      fontWeight: 850,
                      textTransform:
                        'uppercase'
                    }}
                  >
                    Quantidade
                  </span>

                  <input
                    type="number"
                    min="1"
                    max={saldo}
                    step="1"
                    value={quantidade}
                    onChange={(event) => {
                      setQuantidade(
                        event.target.value
                      )
                      setErro('')
                    }}
                    disabled={salvando}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      boxSizing:
                        'border-box',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '0 12px',
                      font: 'inherit',
                      fontWeight: 750
                    }}
                  />
                </label>

                <div>
                  <span
                    style={{
                      display: 'block',
                      marginBottom: '7px',
                      color: '#344054',
                      fontSize: '12px',
                      fontWeight: 850,
                      textTransform:
                        'uppercase'
                    }}
                  >
                    Disponível no P4
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: '44px',
                      boxSizing:
                        'border-box',
                      border:
                        '1px solid #d8e1ec',
                      borderRadius: '10px',
                      padding: '0 12px',
                      background: '#f8fafc',
                      color: '#0b315a',
                      fontWeight: 900
                    }}
                  >
                    {saldo}
                  </div>
                </div>
              </div>

              {erro && (
                <div
                  style={{
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border:
                      '1px solid #efb4b4',
                    background: '#fff1f1',
                    color: '#9f1c1c',
                    fontWeight: 750
                  }}
                >
                  {erro}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'flex-end',
                  gap: '10px'
                }}
              >
                <button
                  type="button"
                  className="coletes-btn-secondary"
                  onClick={fechar}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="coletes-btn-primary"
                  onClick={confirmar}
                  disabled={
                    salvando ||
                    saldo <= 0
                  }
                >
                  {salvando
                    ? 'Transferindo...'
                    : 'Confirmar transferência'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
