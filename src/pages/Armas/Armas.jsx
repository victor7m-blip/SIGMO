import { useEffect, useMemo, useState } from 'react'
import SigmoPage from '../../ui/layout/SigmoPage'
import SigmoButton from '../../ui/components/SigmoButton'
import PatrimonioToolbar from '../../components/Patrimonio/PatrimonioToolbar'
import PatrimonioList from '../../components/Patrimonio/PatrimonioList'
import ArmaForm from './components/ArmaForm'
import ArmaViewModal from './components/ArmaViewModal'
import { listarArmas, excluirArma } from '../../services/armasService'
import { listarFotosArma } from '../../services/armasFotosService'
import './Armas.css'

export default function Armas({ user }) {
  const [armas, setArmas] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [armaEditando, setArmaEditando] = useState(null)
  const [armaVisualizando, setArmaVisualizando] = useState(null)
  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    carregarArmas()
  }, [reloadKey])

  async function carregarArmas() {
    setLoading(true)
    setErro('')

    try {
      const resultado = await listarArmas({
        pagina: 1,
        limite: 500,
        sortBy: 'created_at',
        sortDirection: 'desc'
      })

      setArmas(resultado?.data || [])
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao carregar armas.')
    } finally {
      setLoading(false)
    }
  }

  const armasFiltradas = useMemo(() => {
    const termo = busca.trim().toUpperCase()

    if (!termo) return armas

    return armas.filter((arma) => {
      const texto = [
        arma.patrimonio,
        arma.numero_serie,
        arma.qr_code,
        arma.especie,
        arma.marca,
        arma.modelo,
        arma.calibre,
        arma.status,
        arma.status_operacional,
        arma.unidade,
        arma.local_atual
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase()

      return texto.includes(termo)
    })
  }, [armas, busca])

  function handleNovaArma() {
    setArmaEditando(null)
    setShowForm(true)
  }

  async function handleAbrirArma(arma) {
    setArmaVisualizando(arma)
    setFotosVisualizacao([])

    try {
      const fotos = await listarFotosArma(arma.id)
      setFotosVisualizacao(fotos || [])
    } catch (error) {
      console.error(error)
      setFotosVisualizacao([])
    }
  }

  function handleEditar(arma) {
    setArmaEditando(arma)
    setArmaVisualizando(null)
    setFotosVisualizacao([])
    setShowForm(true)
  }

  async function handleExcluir(arma) {
    const confirmar = window.confirm(
      `Deseja realmente excluir a arma ${arma.patrimonio || arma.numero_serie}?`
    )

    if (!confirmar) return

    try {
      await excluirArma(arma.id, user)
      setArmaVisualizando(null)
      setFotosVisualizacao([])
      setReloadKey((prev) => prev + 1)
    } catch (error) {
      console.error(error)
      alert(error.message || 'Erro ao excluir arma.')
    }
  }

  function handleSaved() {
    setShowForm(false)
    setArmaEditando(null)
    setReloadKey((prev) => prev + 1)
  }

  function handleCancelForm() {
    setShowForm(false)
    setArmaEditando(null)
  }

  return (
    <SigmoPage
      title="Armas"
      subtitle="Controle patrimonial, fotos, QR Code e dados operacionais."
      actions={
        <SigmoButton onClick={handleNovaArma}>
          Nova arma
        </SigmoButton>
      }
      className="armas-page"
    >
      {showForm && (
        <ArmaForm
          user={user}
          armaEditando={armaEditando}
          onCancel={handleCancelForm}
          onSaved={handleSaved}
        />
      )}

      {!showForm && (
        <>
          <PatrimonioToolbar
            busca={busca}
            onBuscaChange={setBusca}
            onNovo={handleNovaArma}
            placeholder="Buscar por patrimônio, série, QR Code, espécie, marca, modelo, calibre..."
          />

          {erro && <div className="armas-alert error">{erro}</div>}

          {loading ? (
            <div className="armas-alert">Carregando armas...</div>
          ) : (
            <PatrimonioList
              itens={armasFiltradas}
              getTitulo={(arma) =>
                `${arma.patrimonio || 'SEM PATRIMÔNIO'} — ${arma.especie || 'ARMA'}`
              }
              getSubtitulo={(arma) =>
                [
                  arma.marca,
                  arma.modelo,
                  arma.calibre,
                  arma.numero_serie ? `SÉRIE: ${arma.numero_serie}` : null,
                  arma.qr_code ? `QR: ${arma.qr_code}` : null,
                  arma.unidade,
                  arma.local_atual
                ]
                  .filter(Boolean)
                  .join(' • ')
              }
              getStatus={(arma) => arma.status_operacional || arma.status}
              onAbrir={handleAbrirArma}
              emptyTitle="Nenhuma arma encontrada"
              emptyText="Cadastre uma nova arma ou ajuste o termo de busca."
            />
          )}
        </>
      )}

      {armaVisualizando && (
        <ArmaViewModal
          arma={armaVisualizando}
          fotos={fotosVisualizacao}
          onClose={() => {
            setArmaVisualizando(null)
            setFotosVisualizacao([])
          }}
          onEdit={() => handleEditar(armaVisualizando)}
          onDelete={() => handleExcluir(armaVisualizando)}
        />
      )}
    </SigmoPage>
  )
}