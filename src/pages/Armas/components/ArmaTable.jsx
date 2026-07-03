import { useEffect, useState } from 'react'
import { listarArmas } from '../../../services/armasService'

export default function ArmaTable({ reloadKey, onView, onEdit }) {
  const [armas, setArmas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

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
                    <button onClick={() => onView(arma)}>
                      Ver
                    </button>

                    <button onClick={() => onEdit(arma)}>
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}