import { useState } from 'react'
import { excluirPolicial } from '../../../services/policiaisService'
import { registerAudit } from '../../../services/auditoriaService'
import ConfirmModal from '../../../components/ConfirmModal'

const colunasOrdenaveis = [
  { campo: 'nome_guerra', label: 'Nome de guerra' },
  { campo: 're', label: 'RE' },
  { campo: 'posto_graduacao', label: 'Posto/Graduação' },
  { campo: 'companhia', label: 'Companhia' },
  { campo: 'pelotao', label: 'Pelotão' },
  { campo: 'equipe', label: 'Equipe' },
  { campo: 'funcao', label: 'Função' },
  { campo: 'situacao', label: 'Situação' }
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
  const [policialParaExcluir, setPolicialParaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [mostrarQrCode, setMostrarQrCode] = useState(false)

  function renderSortIcon(campo) {
    if (sortBy !== campo) return '↕'
    return sortDirection === 'asc' ? '▲' : '▼'
  }

  async function confirmarExclusao() {
    if (!policialParaExcluir) return

    try {
      setExcluindo(true)

      await excluirPolicial(policialParaExcluir.id)

      await registerAudit(
        'DELETE',
        `Policial excluído: ${policialParaExcluir.posto_graduacao || ''} ${policialParaExcluir.nome_guerra || 'não informado'} - RE ${policialParaExcluir.re || 'não informado'}.`,
        user,
        'Policiais',
        'Crítico'
      )

      onDeleted(policialParaExcluir.id)
      setPolicialParaExcluir(null)
    } catch (error) {
      console.error(error)
      alert(JSON.stringify(error, null, 2))
    } finally {
      setExcluindo(false)
    }
  }

  if (loading) {
    return <p className="policiais-feedback">Carregando policiais...</p>
  }

  if (erro) {
    return <p className="policiais-feedback policiais-feedback-error">{erro}</p>
  }

  return (
    <>
      <div className="policiais-table-toolbar">
        <span>
          {policiais.length} {policiais.length === 1 ? 'policial encontrado' : 'policiais encontrados'}
        </span>

        <label className="policiais-table-toggle">
          <input
            type="checkbox"
            checked={mostrarQrCode}
            onChange={(event) => setMostrarQrCode(event.target.checked)}
          />
          Exibir QR Code
        </label>
      </div>

      <div className="policiais-table-wrap">
        <table className="policiais-table">
          <thead>
            <tr>
              {colunasOrdenaveis.map((coluna) => (
                <th key={coluna.campo}>
                  <button
                    type="button"
                    className="policiais-sort-button"
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
            {policiais.length === 0 ? (
              <tr>
                <td colSpan={mostrarQrCode ? 10 : 9}>
                  Nenhum policial encontrado.
                </td>
              </tr>
            ) : (
              policiais.map((policial) => (
                <tr key={policial.id}>
                  <td data-label="Nome de guerra">{policial.nome_guerra || '-'}</td>
                  <td data-label="RE">{policial.re || '-'}</td>
                  <td data-label="Posto/Graduação">{policial.posto_graduacao || '-'}</td>
                  <td data-label="Companhia">{policial.companhia || '-'}</td>
                  <td data-label="Pelotão">{policial.pelotao || '-'}</td>
                  <td data-label="Equipe">{policial.equipe || '-'}</td>
                  <td data-label="Função">{policial.funcao || '-'}</td>

                  <td data-label="Situação">
                    <span className="policiais-status">{policial.situacao || '-'}</span>
                  </td>

                  {mostrarQrCode && (
                    <td data-label="QR Code">
                      <span className="policiais-qr-code-text">
                        {policial.qr_code || '-'}
                      </span>
                    </td>
                  )}

                  <td data-label="Ações">
                    <div className="policiais-actions">
                      <button type="button" onClick={() => onView(policial)}>
                        Ver
                      </button>

                      <button type="button" onClick={() => onEdit(policial)}>
                        Editar
                      </button>

                      <button
                        type="button"
                        className="policiais-delete-button"
                        onClick={() => setPolicialParaExcluir(policial)}
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
        open={!!policialParaExcluir}
        title="Excluir policial"
        message={`Deseja realmente excluir o policial ${policialParaExcluir?.nome_guerra || 'não informado'} - RE ${policialParaExcluir?.re || 'não informado'}? Essa ação não poderá ser desfeita.`}
        confirmText={excluindo ? 'Excluindo...' : 'Excluir'}
        cancelText="Cancelar"
        danger
        onClose={() => setPolicialParaExcluir(null)}
        onConfirm={confirmarExclusao}
      />
    </>
  )
}