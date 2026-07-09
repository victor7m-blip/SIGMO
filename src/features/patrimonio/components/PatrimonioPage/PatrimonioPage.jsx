import { useEffect, useMemo, useState } from 'react'

import { listarPatrimoniosEngine } from '../../../../services/patrimonioEngineService'

import PatrimonioToolbar from '../PatrimonioToolbar/PatrimonioToolbar'
import PatrimonioLista from '../PatrimonioLista/PatrimonioLista'
import PatrimonioDetails from '../PatrimonioDetails/PatrimonioDetails'
import PatrimonioFotos from '../PatrimonioFotos/PatrimonioFotos'
import PatrimonioQRCode from '../PatrimonioQRCode/PatrimonioQRCode'
import PatrimonioMovimentacoes from '../PatrimonioMovimentacoes/PatrimonioMovimentacoes'

import './PatrimonioPage.css'

export default function PatrimonioPage({ config }) {
  const {
    titulo = 'Motor Patrimonial',
    subtitulo = 'Gestão patrimonial integrada',
    modulo = 'patrimonio',
  } = config || {}

  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [statusAtivo, setStatusAtivo] = useState('todos')
  const [itemSelecionado, setItemSelecionado] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('dados')

  useEffect(() => {
    carregarItens()
  }, [config])

  async function carregarItens() {
    try {
      setCarregando(true)
      setErro('')

      const dados = await listarPatrimoniosEngine(config)

      setItens(Array.isArray(dados) ? dados : [])
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar dados patrimoniais.')
      setItens([])
    } finally {
      setCarregando(false)
    }
  }

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return itens.filter((item) => {
      const status = String(item.status || item.status_operacional || '').toLowerCase()

      const passaStatus =
        statusAtivo === 'todos' || status === statusAtivo.toLowerCase()

      if (!passaStatus) return false
      if (!termo) return true

      return JSON.stringify(item).toLowerCase().includes(termo)
    })
  }, [busca, statusAtivo, itens])

  function renderConteudo() {
    if (!itemSelecionado) {
      return (
        <div className="patrimonio-dados">
          <h3>Dados principais</h3>
          <p>Selecione um item para visualizar os dados completos.</p>
        </div>
      )
    }

    if (abaAtiva === 'fotos') {
      return (
        <PatrimonioFotos
          config={config}
          item={itemSelecionado}
        />
      )
    }

    if (abaAtiva === 'qrcode') {
      return (
        <PatrimonioQRCode
          config={config}
          item={itemSelecionado}
        />
      )
    }

    if (abaAtiva === 'movimentacoes') {
      return (
        <PatrimonioMovimentacoes
          config={config}
          item={itemSelecionado}
        />
      )
    }

    return (
      <div className="patrimonio-dados">
        <h3>Dados principais</h3>

        <div className="patrimonio-dados-grid">
          {Object.entries(itemSelecionado).map(([chave, valor]) => {
            if (['fotos', 'qrCode', 'movimentacoes'].includes(chave)) {
              return null
            }

            return (
              <div key={chave} className="patrimonio-dado-item">
                <span>{chave}</span>
                <strong>{String(valor || '-')}</strong>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <main className="patrimonio-page" data-modulo={modulo}>
      <section className="patrimonio-shell">
        <header className="patrimonio-header">
          <div>
            <span className="patrimonio-eyebrow">SIGMO Patrimônio</span>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
          </div>
        </header>

        {erro && <div className="patrimonio-alert">{erro}</div>}

        <PatrimonioToolbar
          busca={busca}
          onBuscaChange={setBusca}
          statusAtivo={statusAtivo}
          onStatusChange={setStatusAtivo}
        />

        {carregando ? (
          <div className="patrimonio-loading">Carregando dados...</div>
        ) : (
          <section className="patrimonio-grid">
            <PatrimonioLista
              itens={itensFiltrados}
              itemSelecionado={itemSelecionado}
              onSelect={setItemSelecionado}
            />

            <PatrimonioDetails
              item={itemSelecionado}
              abaAtiva={abaAtiva}
              onAbaChange={setAbaAtiva}
            >
              {renderConteudo()}
            </PatrimonioDetails>
          </section>
        )}
      </section>
    </main>
  )
}