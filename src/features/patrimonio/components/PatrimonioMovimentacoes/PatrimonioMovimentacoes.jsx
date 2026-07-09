import { useEffect, useState } from 'react'

import {
  listarHistoricoPatrimonio,
} from '../../../../services/movimentacoesService'

import './PatrimonioMovimentacoes.css'

export default function PatrimonioMovimentacoes({ item }) {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregar()
  }, [item?.id])

  async function carregar() {
    if (!item?.id) {
      setHistorico([])
      return
    }

    try {
      setLoading(true)
      setErro('')

      const dados = await listarHistoricoPatrimonio(item.id)

      setHistorico(Array.isArray(dados) ? dados : [])
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar movimentações.')
      setHistorico([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="patrimonio-section">
      <header className="patrimonio-section-header">
        <div>
          <h3>Movimentações</h3>
          <p>Histórico completo deste patrimônio.</p>
        </div>
      </header>

      {loading && (
        <div className="patrimonio-mov-loading">
          Carregando...
        </div>
      )}

      {!loading && erro && (
        <div className="patrimonio-mov-empty">
          {erro}
        </div>
      )}

      {!loading && !erro && historico.length === 0 && (
        <div className="patrimonio-mov-empty">
          Nenhuma movimentação encontrada.
        </div>
      )}

      {!loading && !erro && historico.length > 0 && (
        <div className="patrimonio-mov-list">
          {historico.map((mov) => (
            <article key={mov.id} className="patrimonio-mov-card">
              <header>
                <strong>{mov.tipo_movimentacao || mov.tipo || 'Movimentação'}</strong>

                <span>
                  {mov.created_at
                    ? new Date(mov.created_at).toLocaleString('pt-BR')
                    : '-'}
                </span>
              </header>

              <div className="patrimonio-mov-grid">
                <div>
                  <small>Origem</small>
                  <strong>{mov.origem_local || '-'}</strong>
                </div>

                <div>
                  <small>Destino</small>
                  <strong>{mov.destino_local || '-'}</strong>
                </div>

                <div>
                  <small>Status</small>
                  <strong>{mov.status || '-'}</strong>
                </div>

                <div>
                  <small>Solicitante</small>
                  <strong>{mov.solicitante_nome || '-'}</strong>
                </div>

                <div>
                  <small>Recebedor</small>
                  <strong>{mov.recebedor_nome || '-'}</strong>
                </div>
              </div>

              {mov.observacoes && (
                <footer>
                  {mov.observacoes}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}