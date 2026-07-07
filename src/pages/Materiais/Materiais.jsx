import { useEffect, useMemo, useState } from 'react'
import SigmoPage from '../../ui/layout/SigmoPage'
import SigmoButton from '../../ui/components/SigmoButton'
import PatrimonioToolbar from '../../components/Patrimonio/PatrimonioToolbar'
import PatrimonioList from '../../components/Patrimonio/PatrimonioList'
import MaterialForm from './components/MaterialForm'
import MaterialViewModal from './components/MaterialViewModal'
import {
  listarMateriais,
  excluirMaterial
} from '../../services/materiaisService'
import './Materiais.css'

const CAMPOS_BUSCA = [
  'patrimonio',
  'descricao',
  'categoria',
  'marca',
  'modelo',
  'numero_serie',
  'status',
  'unidade',
  'local_atual'
]

export default function Materiais({ user }) {
  const [materiais, setMateriais] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modoFormulario, setModoFormulario] = useState(false)
  const [materialSelecionado, setMaterialSelecionado] = useState(null)
  const [materialVisualizando, setMaterialVisualizando] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    carregarMateriais()
  }, [reloadKey])

  async function carregarMateriais() {
    setLoading(true)
    setErro('')

    try {
      const resultado = await listarMateriais({
        pagina: 1,
        limite: 500,
        sortBy: 'created_at',
        sortDirection: 'desc'
      })

      setMateriais(resultado?.data || [])
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao carregar materiais.')
    } finally {
      setLoading(false)
    }
  }

  const materiaisFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase()

    if (!termo) return materiais

    return materiais.filter((material) => {
      const texto = CAMPOS_BUSCA
        .map((campo) => material?.[campo])
        .filter(Boolean)
        .join(' ')
        .toUpperCase()

      return texto.includes(termo)
    })
  }, [materiais, busca])

  function recarregar() {
    setReloadKey((prev) => prev + 1)
  }

  function abrirNovoCadastro() {
    setMaterialSelecionado(null)
    setMaterialVisualizando(null)
    setModoFormulario(true)
  }

  function fecharFormulario() {
    setModoFormulario(false)
    setMaterialSelecionado(null)
  }

  function finalizarFormulario() {
    fecharFormulario()
    recarregar()
  }

  function abrirVisualizacao(material) {
    setMaterialVisualizando(material)
  }

  function fecharVisualizacao() {
    setMaterialVisualizando(null)
  }

  function editarMaterial(material) {
    setMaterialSelecionado(material)
    fecharVisualizacao()
    setModoFormulario(true)
  }

  async function excluirMaterialSelecionado(material) {
    const confirmar = window.confirm(
      `Deseja realmente excluir o material ${material.descricao || material.patrimonio || 'selecionado'}?`
    )

    if (!confirmar) return

    try {
      await excluirMaterial(material.id, user)
      fecharVisualizacao()
      recarregar()
    } catch (error) {
      console.error(error)
      alert(error.message || 'Erro ao excluir material.')
    }
  }

  return (
    <SigmoPage
      title="Materiais"
      subtitle="Controle patrimonial de materiais permanentes e cauteláveis."
      actions={
        !modoFormulario && (
          <SigmoButton onClick={abrirNovoCadastro}>
            Novo material
          </SigmoButton>
        )
      }
      className="materiais-page"
    >
      {modoFormulario ? (
        <MaterialForm
          user={user}
          materialEditando={materialSelecionado}
          onCancel={fecharFormulario}
          onSaved={finalizarFormulario}
        />
      ) : (
        <>
          <PatrimonioToolbar
            busca={busca}
            onBuscaChange={setBusca}
            onNovo={abrirNovoCadastro}
            placeholder="Buscar por patrimônio, descrição, categoria, marca, modelo, série..."
          />

          {erro && <div className="armas-alert error">{erro}</div>}

          {loading ? (
            <div className="armas-alert">Carregando materiais...</div>
          ) : (
            <PatrimonioList
              itens={materiaisFiltrados}
              getTitulo={(material) =>
                `${material.patrimonio || 'SEM PATRIMÔNIO'} — ${material.descricao || 'MATERIAL'}`
              }
              getSubtitulo={(material) =>
                [
                  material.categoria,
                  material.marca,
                  material.modelo,
                  material.numero_serie ? `SÉRIE: ${material.numero_serie}` : null,
                  material.unidade,
                  material.local_atual
                ]
                  .filter(Boolean)
                  .join(' • ')
              }
              getStatus={(material) => material.status}
              onAbrir={abrirVisualizacao}
              emptyTitle="Nenhum material cadastrado"
              emptyText="Cadastre um novo material para iniciar o controle patrimonial."
            />
          )}
        </>
      )}

      {materialVisualizando && (
        <MaterialViewModal
          material={materialVisualizando}
          onClose={fecharVisualizacao}
          onEdit={() => editarMaterial(materialVisualizando)}
          onDelete={() => excluirMaterialSelecionado(materialVisualizando)}
        />
      )}
    </SigmoPage>
  )
}