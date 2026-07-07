import { useEffect, useState } from 'react'
import { listarPatrimoniosDisponiveis } from '../../../services/movimentacoesService'

export default function PatrimonioPicker({ origemLocal, onAdicionar }) {
  const [patrimonios, setPatrimonios] = useState([])
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [loading, setLoading] = useState(false)

  async function carregarPatrimonios() {
    try {
      setLoading(true)

      const data = await listarPatrimoniosDisponiveis({
        busca,
        tipo,
        local_atual: origemLocal || undefined
      })

      setPatrimonios(data)
    } catch (error) {
      console.error(error)
      alert('Erro ao buscar patrimônios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPatrimonios()
  }, [origemLocal, tipo])

  return (
    <div className="patrimonio-picker">
      <h3>Adicionar Patrimônio</h3>

      <div className="patrimonio-picker-filtros">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição, patrimônio ou série"
        />

        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="arma">Arma</option>
          <option value="colete">Colete</option>
          <option value="ht">HT</option>
          <option value="tpd">TPD</option>
          <option value="ain">AIN</option>
          <option value="cop">COP</option>
          <option value="municao">Munição</option>
          <option value="outros">Outros</option>
          <option value="viatura">Viatura</option>
        </select>

        <button type="button" onClick={carregarPatrimonios}>
          Buscar
        </button>
      </div>

      <div className="patrimonio-picker-lista">
        {loading && <p>Carregando patrimônios...</p>}

        {!loading && patrimonios.length === 0 && (
          <p>Nenhum patrimônio encontrado para esta origem.</p>
        )}

        {!loading && patrimonios.map((patrimonio) => (
          <div className="patrimonio-picker-item" key={patrimonio.id}>
            <div>
              <strong>{patrimonio.descricao}</strong>
              <span>
                {patrimonio.tipo} — {patrimonio.numero_patrimonio || 'Sem patrimônio'} — {patrimonio.status}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onAdicionar(patrimonio)}
            >
              Adicionar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}