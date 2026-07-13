import { useState } from 'react'
import { buscarResponsabilidadePolicial } from '../../../services/CentralOperacionalEngine'
import StatusOperacionalBadge from './StatusOperacionalBadge'

export default function ResponsabilidadePolicial({
  aberto,
  onFechar,
  termoInicial = ''
}) {
  const [termo, setTermo] = useState(termoInicial)
  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  if (!aberto) {
    return null
  }

  async function pesquisar(event) {
    event?.preventDefault()

    const busca = termo.trim()

    if (!busca) {
      setErro('Digite o RE ou o nome do policial.')
      return
    }

    try {
      setCarregando(true)
      setErro('')

      const dados = await buscarResponsabilidadePolicial(busca)

      setResultado(dados)
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível consultar a responsabilidade patrimonial.'
      )
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div
      className="central-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onFechar?.()
        }
      }}
    >
      <div
        className="central-modal central-modal-large"
        role="dialog"
        aria-modal="true"
        aria-label="Responsabilidade patrimonial por policial"
      >
        <header className="central-modal-header">
          <div>
            <span className="central-section-eyebrow">
              Consulta unificada
            </span>

            <h2>Responsabilidade patrimonial</h2>

            <p>Consulte todos os patrimônios vinculados ao policial.</p>
          </div>

          <button
            type="button"
            className="central-modal-close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="central-modal-body">
          <form className="central-search-form" onSubmit={pesquisar}>
            <label>
              RE ou nome
              <input
                type="text"
                value={termo}
                onChange={(event) =>
                  setTermo(event.target.value.toUpperCase())
                }
                placeholder="DIGITE O RE OU NOME"
                autoFocus
              />
            </label>

            <button
              type="submit"
              className="central-button central-button-primary"
              disabled={carregando}
            >
              {carregando ? 'Consultando...' : 'Consultar'}
            </button>
          </form>

          {erro && <div className="central-alert central-alert-error">{erro}</div>}

          {resultado && !resultado.policial && (
            <div className="central-empty">
              Nenhum patrimônio vinculado ao policial pesquisado.
            </div>
          )}

          {resultado?.policial && (
            <>
              <div className="central-policial-header">
                <div>
                  <span>Policial responsável</span>

                  <h3>
                    {resultado.policial.nome || 'NOME NÃO IDENTIFICADO'}
                  </h3>

                  <p>RE {resultado.policial.re || 'NÃO INFORMADO'}</p>
                </div>

                <strong>{resultado.total} patrimônios</strong>
              </div>

              <div className="central-table-wrapper">
                <table className="central-table">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Patrimônio</th>
                      <th>Status</th>
                      <th>Local</th>
                    </tr>
                  </thead>

                  <tbody>
                    {resultado.patrimonios.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Categoria">{item.categoria}</td>

                        <td data-label="Patrimônio">
                          <strong>{item.identificador}</strong>
                        </td>

                        <td data-label="Status">
                          <StatusOperacionalBadge
                            status={
                              item.com_policial
                                ? 'COM POLICIAL'
                                : item.no_cofre
                                  ? 'NO COFRE'
                                  : item.status
                            }
                          />
                        </td>

                        <td data-label="Local">
                          {item.local_atual || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}