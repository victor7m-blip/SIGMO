import { useEffect, useState } from 'react'
import { listarArmas, excluirArma } from '../../../services/armasService'
import { registerAudit } from '../../../services/auditoriaService'
import ConfirmModal from '../../../components/ConfirmModal'

export default function ArmaTable({ user, reloadKey, onView, onEdit }) {
  const [armas, setArmas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [armaParaExcluir, setArmaParaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  async function carregarArmas() {
    try {
      setLoading(true)
      setErro('')

      const data = await listarArmas()
      setArmas(data || [])
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar armas.')
    } finally {
      setLoading(false)
    }
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

      setArmas((listaAtual) =>
        listaAtual.filter((arma) => arma.id !== armaParaExcluir.id)
      )

      setArmaParaExcluir(null)
    } catch (error) {
      console.error(error)
      alert(JSON.stringify(error, null, 2))
    } finally {
      setExcluindo(false)
    }
  }

  useEffect(() => {
    carregarArmas()
  }, [reloadKey])

  if (loading) {
    return <p className="armas-feedback">Carregando armas...</p>
  }

  if (erro) {
    return <p className="armas-feedback armas-feedback-error">{erro}</p>
  }

  return (
    <>
      <div className="armas-table-wrap">
        <table className="armas-table">
          <thead>
            <tr>
              <th>Patrimônio</th>
              <th>Espécie</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Calibre</th>
              <th>Série</th>
              <th>Status</th>
              <th>Unidade</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {armas.length === 0 ? (
              <tr>
                <td colSpan="9">Nenhuma arma cadastrada.</td>
              </tr>
            ) : (
              armas.map((arma) => (
                <tr key={arma.id}>
                  <td>{arma.patrimonio}</td>
                  <td>{arma.especie}</td>
                  <td>{arma.marca}</td>
                  <td>{arma.modelo}</td>
                  <td>{arma.calibre}</td>
                  <td>{arma.numero_serie}</td>
                  <td>
                    <span className="armas-status">
                      {arma.status}
                    </span>
                  </td>
                  <td>{arma.unidade || '-'}</td>
                  <td>
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