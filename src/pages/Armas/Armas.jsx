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

const CAMPOS_BUSCA = [
  'patrimonio',
  'numero_serie',
  'qr_code',
  'especie',
  'marca',
  'modelo',
  'calibre',
  'status',
  'status_operacional',
  'unidade',
  'local_atual'
]

export default function Armas({ user }) {
  const [armas, setArmas] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modoFormulario, setModoFormulario] = useState(false)
  const [armaSelecionada, setArmaSelecionada] = useState(null)
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
      const texto = CAMPOS_BUSCA
        .map((campo) => arma?.[campo])
        .filter(Boolean)
        .join(' ')
        .toUpperCase()

      return texto.includes(termo)
    })
  }, [armas, busca])

  function abrirNovoCadastro() {
    setArmaSelecionada(null)
    setArmaVisualizando(null)
    setFotosVisualizacao([])
    setModoFormulario(true)
  }

  function fecharFormulario() {
    setModoFormulario(false)
    setArmaSelecionada(null)
  }

  function finalizarFormulario() {
    fecharFormulario()
    recarregar()
  }

  function recarregar() {
    setReloadKey((prev) => prev + 1)
  }

  async function abrirVisualizacao(arma) {
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

  function fecharVisualizacao() {
    setArmaVisualizando(null)
    setFotosVisualizacao([])
  }

  function editarArma(arma) {
    setArmaSelecionada(arma)
    fecharVisualizacao()
    setModoFormulario(true)
  }

  async function excluirArmaSelecionada(arma) {
    const identificacao = arma.patrimonio || arma.numero_serie || 'selecionada'

    const confirmar = window.confirm(
      `Deseja realmente excluir a arma ${identificacao}?`
    )

    if (!confirmar) return

    try {
      await excluirArma(arma.id, user)
      fecharVisualizacao()
      recarregar()
    } catch (error) {
      console.error(error)
      alert(error.message || 'Erro ao excluir arma.')
    }
  }

  return (
    <SigmoPage
      title="Armas"
      subtitle="Controle patrimonial, fotos, QR Code e dados operacionais."
      actions={
        !modoFormulario && (
          <SigmoButton onClick={abrirNovoCadastro}>
            Nova arma
          </SigmoButton>
        )
      }
      className="armas-page"
    >
      {modoFormulario ? (
        <ArmaForm
          user={user}
          armaEditando={armaSelecionada}
          onCancel={fecharFormulario}
          onSaved={finalizarFormulario}
        />
      ) : (
        <>
          <PatrimonioToolbar
            busca={busca}
            onBuscaChange={setBusca}
            onNovo={abrirNovoCadastro}
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
              onAbrir={abrirVisualizacao}
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
          onClose={fecharVisualizacao}
          onEdit={() => editarArma(armaVisualizando)}
          onDelete={() => excluirArmaSelecionada(armaVisualizando)}
        />
      )}
    </SigmoPage>
  )
}