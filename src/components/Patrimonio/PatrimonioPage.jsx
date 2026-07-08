import { useEffect, useState } from 'react'
import PatrimonioForm from './PatrimonioForm'
import PatrimonioDetails from './PatrimonioDetails'
import {
  listarPatrimoniosEngine,
  cadastrarPatrimonioEngine,
  atualizarPatrimonioEngine,
  excluirPatrimonioEngine
} from '../../services/patrimonioEngineService'
import './PatrimonioPage.css'

export default function PatrimonioPage({ config }) {
  const [itens, setItens] = useState([])
  const [itemSelecionado, setItemSelecionado] = useState(null)
  const [modo, setModo] = useState('lista')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')
      const data = await listarPatrimoniosEngine(config)
      setItens(data)
    } catch (err) {
      setErro(err.message || 'Erro ao carregar registros.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [config])

  async function salvar(payload) {
    try {
      setErro('')

      if (itemSelecionado?.id) {
        await atualizarPatrimonioEngine(config, itemSelecionado.id, payload)
      } else {
        await cadastrarPatrimonioEngine(config, payload)
      }

      setModo('lista')
      setItemSelecionado(null)
      carregar()
    } catch (err) {
      setErro(err.message || 'Erro ao salvar registro.')
    }
  }

  async function remover(item) {
    if (!confirm('Deseja realmente excluir este registro?')) return

    try {
      await excluirPatrimonioEngine(config, item.id)
      carregar()
    } catch (err) {
      setErro(err.message || 'Erro ao excluir registro.')
    }
  }

  function novo() {
    setItemSelecionado(null)
    setModo('form')
  }

  function editar(item) {
    setItemSelecionado(item)
    setModo('form')
  }

  function detalhes(item) {
    setItemSelecionado(item)
    setModo('detalhes')
  }

  return (
    <main className="patrimonio-page">
      <header className="patrimonio-page-header">
        <div>
          <h1>{config.titulo}</h1>
          {config.subtitulo && <p>{config.subtitulo}</p>}
        </div>

        {modo === 'lista' && (
          <button className="btn-primary" onClick={novo}>
            Novo
          </button>
        )}

        {modo !== 'lista' && (
          <button className="btn-secondary" onClick={() => setModo('lista')}>
            Voltar
          </button>
        )}
      </header>

      {erro && <div className="form-error">{erro}</div>}

      {modo === 'form' && (
        <PatrimonioForm
          config={config}
          item={itemSelecionado}
          onCancel={() => setModo('lista')}
          onSave={salvar}
        />
      )}

      {modo === 'detalhes' && itemSelecionado && (
        <PatrimonioDetails
          config={config}
          item={itemSelecionado}
          onEdit={() => editar(itemSelecionado)}
        />
      )}

      {modo === 'lista' && (
        <section className="patrimonio-list-card">
          {carregando ? (
            <p>Carregando...</p>
          ) : itens.length === 0 ? (
            <p>Nenhum registro encontrado.</p>
          ) : (
            <div className="patrimonio-table-wrap">
              <table className="patrimonio-table">
                <thead>
                  <tr>
                    {config.colunas?.map((coluna) => (
                      <th key={coluna.key}>{coluna.label}</th>
                    ))}
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id}>
                      {config.colunas?.map((coluna) => (
                        <td key={coluna.key}>{item[coluna.key] || '-'}</td>
                      ))}

                      <td className="patrimonio-actions">
                        <button onClick={() => detalhes(item)}>Ver</button>
                        <button onClick={() => editar(item)}>Editar</button>
                        <button onClick={() => remover(item)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}