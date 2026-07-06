import { useState } from 'react'
import { excluirArma } from '../../../services/armasService'
import { registerAudit } from '../../../services/auditoriaService'
import ConfirmModal from '../../../components/ConfirmModal'

const colunasOrdenaveis = [
  { campo: 'patrimonio', label: 'Patrimônio' },
  { campo: 'especie', label: 'Espécie' },
  { campo: 'marca', label: 'Marca' },
  { campo: 'modelo', label: 'Modelo' },
  { campo: 'calibre', label: 'Calibre' },
  { campo: 'numero_serie', label: 'Série' },
  { campo: 'status', label: 'Status' },
  { campo: 'unidade', label: 'Unidade' }
]

export default function ArmaTable({
  user,
  armas,
  loading,
  erro,
  sortBy,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDeleted
}) {
  const [armaParaExcluir, setArmaParaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [mostrarQrCode, setMostrarQrCode] = useState(false)

  function renderSortIcon(campo) {
    if (sortBy !== campo) return '↕'
    return sortDirection === 'asc' ? '▲' : '▼'
  }

  async function confirmarExclusao() {
    if (!armaParaExcluir) return

    try {
      setExcluindo(true)

      await excluirArma(armaParaExcluir.id)

      await registerAudit(
        'DELETE',
        `Arma excluída: patrimônio ${armaParaExcluir.patrimonio || 'não informado'}, série ${armaParaExcluir.numero_serie || 'não informada'}.`,
        user,
        'Armas',
        'Crítico'
      )

      onDeleted(armaParaExcluir.id)
      setArmaParaExcluir(null)
    } catch (error) {
      console.error(error)
      alert(JSON.stringify(error, null, 2))
    } finally {
      setExcluindo(false)
    }
  }

  if (loading) {
    return <p className="armas-feedback">Carregando armas...</p>
  }

  if (erro) {
    return <p className="armas-feedback armas-feedback-error">{erro}</p>
  }

  return (
    <>
      <div className="armas-table-toolbar">
        <span>
          {armas.length} {armas.length === 1 ? 'arma encontrada' : 'armas encontradas'}
        </span>

        <label className="armas-table-toggle">
          <input
            type="checkbox"
            checked={mostrarQrCode}
            onChange={(event) => setMostrarQrCode(event.target.checked)}
          />
          Exibir QR Code
        </label>
      </div>

      <div className="armas-table-wrap">
        <table className="armas-table">
          <thead>
            <tr>
              <th>Foto</th>

              {colunasOrdenaveis.map((coluna) => (
                <th key={coluna.campo}>
                  <button
                    type="button"
                    className="armas-sort-button"
                    onClick={() => onSort(coluna.campo)}
                  >
                    <span>{coluna.label}</span>
                    <small>{renderSortIcon(coluna.campo)}</small>
                  </button>
                </th>
              ))}

              {mostrarQrCode && <th>QR Code</th>}

              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {armas.length === 0 ? (
              <tr>
                <td colSpan={mostrarQrCode ? 11 : 10}>
                  Nenhuma arma encontrada.
                </td>
              </tr>
            ) : (
              armas.map((arma) => (
                <tr key={arma.id}>
                  <td data-label="Foto">
                    <div className="arma-table-foto">
                      {arma.foto_url ? (
                        <img
                          src={arma.foto_url}
                          alt={`Foto da arma ${arma.patrimonio || ''}`}
                          loading="lazy"
                        />
                      ) : (
                        <span>🔫</span>
                      )}
                    </div>
                  </td>

                  <td data-label="Patrimônio">{arma.patrimonio || '-'}</td>
                  <td data-label="Espécie">{arma.especie || '-'}</td>
                  <td data-label="Marca">{arma.marca || '-'}</td>
                  <td data-label="Modelo">{arma.modelo || '-'}</td>
                  <td data-label="Calibre">{arma.calibre || '-'}</td>
                  <td data-label="Série">{arma.numero_serie || '-'}</td>

                  <td data-label="Status">
                    <span className="armas-status">{arma.status || '-'}</span>
                  </td>

                  <td data-label="Unidade">{arma.unidade || '-'}</td>

                  {mostrarQrCode && (
                    <td data-label="QR Code">
                      <span className="armas-qr-code-text">
                        {arma.qr_code || '-'}
                      </span>
                    </td>
                  )}

                  <td data-label="Ações">
                    <div className="armas-actions">
                      <button type="button" onClick={() => onView(arma)}>
                        Ver
                      </button>

                      <button type="button" onClick={() => onEdit(arma)}>
                        Editar
                      </button>

                      <button
                        type="button"
                        className="armas-delete-button"
                        onClick={() => setArmaParaExcluir(arma)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!armaParaExcluir}
        title="Excluir arma"
        message={`Deseja realmente excluir a arma de patrimônio ${armaParaExcluir?.patrimonio || 'não informado'}? Essa ação não poderá ser desfeita.`}
        confirmText={excluindo ? 'Excluindo...' : 'Excluir'}
        cancelText="Cancelar"
        danger
        onClose={() => setArmaParaExcluir(null)}
        onConfirm={confirmarExclusao}
      />
    </>
  )
}