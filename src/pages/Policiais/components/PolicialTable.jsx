import {
  useState
} from 'react'

import {
  excluirPolicial
} from '../../../services/policiaisService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import {
  podeEditarPolicial,
  podeExcluirPolicial,
  podeVisualizarPolicial
} from '../../../services/permissionService'

import ConfirmModal from '../../../components/ConfirmModal'

const colunasOrdenaveis = [
  {
    campo: 'foto_url',
    label: 'Foto'
  },
  {
    campo: 'nome_guerra',
    label: 'Nome de guerra'
  },
  {
    campo: 're',
    label: 'RE'
  },
  {
    campo: 'posto_graduacao',
    label: 'Posto/Graduação'
  },
  {
    campo: 'companhia',
    label: 'Companhia'
  },
  {
    campo: 'pelotao',
    label: 'Pelotão'
  },
  {
    campo: 'equipe',
    label: 'Equipe'
  },
  {
    campo: 'funcao',
    label: 'Função'
  },
  {
    campo: 'situacao',
    label: 'Situação'
  }
]

export default function PolicialTable({
  user,
  policiais,
  loading,
  erro,
  sortBy,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDeleted
}) {
  const [
    policialParaExcluir,
    setPolicialParaExcluir
  ] = useState(null)

  const [
    excluindo,
    setExcluindo
  ] = useState(false)

  const [
    mostrarQrCode,
    setMostrarQrCode
  ] = useState(false)

  function renderSortIcon(campo) {
    if (
      sortBy !== campo
    ) {
      return '↕'
    }

    return sortDirection === 'asc'
      ? '▲'
      : '▼'
  }

  function solicitarExclusao(
    policial
  ) {
    if (
      !podeExcluirPolicial(
        user
      )
    ) {
      return
    }

    setPolicialParaExcluir(
      policial
    )
  }

  async function confirmarExclusao() {
    if (
      !policialParaExcluir ||
      !podeExcluirPolicial(user)
    ) {
      setPolicialParaExcluir(
        null
      )

      return
    }

    try {
      setExcluindo(true)

      await excluirPolicial(
        policialParaExcluir.id
      )

      const policialExcluido =
        policialParaExcluir

      onDeleted?.(
        policialExcluido.id
      )

      setPolicialParaExcluir(
        null
      )

      try {
        await registerAudit(
          'EXCLUIR_POLICIAL',
          `Policial excluído: ${
            policialExcluido.posto_graduacao ||
            ''
          } ${
            policialExcluido.nome_guerra ||
            'não informado'
          } - RE ${
            policialExcluido.re ||
            'não informado'
          }.`,
          user,
          'Policiais',
          'Crítico'
        )
      } catch (auditError) {
        console.error(
          'O policial foi excluído, mas não foi possível registrar a auditoria:',
          auditError
        )
      }
    } catch (error) {
      console.error(error)

      alert(
        error?.message ||
        'Não foi possível excluir o policial.'
      )
    } finally {
      setExcluindo(false)
    }
  }

  if (loading) {
    return (
      <p className="policiais-feedback">
        Carregando policiais...
      </p>
    )
  }

  if (erro) {
    return (
      <p className="policiais-feedback policiais-feedback-error">
        {erro}
      </p>
    )
  }

  return (
    <>
      <div className="policiais-table-toolbar">
        <span>
          {policiais.length}{' '}
          {policiais.length === 1
            ? 'policial encontrado'
            : 'policiais encontrados'}
        </span>

        <label className="policiais-table-toggle">
          <input
            type="checkbox"
            checked={
              mostrarQrCode
            }
            onChange={(event) =>
              setMostrarQrCode(
                event.target.checked
              )
            }
          />

          Exibir QR Code
        </label>
      </div>

      <div className="policiais-table-wrap">
        <table className="policiais-table">
          <thead>
            <tr>
              {colunasOrdenaveis.map(
                (coluna) => (
                  <th
                    key={
                      coluna.campo
                    }
                  >
                    {coluna.campo ===
                    'foto_url' ? (
                      <span>
                        {coluna.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="policiais-sort-button"
                        onClick={() =>
                          onSort(
                            coluna.campo
                          )
                        }
                      >
                        <span>
                          {coluna.label}
                        </span>

                        <small>
                          {renderSortIcon(
                            coluna.campo
                          )}
                        </small>
                      </button>
                    )}
                  </th>
                )
              )}

              {mostrarQrCode && (
                <th>QR Code</th>
              )}

              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {policiais.length ===
            0 ? (
              <tr>
                <td
                  colSpan={
                    mostrarQrCode
                      ? 11
                      : 10
                  }
                >
                  Nenhum policial encontrado.
                </td>
              </tr>
            ) : (
              policiais.map(
                (policial) => {
                  const podeVer =
                    podeVisualizarPolicial(
                      user,
                      policial
                    )

                  const podeEditar =
                    podeEditarPolicial(
                      user,
                      policial
                    )

                  const podeExcluir =
                    podeExcluirPolicial(
                      user
                    )

                  return (
                    <tr
                      key={
                        policial.id
                      }
                    >
                      <td data-label="Foto">
                        <button
                          type="button"
                          className="policial-table-photo-button"
                          onClick={() => {
                            if (
                              podeVer
                            ) {
                              onView(
                                policial
                              )
                            }
                          }}
                          title="Ver policial"
                          disabled={
                            !podeVer
                          }
                        >
                          {policial.foto_url ? (
                            <img
                              src={
                                policial.foto_url
                              }
                              alt={`Foto de ${
                                policial.nome_guerra ||
                                'policial'
                              }`}
                              loading="lazy"
                            />
                          ) : (
                            <span>
                              {(
                                policial.nome_guerra ||
                                policial.nome ||
                                '?'
                              )
                                .slice(
                                  0,
                                  1
                                )
                                .toUpperCase()}
                            </span>
                          )}
                        </button>
                      </td>

                      <td data-label="Nome de guerra">
                        <div>
                          {policial.nome_guerra ||
                            '-'}

                          {(policial.arma_somente_cautela ||
                            policial.arma_sem_cautela) && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                                marginTop: '5px'
                              }}
                            >
                              {policial.arma_somente_cautela && (
                                <small
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    background: '#e8f1ff',
                                    color: '#174ea6',
                                    fontWeight: 700
                                  }}
                                >
                                  Somente cautela
                                </small>
                              )}

                              {policial.arma_sem_cautela && (
                                <small
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    background: '#fff3e0',
                                    color: '#9a4d00',
                                    fontWeight: 700
                                  }}
                                >
                                  Sem cautela de arma
                                </small>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      <td data-label="RE">
                        {policial.re ||
                          '-'}
                      </td>

                      <td data-label="Posto/Graduação">
                        {policial.posto_graduacao ||
                          '-'}
                      </td>

                      <td data-label="Companhia">
                        {policial.companhia ||
                          '-'}
                      </td>

                      <td data-label="Pelotão">
                        {policial.pelotao ||
                          '-'}
                      </td>

                      <td data-label="Equipe">
                        {policial.equipe ||
                          '-'}
                      </td>

                      <td data-label="Função">
                        {policial.funcao ||
                          '-'}
                      </td>

                      <td data-label="Situação">
                        <span className="policiais-status">
                          {policial.situacao ||
                            '-'}
                        </span>
                      </td>

                      {mostrarQrCode && (
                        <td data-label="QR Code">
                          <span className="policiais-qr-code-text">
                            {policial.qr_code ||
                              '-'}
                          </span>
                        </td>
                      )}

                      <td data-label="Ações">
                        <div className="policiais-actions">
                          {podeVer && (
                            <button
                              type="button"
                              onClick={() =>
                                onView(
                                  policial
                                )
                              }
                            >
                              Ver
                            </button>
                          )}

                          {podeEditar && (
                            <button
                              type="button"
                              onClick={() =>
                                onEdit(
                                  policial
                                )
                              }
                            >
                              Editar
                            </button>
                          )}

                          {podeExcluir && (
                            <button
                              type="button"
                              className="policiais-delete-button"
                              onClick={() =>
                                solicitarExclusao(
                                  policial
                                )
                              }
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }
              )
            )}
          </tbody>
        </table>
      </div>

      {podeExcluirPolicial(
        user
      ) && (
        <ConfirmModal
          open={
            !!policialParaExcluir
          }
          title="Excluir policial"
          message={`Deseja realmente excluir o policial ${
            policialParaExcluir?.nome_guerra ||
            'não informado'
          } - RE ${
            policialParaExcluir?.re ||
            'não informado'
          }? Essa ação não poderá ser desfeita.`}
          confirmText={
            excluindo
              ? 'Excluindo...'
              : 'Excluir'
          }
          cancelText="Cancelar"
          danger
          onClose={() =>
            setPolicialParaExcluir(
              null
            )
          }
          onConfirm={
            confirmarExclusao
          }
        />
      )}
    </>
  )
}