import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  STATUS_TASER,
  TIPOS_TASER
} from '../../constants/tasers'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import TaserForm from './components/TaserForm'
import TaserTable from './components/TaserTable'
import TaserDetalhesModal from './components/TaserDetalhesModal'
import TaserManutencaoModal from './components/TaserManutencaoModal'
import TaserRetornoManutencaoModal from './components/TaserRetornoManutencaoModal'
import TaserBaixaModal from './components/TaserBaixaModal'
import TaserAprovacoesModal from './components/TaserAprovacoesModal'
import TaserOperacaoModal from './components/TaserOperacaoModal'
import TaserManutencaoExternaModal from './components/TaserManutencaoExternaModal'

import {
  enviarTaserParaManutencao,
  excluirTaser,
  listarTasers
} from '../../services/tasersService'

import {
  supabase
} from '../../services/supabaseClient'

import {
  listarFotosTaser
} from '../../services/tasersFotosService'

import {
  aceitarTransferenciaTaser,
  cancelarTransferenciaTaser,
  criarTransferenciaTaserPendente,
  listarTransferenciasTaserAguardandoAprovacao,
  listarTransferenciasTaserCriadasPendentes,
  listarTransferenciasTaserPendentes,
  recusarTransferenciaTaser
} from '../../services/tasersTransferenciaService'

import {
  listarEntregasTaserAtivas,
  pagarCautelaTaser,
  receberDevolucaoTaser,
  regularizarCautelaTaser
} from '../../services/tasersOperacoesService'

import {
  concluirManutencao,
  listarManutencoes
} from '../../services/manutencoesService'

import {
  listarManutencoesExternas
} from '../../services/manutencoesExternasService'

import {
  decidirBaixaTaser,
  listarSolicitacoesBaixa,
  solicitarBaixaTaser
} from '../../services/patrimonioBaixasService'

import {
  listarPoliciais
} from '../../services/policiaisService'

import './styles/Taser.css'

const LIMITE = 20
const LIMITE_RESUMO = 5000
const statusOptions = STATUS_TASER
const tipoOptions = TIPOS_TASER


const DESTINOS_TRANSFERENCIA_P4 = [
  { codigo: 'SVDD', nome: 'Cofre do SVDD' },
  { codigo: '1 CIA', nome: '1ª CIA' },
  { codigo: '2 CIA', nome: '2ª CIA' },
  { codigo: '3 CIA', nome: '3ª CIA' },
  { codigo: '4 CIA', nome: '4ª CIA' },
  { codigo: '5 CIA', nome: '5ª CIA' },
  { codigo: '6 CIA', nome: '6ª CIA' },
  { codigo: 'FT', nome: 'FT' },
  { codigo: 'BTL', nome: 'BTL' },
  { codigo: 'OUTROS', nome: 'Outros' }
]

function maskRE(valor) {
  const limpo = String(valor || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 7)

  const numeros = limpo.slice(0, 6).replace(/\D/g, '')
  const digito = limpo.slice(6, 7)

  if (numeros.length < 6) return numeros
  return digito ? `${numeros}-${digito}` : `${numeros}-`
}

function reCompleto(valor) {
  return /^[0-9]{6}-[0-9A-Z]$/.test(String(valor || '').trim().toUpperCase())
}

function GrupoOperacao({ icone, titulo, descricao, children }) {
  return (
    <div className="taser-operation-group">
      <div className="taser-operation-group-header">
        <div className="taser-operation-group-icon" aria-hidden="true">{icone}</div>
        <div>
          <h3>{titulo}</h3>
          <p>{descricao}</p>
        </div>
      </div>
      <div className="taser-operation-actions">{children}</div>
    </div>
  )
}


function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function resumirTasers(lista = [], manutencoesExternas = []) {
  const idsExternos = new Set(
    (manutencoesExternas || [])
      .filter((item) => !['RETORNADA', 'CONCLUIDA', 'CONCLUÍDA', 'CANCELADA', 'REPROVADA'].includes(normalizar(item?.status)))
      .flatMap((item) => [
        item?.referencia_id,
        item?.taser_id,
        item?.item_id,
        ...(item?.itens || []).flatMap((subitem) => [subitem?.referencia_id, subitem?.taser_id, subitem?.item_id]),
        ...(item?.sigmo_manutencoes_externas_itens || []).flatMap((subitem) => [subitem?.referencia_id, subitem?.taser_id, subitem?.item_id])
      ])
      .filter(Boolean)
      .map(String)
  )

  const resumo = {
    total: lista.length,
    p4: 0,
    svdd: 0,
    cargaPermanente: 0,
    cautelas: 0,
    manutencaoP4: 0,
    manutencaoSVDD: 0,
    manutencaoExterna: 0,
    manutencao: 0,
    outrasCias: 0,
    batalhao: 0,
    aguardandoAprovacao: 0,
    baixados: 0,
    outros: 0
  }

  lista.forEach((taser) => {
    const status = normalizar(taser?.status_operacional || taser?.status)
    const local = normalizar(taser?.local_atual)
    const id = String(taser?.id || taser?.referencia_id || '')

    if (status === 'AGUARDANDO_APROVACAO_BAIXA') {
      resumo.aguardandoAprovacao += 1
      return
    }

    if (status === 'BAIXADO') {
      resumo.baixados += 1
      return
    }

    if (idsExternos.has(id) || local.includes('MANUTENCAO EXTERNA') || status.includes('MANUTENCAO_EXTERNA')) {
      resumo.manutencaoExterna += 1
      resumo.manutencao += 1
      return
    }

    if (status === 'MANUTENCAO' || local.includes('MANUTENCAO')) {
      if (local.includes('SVDD') || local.includes('SERVICO DE DIA')) {
        resumo.manutencaoSVDD += 1
      } else {
        resumo.manutencaoP4 += 1
      }

      resumo.manutencao += 1
      return
    }

    if (status.includes('CAUTELA') || status === 'EM_SERVICO') {
      resumo.cautelas += 1
      return
    }

    if (status === 'CARGA' || status.includes('CARGA_PERMANENTE')) {
      resumo.cargaPermanente += 1
      return
    }

    if (local.includes('SVDD') || local.includes('SERVICO DE DIA')) {
      resumo.svdd += 1
      return
    }

    if (
      /(^|\s)[1-6]\s*(ª|A)?\s*CIA($|\s)/.test(local) ||
      local.includes('OUTRA CIA') ||
      local.includes('OUTRAS CIAS') ||
      local.includes('COMPANHIA')
    ) {
      resumo.outrasCias += 1
      return
    }

    if (
      local === 'BTL' ||
      local.includes('BATALHAO') ||
      local.includes('BATALHÃO') ||
      local.includes('27 BPM') ||
      local.includes('27º BPM')
    ) {
      resumo.batalhao += 1
      return
    }

    /*
     * Destino externo deve prevalecer sobre o status RESERVA.
     * Ex.: 37BPMM continua RESERVA patrimonialmente, mas não está
     * mais sob guarda do P4 e deve aparecer em OUTROS.
     */
    const localEhP4 =
      local.includes('P4') ||
      local.includes('COFRE DO P4') ||
      local.includes('DEPOSITO DO P4') ||
      local.includes('GUARDA DO P4')

    if (
      local &&
      !localEhP4
    ) {
      resumo.outros += 1
      return
    }

    if (
      status === 'RESERVA' ||
      status === 'DISPONIVEL' ||
      localEhP4 ||
      !local
    ) {
      resumo.p4 += 1
      return
    }

    resumo.outros += 1
  })

  return resumo
}

function percentual(valor, total) {
  if (!Number(total)) return 0
  return Math.max(0, Math.min(100, (Number(valor || 0) / Number(total)) * 100))
}

function ResumoCard({ titulo, valor, detalhe, tone = 'blue' }) {
  return (
    <article className={`taser-summary-card taser-summary-${tone}`}>
      <span className="taser-summary-label">{titulo}</span>
      <strong>{Number(valor || 0).toLocaleString('pt-BR')}</strong>
      <small>{detalhe}</small>
    </article>
  )
}

function GraficoRoscaTaser({ total, itens }) {
  let acumulado = 0

  const segmentos = itens.map((item) => {
    const inicio = acumulado
    acumulado += percentual(item.valor, total)
    return `${item.cor} ${inicio}% ${acumulado}%`
  })

  if (acumulado < 100) {
    segmentos.push(`#e8edf4 ${acumulado}% 100%`)
  }

  return (
    <section className="taser-chart-card taser-chart-donut-card">
      <div className="taser-chart-header">
        <div>
          <span>Distribuição patrimonial</span>
          <h2>Situação dos Tasers</h2>
        </div>
      </div>

      <div className="taser-chart-donut-layout">
        <div
          className="taser-chart-donut"
          style={{ background: `conic-gradient(${segmentos.join(', ')})` }}
          aria-label={`Total de ${total} Tasers`}
        >
          <div>
            <strong>{Number(total || 0).toLocaleString('pt-BR')}</strong>
            <span>TOTAL</span>
          </div>
        </div>

        <div className="taser-chart-legend">
          {itens.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.cor }} />
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
              <small>
                {percentual(item.valor, total).toLocaleString('pt-BR', {
                  maximumFractionDigits: 1
                })}%
              </small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GraficoBarrasTaser({ total, itens }) {
  const maior = Math.max(1, ...itens.map((item) => Number(item.valor || 0)))

  return (
    <section className="taser-chart-card taser-chart-bars-card">
      <div className="taser-chart-header">
        <div>
          <span>Visão comparativa</span>
          <h2>Tasers por local e situação</h2>
        </div>
      </div>

      <div className="taser-chart-bars">
        {itens.map((item) => (
          <div className="taser-chart-bar-item" key={item.label}>
            <div className="taser-chart-bar-value">{item.valor}</div>
            <div className="taser-chart-bar-track">
              <i
                style={{
                  height: `${Math.max(
                    item.valor ? 9 : 2,
                    (Number(item.valor || 0) / maior) * 100
                  )}%`,
                  background: item.cor
                }}
              />
            </div>
            <strong>{item.label}</strong>
            <small>
              {percentual(item.valor, total).toLocaleString('pt-BR', {
                maximumFractionDigits: 1
              })}%
            </small>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Taser({ user }) {
  const [tasers, setTasers] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [todosTasers, setTodosTasers] = useState([])
  const [loadingResumo, setLoadingResumo] = useState(false)

  const [formAberto, setFormAberto] = useState(false)
  const [taserEditando, setTaserEditando] = useState(null)
  const [taserVisualizando, setTaserVisualizando] = useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [erroFotos, setErroFotos] = useState('')

  const [sortBy, setSortBy] = useState('criado_em')
  const [sortDirection, setSortDirection] = useState('desc')

  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [manutencoesExternasResumo, setManutencoesExternasResumo] = useState([])

  const [operacaoModal, setOperacaoModal] = useState(null)
  const [policiaisOperacao, setPoliciaisOperacao] = useState([])
  const [entregasAtivas, setEntregasAtivas] = useState([])
  const [salvandoOperacao, setSalvandoOperacao] = useState(false)

  const [taserManutencao, setTaserManutencao] = useState(null)
  const [salvandoManutencao, setSalvandoManutencao] = useState(false)
  const [retornoManutencao, setRetornoManutencao] = useState(null)
  const [salvandoRetorno, setSalvandoRetorno] = useState(false)
  const [seletorManutencaoAberto, setSeletorManutencaoAberto] = useState(false)
  const [buscaSeletorManutencao, setBuscaSeletorManutencao] = useState('')

  const [baixaModalAberta, setBaixaModalAberta] = useState(false)
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)
  const [solicitacoesBaixa, setSolicitacoesBaixa] = useState([])
  const [aprovacoesModalAberta, setAprovacoesModalAberta] = useState(false)
  const [processandoAprovacaoId, setProcessandoAprovacaoId] = useState(null)

  const [manutencaoExternaModalAberta, setManutencaoExternaModalAberta] = useState(false)

  const [transferenciaDestinoModalAberta, setTransferenciaDestinoModalAberta] = useState(false)
  const [categoriaTransferencia, setCategoriaTransferencia] = useState(null)
  const [transferenciaModalAberta, setTransferenciaModalAberta] = useState(false)
  const [cancelamentoTransferenciaModalAberto, setCancelamentoTransferenciaModalAberto] = useState(false)
  const [recebimentoModalAberta, setRecebimentoModalAberta] = useState(false)
  const [transferenciasPendentes, setTransferenciasPendentes] = useState([])
  const [transferenciasCancelaveis, setTransferenciasCancelaveis] = useState([])
  const [loadingTransferencias, setLoadingTransferencias] = useState(false)
  const [loadingTransferenciasCancelaveis, setLoadingTransferenciasCancelaveis] = useState(false)
  const [processandoTransferenciaId, setProcessandoTransferenciaId] = useState(null)
  const [taserIdsTransferenciaPendente, setTaserIdsTransferenciaPendente] = useState(new Set())
  const [pesquisaTransferencia, setPesquisaTransferencia] = useState('')
  const [tasersSelecionadosTransferencia, setTasersSelecionadosTransferencia] = useState([])
  const [destinoTransferenciaSelecionado, setDestinoTransferenciaSelecionado] = useState('')
  const [destinoTransferenciaOutro, setDestinoTransferenciaOutro] = useState('')
  const [reRecebedorTransferencia, setReRecebedorTransferencia] = useState('')
  const [recebedorTransferencia, setRecebedorTransferencia] = useState(null)
  const [erroRecebedorTransferencia, setErroRecebedorTransferencia] = useState('')
  const [buscandoRecebedorTransferencia, setBuscandoRecebedorTransferencia] = useState(false)
  const [observacoesTransferencia, setObservacoesTransferencia] = useState('')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo_taser: '',
    marca: '',
    modelo: '',
    status_operacional: '',
    unidade: ''
  })

  const perfilAtual = normalizar(
    user?.perfil ||
    user?.role ||
    user?.tipo_usuario ||
    user?.tipo_perfil ||
    user?.perfil_nome ||
    user?.user_metadata?.perfil ||
    ''
  )

  const ehPerfilP4 = ['P4', 'SECAO P4', 'SEÇÃO P4', 'GESTOR PATRIMONIAL'].includes(perfilAtual)
  const ehPerfilSVDD = ['SVDD', 'ENCARREGADO SVDD', 'ENCARREGADO DO SVDD', 'AUXILIAR SVDD', 'AUXILIAR DO SVDD'].includes(perfilAtual)
  const ehPerfilGestor = ['ADMINISTRADOR', 'ADMIN', 'COMANDANTE DE CIA', 'COMANDANTE DA CIA', 'COMANDANTE'].includes(perfilAtual)
  const podeMovimentarTaser = ehPerfilP4 || ehPerfilSVDD || ehPerfilGestor
  const podeAdministrarTaser = ehPerfilP4 || ehPerfilGestor
  const contextoOrigemSVDD = ehPerfilSVDD
  const origemTransferencia = contextoOrigemSVDD ? 'SVDD' : 'P4'
  const destinoTransferencia = contextoOrigemSVDD ? 'P4' : destinoTransferenciaSelecionado

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const carregarTasers = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarTasers({
        filtros: {
          pesquisa: filtros.pesquisa.trim(),
          tipo_taser: filtros.tipo_taser,
          marca: filtros.marca,
          modelo: filtros.modelo,
          status_operacional: filtros.status_operacional,
          unidade: filtros.unidade
        },
        pagina,
        limite: LIMITE,
        sortBy,
        sortDirection
      })

      const listaTasers =
        resultado.data || []

      const idsTasers =
        listaTasers
          .map((item) => item?.id)
          .filter(Boolean)

      let patrimoniosPorReferencia =
        new Map()

      if (idsTasers.length > 0) {
        const {
          data: patrimonios,
          error: patrimoniosError
        } = await supabase
          .from('sigmo_patrimonios')
          .select(
            'id, referencia_id, status, local_atual, responsavel_atual_id, responsavel_atual_nome, ativo'
          )
          .eq('tipo', 'taser')
          .in('referencia_id', idsTasers)

        if (patrimoniosError) {
          throw patrimoniosError
        }

        patrimoniosPorReferencia =
          new Map(
            (patrimonios || []).map(
              (patrimonio) => [
                String(
                  patrimonio.referencia_id
                ),
                patrimonio
              ]
            )
          )
      }

      setTasers(
        listaTasers.map((taser) => {
          const patrimonio =
            patrimoniosPorReferencia.get(
              String(taser?.id || '')
            )

          if (!patrimonio) {
            return taser
          }

          return {
            ...taser,

            // Situação operacional vigente vem da Engine Patrimonial.
            // Os dados técnicos continuam sendo lidos de sigmo_tasers.
            status_operacional:
              patrimonio.status ||
              taser.status_operacional,

            local_atual:
              patrimonio.local_atual ||
              taser.local_atual,

            responsavel_atual_id:
              patrimonio.responsavel_atual_id ||
              null,

            responsavel_atual_nome:
              patrimonio.responsavel_atual_nome ||
              null,

            patrimonio_central_id:
              patrimonio.id
          }
        })
      )

      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao carregar os Tasers.'
      )
    } finally {
      setLoading(false)
    }
  }, [
    filtros,
    pagina,
    sortBy,
    sortDirection
  ])

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true)

      const resultado = await listarTasers({
        pagina: 1,
        limite: LIMITE_RESUMO,
        sortBy: 'criado_em',
        sortDirection: 'desc'
      })

      setTodosTasers(resultado.data || [])

      try {
        const externas = await listarManutencoesExternas({
          modulo: 'TASER',
          pagina: 1,
          limite: LIMITE_RESUMO
        })
        setManutencoesExternasResumo(externas?.data || externas?.itens || externas || [])
      } catch (errorExterna) {
        console.warn('Não foi possível carregar as manutenções externas dos Tasers:', errorExterna)
        setManutencoesExternasResumo([])
      }
    } catch (error) {
      console.error('Erro ao carregar resumo dos Tasers:', error)
    } finally {
      setLoadingResumo(false)
    }
  }, [])

  const carregarSolicitacoesBaixa = useCallback(async () => {
    try {
      const itens = await listarSolicitacoesBaixa({
        modulo: 'TASER',
        status: 'AGUARDANDO_APROVACAO'
      })
      setSolicitacoesBaixa(itens || [])
    } catch (error) {
      console.error('Erro ao carregar solicitações de baixa de Taser:', error)
    }
  }, [])

  const carregarTransferenciasPendentes = useCallback(async () => {
    if (!podeMovimentarTaser) return

    try {
      setLoadingTransferencias(true)
      const destino = ehPerfilP4 ? 'P4' : 'SVDD'
      const resultado = await listarTransferenciasTaserPendentes({
        destinoCodigo: destino,
        limite: 100
      })
      setTransferenciasPendentes(resultado || [])
    } catch (error) {
      console.error('Erro ao carregar transferências de Taser:', error)
      setErro(error?.message || 'Não foi possível carregar as transferências pendentes.')
    } finally {
      setLoadingTransferencias(false)
    }
  }, [podeMovimentarTaser, ehPerfilP4])

  const carregarTasersComTransferenciaPendente = useCallback(async () => {
    if (!podeMovimentarTaser) {
      setTaserIdsTransferenciaPendente(new Set())
      return []
    }

    try {
      const [
        itensCriados,
        itensAguardandoAprovacao
      ] = await Promise.all([
        listarTransferenciasTaserCriadasPendentes({
          origemCodigo: origemTransferencia,
          limite: 500
        }),
        listarTransferenciasTaserAguardandoAprovacao({
          limite: 500
        })
      ])

      const itens = [
        ...(itensCriados || []),
        ...(itensAguardandoAprovacao || [])
      ]

      const ids = new Set(
        itens
          .map((movimentacao) => {
            const dados = movimentacao?.dados || movimentacao?.metadata?.dados_engine || {}
            return (
              dados?.taser_id ||
              dados?.referencia_id ||
              movimentacao?.metadata?.patrimonio?.referencia_id ||
              null
            )
          })
          .filter(Boolean)
          .map(String)
      )

      setTaserIdsTransferenciaPendente(ids)
      return itens || []
    } catch (error) {
      console.warn('Não foi possível identificar Tasers com transferência pendente:', error)
      setTaserIdsTransferenciaPendente(new Set())
      return []
    }
  }, [podeMovimentarTaser, origemTransferencia])

  useEffect(() => {
    carregarTasers()
  }, [carregarTasers])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  useEffect(() => {
    carregarSolicitacoesBaixa()
  }, [carregarSolicitacoesBaixa])

  useEffect(() => {
    carregarTransferenciasPendentes()
  }, [carregarTransferenciasPendentes])

  useEffect(() => {
    carregarTasersComTransferenciaPendente()
  }, [carregarTasersComTransferenciaPendente])

  function handleFiltroChange(event) {
    const { name, value } = event.target

    setFiltros((prev) => ({
      ...prev,
      [name]: value
    }))

    setPagina(1)
  }

  function limparFiltros() {
    setFiltros({
      pesquisa: '',
      tipo_taser: '',
      marca: '',
      modelo: '',
      status_operacional: '',
      unidade: ''
    })

    setPagina(1)
  }

  function rolarParaFormulario() {
    requestAnimationFrame(() => {
      document
        .querySelector('.taser-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function limparVisualizacao() {
    setTaserVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirNovoCadastro() {
    setTaserEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(taser) {
    if (!podeAdministrarTaser) return

    setTaserEditando(taser)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(taser) {
    setTaserVisualizando(taser)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos =
        await listarFotosTaser(taser.id)

      setFotosVisualizacao(
        Array.isArray(fotos)
          ? fotos
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar fotos do Taser:',
        error
      )

      setErroFotos(
        error.message ||
        'Não foi possível carregar as fotos do Taser.'
      )
    } finally {
      setCarregandoFotos(false)
    }
  }

  function fecharVisualizacao() {
    limparVisualizacao()
  }

  function fecharFormulario() {
    setFormAberto(false)
    setTaserEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await Promise.all([
      carregarTasers(),
      carregarResumo()
    ])
  }

  async function handleExcluir(taser) {
    if (!podeAdministrarTaser) return

    const identificacao =
      taser.patrimonio ||
      taser.numero_serie ||
      'Taser'

    const confirmou = window.confirm(
      `Deseja realmente excluir o Taser "${identificacao}"?`
    )

    if (!confirmou) return

    try {
      await excluirTaser(taser.id, user)
      await Promise.all([
        carregarTasers(),
        carregarResumo()
      ])
    } catch (error) {
      window.alert(
        error.message ||
        'Erro ao excluir o Taser.'
      )
    }
  }
  
  const tasersDisponiveisOperacao = useMemo(() => {
    return todosTasers.filter((taser) => {
      const status = normalizar(taser?.status_operacional)
      const local = normalizar(taser?.local_atual)
      const id = String(taser?.id || '')

      if (
        taser?.ativo === false ||
        taserIdsTransferenciaPendente.has(id) ||
        ['MANUTENCAO', 'BAIXADO', 'CARGA', 'EM_SERVICO', 'AGUARDANDO_APROVACAO_BAIXA'].includes(status)
      ) return false

      if (ehPerfilSVDD) return local.includes('SVDD') || local.includes('SERVICO DE DIA')
      if (ehPerfilP4) return local.includes('P4') || local.includes('COFRE DO P4') || local.includes('DEPOSITO') || local.includes('GUARDA')
      return true
    })
  }, [todosTasers, ehPerfilSVDD, ehPerfilP4, taserIdsTransferenciaPendente])

  const tasersElegiveisManutencao = useMemo(() => {
    const termo = normalizar(buscaSeletorManutencao)

    return todosTasers
      .filter((taser) => {
        const status = normalizar(taser?.status_operacional)
        const local = normalizar(taser?.local_atual)
        const id = String(taser?.id || '')

        if (
          taser?.ativo === false ||
          taserIdsTransferenciaPendente.has(id) ||
          status === 'MANUTENCAO' ||
          status === 'BAIXADO' ||
          status === 'AGUARDANDO_APROVACAO_BAIXA'
        ) return false

        if (ehPerfilSVDD) return local.includes('SVDD') || local.includes('SERVICO DE DIA')
        if (ehPerfilP4) return local.includes('P4') || local.includes('COFRE DO P4') || local.includes('DEPOSITO') || local.includes('GUARDA')
        return true
      })
      .filter((taser) => {
        if (!termo) return true
        return [
          taser?.patrimonio,
          taser?.numero_serie,
          taser?.marca,
          taser?.modelo,
          taser?.unidade,
          taser?.local_atual
        ].some((valor) => normalizar(valor).includes(termo))
      })
      .slice(0, 100)
  }, [
    todosTasers,
    buscaSeletorManutencao,
    ehPerfilSVDD,
    ehPerfilP4,
    taserIdsTransferenciaPendente
  ])

  const tasersElegiveisBaixa = useMemo(() => todosTasers.filter((taser) => {
    const status = normalizar(taser?.status_operacional || taser?.status)
    const local = normalizar(taser?.local_atual)
    const id = String(taser?.id || '')

    return (
      taser?.ativo !== false &&
      !taserIdsTransferenciaPendente.has(id) &&
      !['BAIXADO', 'AGUARDANDO_APROVACAO_BAIXA', 'MANUTENCAO'].includes(status) &&
      (local.includes('P4') || local.includes('COFRE DO P4') || local.includes('DEPOSITO') || local.includes('GUARDA'))
    )
  }), [todosTasers, taserIdsTransferenciaPendente])

  const tasersExternosRetornaveis = useMemo(
    () =>
      todosTasers.filter(
        (taser) => {
          const status =
            normalizar(
              taser?.status_operacional ||
              taser?.status
            )

          const local =
            normalizar(
              taser?.local_atual
            )

          const id =
            String(
              taser?.id ||
              ''
            )

          const localEhP4 =
            local.includes('P4') ||
            local.includes('COFRE DO P4') ||
            local.includes('DEPOSITO DO P4') ||
            local.includes('GUARDA DO P4')

          const localEhSVDD =
            local.includes('SVDD') ||
            local.includes('SERVICO DE DIA')

          const indisponivel =
            taser?.ativo === false ||
            taserIdsTransferenciaPendente.has(
              id
            ) ||
            [
              'BAIXADO',
              'AGUARDANDO_APROVACAO_BAIXA',
              'MANUTENCAO',
              'CAUTELADO',
              'EM_SERVICO',
              'CARGA'
            ].includes(
              status
            )

          return (
            !indisponivel &&
            Boolean(local) &&
            !localEhP4 &&
            !localEhSVDD
          )
        }
      ),
    [
      todosTasers,
      taserIdsTransferenciaPendente
    ]
  )

  const tasersDisponiveisTransferencia = useMemo(() => {
    const termo = normalizar(pesquisaTransferencia)

    const base =
      categoriaTransferencia === 'RETORNO_EXTERNO'
        ? tasersExternosRetornaveis
        : todosTasers

    return base.filter((taser) => {
      const local = normalizar(taser?.local_atual)
      const status = normalizar(taser?.status_operacional)
      const estaNaOrigem =
        categoriaTransferencia === 'RETORNO_EXTERNO'
          ? true
          : origemTransferencia === 'P4'
            ? local.includes('P4') || local.includes('COFRE DO P4') || local.includes('DEPOSITO') || local.includes('GUARDA')
            : local.includes('SVDD') || local.includes('SERVICO DE DIA')

      const transferenciaManutencaoSVDDP4 =
        origemTransferencia === 'SVDD' &&
        destinoTransferencia === 'P4' &&
        status === 'MANUTENCAO'

      if (!estaNaOrigem) return false
      if (taserIdsTransferenciaPendente.has(String(taser?.id || ''))) return false
      if (['BAIXADO', 'CAUTELADO', 'CARGA', 'AGUARDANDO_APROVACAO_BAIXA'].includes(status)) return false
      if (status === 'MANUTENCAO' && !transferenciaManutencaoSVDDP4) return false
      if (!termo) return true

      return [taser.patrimonio, taser.numero_serie, taser.marca, taser.modelo, taser.unidade]
        .some((valor) => normalizar(valor).includes(termo))
    })
  }, [
    todosTasers,
    pesquisaTransferencia,
    origemTransferencia,
    destinoTransferencia,
    categoriaTransferencia,
    tasersExternosRetornaveis,
    taserIdsTransferenciaPendente
  ])

  function abrirSeletorManutencao() {
    setFormAberto(false)
    setTaserEditando(null)
    limparVisualizacao()
    setBuscaSeletorManutencao('')
    setSeletorManutencaoAberto(true)
  }

  function abrirManutencao(taser) {
    const status = normalizar(taser?.status_operacional)

    if (status === 'MANUTENCAO') {
      window.alert('Este Taser já está em manutenção.')
      return
    }

    if (status === 'BAIXADO' || taser?.ativo === false) {
      window.alert('Um Taser baixado ou inativo não pode ser enviado para manutenção.')
      return
    }

    setTaserManutencao(taser)
  }

  function selecionarTaserParaManutencao(taser) {
    setSeletorManutencaoAberto(false)
    setBuscaSeletorManutencao('')
    abrirManutencao(taser)
  }

  async function confirmarManutencao(dados) {
    if (!taserManutencao?.id) return

    try {
      setSalvandoManutencao(true)
      await enviarTaserParaManutencao({
        taserId: taserManutencao.id,
        ...dados,
        user
      })
      setTaserManutencao(null)
      setMensagemSucesso('Taser enviado para manutenção.')
      await Promise.all([carregarTasers(), carregarResumo()])
    } catch (error) {
      console.error('Erro ao enviar Taser para manutenção:', error)
      window.alert(error?.message || 'Não foi possível enviar o Taser para manutenção.')
    } finally {
      setSalvandoManutencao(false)
    }
  }

  async function abrirRetornoManutencao(taser) {
    try {
      const resultado = await listarManutencoes({
        modulo: 'TASER',
        status: 'EM_MANUTENCAO',
        referenciaId: taser.id,
        pagina: 1,
        limite: 20
      })

      const manutencaoAtiva = (resultado?.data || []).find(
        (item) => normalizar(item.status) === 'EM_MANUTENCAO'
      )

      if (!manutencaoAtiva) {
        window.alert('Não foi encontrada uma manutenção ativa para este Taser.')
        return
      }

      setRetornoManutencao({ taser, manutencao: manutencaoAtiva })
    } catch (error) {
      window.alert(error?.message || 'Não foi possível carregar a manutenção ativa.')
    }
  }

  async function confirmarRetornoManutencao(dados) {
    if (!retornoManutencao?.manutencao?.id) return

    try {
      setSalvandoRetorno(true)
      await concluirManutencao({
        manutencaoId: retornoManutencao.manutencao.id,
        servicoExecutado: dados.servicoExecutado,
        observacoes: dados.observacoes,
        fotos: dados.fotos,
        user
      })
      setRetornoManutencao(null)
      await Promise.all([carregarTasers(), carregarResumo()])
      setMensagemSucesso('Retorno da manutenção registrado com sucesso.')
    } catch (error) {
      window.alert(error?.message || 'Não foi possível concluir o retorno da manutenção.')
    } finally {
      setSalvandoRetorno(false)
    }
  }

  async function abrirOperacao(modo) {
    try {
      setErro('')

      // Atualiza o bloqueio operacional antes de abrir qualquer seletor.
      await carregarTasersComTransferenciaPendente()

      setOperacaoModal(modo)

      if (modo === 'CAUTELA') {
        const resultado = await listarPoliciais({
          pagina: 1,
          limite: 500,
          filtros: { ativo: true }
        })
        setPoliciaisOperacao(resultado?.data || resultado || [])
      }

      if (['DEVOLUCAO', 'REGULARIZAR'].includes(modo)) {
        const lista = await listarEntregasTaserAtivas()
        const filtrada = modo === 'REGULARIZAR'
          ? lista.filter((mov) => {
              const dados = mov?.dados || mov?.metadata?.dados_engine || {}
              if (!dados.devolucao_prevista) return false
              return new Date(dados.devolucao_prevista).getTime() < Date.now()
            })
          : lista
        setEntregasAtivas(filtrada)
      }
    } catch (error) {
      setErro(error?.message || 'Não foi possível abrir a operação.')
      setOperacaoModal(null)
    }
  }

  async function confirmarOperacao(dados) {
    try {
      setSalvandoOperacao(true)
      setErro('')

      if (operacaoModal === 'CAUTELA') {
        await pagarCautelaTaser({
          taserIds: dados.ids,
          policial: dados.policial,
          devolucaoPrevista: dados.devolucaoPrevista,
          observacoes: dados.observacoes,
          user
        })
        setMensagemSucesso('Cautela registrada com sucesso.')
      } else if (operacaoModal === 'DEVOLUCAO') {
        const selecionadas = entregasAtivas.filter((item) => dados.ids.includes(item.id))
        await receberDevolucaoTaser({
          movimentacoes: selecionadas,
          destinoCodigo: ehPerfilSVDD ? 'SVDD' : 'P4',
          observacoes: dados.observacoes,
          user
        })
        setMensagemSucesso('Devolução recebida com sucesso.')
      } else if (operacaoModal === 'REGULARIZAR') {
        await regularizarCautelaTaser({
          movimentacaoId: dados.movimentacaoId,
          acao: dados.acao,
          novaPrevisao: dados.devolucaoPrevista,
          observacoes: dados.observacoes,
          user
        })
        setMensagemSucesso('Providência de regularização registrada.')
      }

      setOperacaoModal(null)
      await Promise.all([carregarTasers(), carregarResumo()])
    } catch (error) {
      setErro(error?.message || 'Não foi possível concluir a operação.')
    } finally {
      setSalvandoOperacao(false)
    }
  }

  async function confirmarSolicitacaoBaixa({ taser, motivo, observacoes, fotos }) {
    try {
      setSalvandoBaixa(true)
      await solicitarBaixaTaser({ taser, motivo, observacoes, fotos, user })
      setBaixaModalAberta(false)
      setMensagemSucesso('Solicitação de baixa enviada ao Comandante da Cia.')
      await Promise.all([carregarTasers(), carregarResumo(), carregarSolicitacoesBaixa()])
    } catch (error) {
      window.alert(error?.message || 'Não foi possível solicitar a baixa do Taser.')
    } finally {
      setSalvandoBaixa(false)
    }
  }

  async function decidirSolicitacaoBaixa(item, decisao) {
    let observacoes = ''

    if (decisao !== 'APROVAR') {
      observacoes = window.prompt(
        decisao === 'DILIGENCIA'
          ? 'Informe a diligência solicitada ao P4:'
          : 'Informe o motivo da reprovação:'
      ) || ''
      if (!observacoes.trim()) return
    } else if (!window.confirm(`Confirma a baixa definitiva do Taser ${item.patrimonio || item.numero_serie || ''}?`)) {
      return
    }

    try {
      setProcessandoAprovacaoId(item.id)
      await decidirBaixaTaser({
        solicitacao: item,
        decisao,
        observacoes,
        user
      })
      setMensagemSucesso(decisao === 'APROVAR' ? 'Baixa patrimonial aprovada.' : 'Solicitação de baixa atualizada.')
      await Promise.all([carregarTasers(), carregarResumo(), carregarSolicitacoesBaixa()])
    } catch (error) {
      window.alert(error?.message || 'Não foi possível registrar a decisão.')
    } finally {
      setProcessandoAprovacaoId(null)
    }
  }

  async function abrirTransferenciaTaser() {
    await carregarTasersComTransferenciaPendente()
    setPesquisaTransferencia('')
    setTasersSelecionadosTransferencia([])
    setDestinoTransferenciaOutro('')
    setReRecebedorTransferencia('')
    setRecebedorTransferencia(null)
    setErroRecebedorTransferencia('')
    setObservacoesTransferencia('')
    setCategoriaTransferencia(null)

    if (contextoOrigemSVDD) {
      setDestinoTransferenciaSelecionado('P4')
      setTransferenciaModalAberta(true)
      return
    }

    setDestinoTransferenciaSelecionado('')
    setTransferenciaDestinoModalAberta(true)
  }

  async function abrirRetornoExternoTaser() {
    if (!ehPerfilP4) {
      return
    }

    await carregarTasersComTransferenciaPendente()

    setCategoriaTransferencia(
      'RETORNO_EXTERNO'
    )
    setPesquisaTransferencia('')
    setTasersSelecionadosTransferencia([])
    setDestinoTransferenciaSelecionado('P4')
    setDestinoTransferenciaOutro('')
    setObservacoesTransferencia('')
    setTransferenciaModalAberta(true)
  }


  async function selecionarCategoriaTransferencia(categoria) {
    setCategoriaTransferencia(categoria)
    setTransferenciaDestinoModalAberta(false)
    setPesquisaTransferencia('')
    setTasersSelecionadosTransferencia([])
    setDestinoTransferenciaOutro('')
    setReRecebedorTransferencia('')
    setRecebedorTransferencia(null)
    setErroRecebedorTransferencia('')
    setObservacoesTransferencia('')

    if (categoria === 'CAUTELA') {
      await abrirOperacao('CAUTELA')
      return
    }

    if (categoria === 'SVDD') {
      setDestinoTransferenciaSelecionado('SVDD')
      setTransferenciaModalAberta(true)
      return
    }

    if (categoria === 'BATALHAO') {
      setDestinoTransferenciaSelecionado('BTL')
      setTransferenciaModalAberta(true)
      return
    }

    if (categoria === 'OUTRA_UNIDADE') {
      setDestinoTransferenciaSelecionado('OUTROS')
      setTransferenciaModalAberta(true)
      return
    }

    // OUTRAS_CIAS: primeiro escolhe a Companhia na segunda janela.
    setDestinoTransferenciaSelecionado('')
    setTransferenciaModalAberta(true)
  }

  function alternarTaserTransferencia(id) {
    setTasersSelecionadosTransferencia((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id]
    )
  }

  function alternarTodosTasersTransferencia() {
    const idsVisiveis = tasersDisponiveisTransferencia.map((taser) => taser.id)

    const todosSelecionados =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((id) => tasersSelecionadosTransferencia.includes(id))

    setTasersSelecionadosTransferencia((atuais) => {
      if (todosSelecionados) {
        return atuais.filter((id) => !idsVisiveis.includes(id))
      }

      return [...new Set([...atuais, ...idsVisiveis])]
    })
  }

  async function buscarRecebedorExternoTransferencia(reInformado = null) {
    const re = String(reInformado || reRecebedorTransferencia || '').trim().toUpperCase()

    if (!re) {
      setRecebedorTransferencia(null)
      setErroRecebedorTransferencia('Informe o RE do recebedor.')
      return
    }

    try {
      setBuscandoRecebedorTransferencia(true)
      setErroRecebedorTransferencia('')

      const resultado = await listarPoliciais({
        filtros: { re, perfil: 'USUARIO EXTERNO' },
        pagina: 1,
        limite: 20,
        sortBy: 'nome_guerra',
        sortDirection: 'asc'
      })

      const alvo = normalizar(re).replace(/[^0-9A-Z]/g, '')
      const encontrado = (resultado?.data || []).find((item) =>
        normalizar(item?.re).replace(/[^0-9A-Z]/g, '') === alvo &&
        normalizar(item?.perfil) === 'USUARIO EXTERNO' &&
        normalizar(item?.situacao || 'ATIVO') !== 'INATIVO'
      )

      if (!encontrado) {
        setRecebedorTransferencia(null)
        setErroRecebedorTransferencia('Usuário externo ativo não encontrado para este RE.')
        return
      }

      setRecebedorTransferencia(encontrado)
    } catch (error) {
      setRecebedorTransferencia(null)
      setErroRecebedorTransferencia('Não foi possível localizar o usuário externo.')
    } finally {
      setBuscandoRecebedorTransferencia(false)
    }
  }

  async function confirmarTransferenciaTaser() {
    const selecionados = tasersDisponiveisTransferencia.filter(
      (taser) => tasersSelecionadosTransferencia.includes(taser.id)
    )

    if (!selecionados.length) return
    if (!destinoTransferencia) {
      setErro('Selecione o destino da transferência.')
      return
    }

    if (destinoTransferencia === 'OUTROS' && !destinoTransferenciaOutro.trim()) {
      setErro('Informe o destino quando selecionar Outros.')
      return
    }

    const destinoNome = destinoTransferencia === 'OUTROS'
      ? destinoTransferenciaOutro.trim()
      : DESTINOS_TRANSFERENCIA_P4.find((item) => item.codigo === destinoTransferencia)?.nome || destinoTransferencia

    try {
      setProcessandoTransferenciaId('LOTE')

      const retornoExterno =
        categoriaTransferencia ===
        'RETORNO_EXTERNO'

      for (const taser of selecionados) {
        await criarTransferenciaTaserPendente({
          taserId: taser.id,
          origemCodigo:
            retornoExterno
              ? taser.local_atual
              : origemTransferencia,
          destinoCodigo:
            retornoExterno
              ? 'P4'
              : destinoTransferencia,
          destinoNome:
            retornoExterno
              ? 'COFRE DO P4'
              : destinoNome,
          recebedor: null,
          observacoes:
            observacoesTransferencia.trim() ||
            null,
          user
        })
      }

      setTransferenciaModalAberta(false)
      setObservacoesTransferencia('')
      setMensagemSucesso(
        retornoExterno
          ? `${selecionados.length} retorno(s) de Taser solicitado(s). Aguardando aprovação do Cmt de Cia.`
          : `${selecionados.length} Taser(s) enviado(s). A movimentação aguarda recebimento em ${destinoNome}.`
      )
      await Promise.all([
        carregarTasers(),
        carregarResumo(),
        carregarTransferenciasPendentes(),
        carregarTasersComTransferenciaPendente()
      ])
    } catch (error) {
      setErro(error?.message || 'Não foi possível transferir o Taser.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function abrirCancelamentoTransferencia() {
    try {
      setLoadingTransferenciasCancelaveis(true)
      setCancelamentoTransferenciaModalAberto(true)
      const itens = await listarTransferenciasTaserCriadasPendentes({
        origemCodigo: origemTransferencia,
        limite: 200
      })
      setTransferenciasCancelaveis(itens || [])
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar as transferências pendentes.')
    } finally {
      setLoadingTransferenciasCancelaveis(false)
    }
  }

  async function cancelarTransferenciaPendente(movimentacao) {
    const motivo = window.prompt('Informe o motivo do cancelamento da transferência:')
    if (!motivo?.trim()) return

    try {
      setProcessandoTransferenciaId(movimentacao.id)

      await cancelarTransferenciaTaser({
        movimentacaoId: movimentacao.id,
        motivo,
        origemCodigo: origemTransferencia,
        user
      })

      // Remove imediatamente do modal para dar retorno visual ao usuário.
      setTransferenciasCancelaveis((atuais) =>
        atuais.filter((item) => item.id !== movimentacao.id)
      )

      // Recarrega todas as visões que podem refletir a movimentação.
      await Promise.all([
        carregarTasers(),
        carregarResumo(),
        carregarTransferenciasPendentes(),
        carregarTasersComTransferenciaPendente()
      ])

      // Mantém a lista de canceláveis sincronizada caso o modal permaneça aberto.
      const itensAtualizados = await listarTransferenciasTaserCriadasPendentes({
        origemCodigo: origemTransferencia,
        limite: 200
      })

      setTransferenciasCancelaveis(itensAtualizados || [])
      setMensagemSucesso('Transferência cancelada com sucesso.')
    } catch (error) {
      setErro(error?.message || 'Não foi possível cancelar a transferência.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function receberTransferenciaTaser(movimentacao) {
    try {
      setProcessandoTransferenciaId(movimentacao.id)
      await aceitarTransferenciaTaser({
        movimentacaoId: movimentacao.id,
        user
      })
      await Promise.all([
        carregarTasers(),
        carregarResumo(),
        carregarTransferenciasPendentes(),
        carregarTasersComTransferenciaPendente()
      ])
    } catch (error) {
      setErro(error?.message || 'Não foi possível receber o Taser.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function recusarTransferenciaPendente(movimentacao) {
    const motivo = window.prompt('Informe o motivo da recusa:')
    if (!motivo?.trim()) return

    try {
      setProcessandoTransferenciaId(movimentacao.id)
      await recusarTransferenciaTaser({
        movimentacaoId: movimentacao.id,
        motivo,
        user
      })
      await Promise.all([
        carregarTransferenciasPendentes(),
        carregarTasersComTransferenciaPendente()
      ])
    } catch (error) {
      setErro(error?.message || 'Não foi possível recusar a transferência.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) =>
        prev === 'asc'
          ? 'desc'
          : 'asc'
      )

      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function obterValorOpcao(option) {
    return typeof option === 'string'
      ? option
      : option.value
  }

  function obterLabelOpcao(option) {
    return typeof option === 'string'
      ? option
      : option.label
  }

  const resumo = useMemo(
    () => resumirTasers(todosTasers, manutencoesExternasResumo),
    [todosTasers, manutencoesExternasResumo]
  )

  const dadosGrafico = useMemo(
    () => {
      if (ehPerfilSVDD) {
        return [
          {
            label: 'Cofre do SVDD',
            valor: resumo.svdd,
            cor: '#3b82f6'
          },
          {
            label: 'Cautelas ativas',
            valor: resumo.cautelas,
            cor: '#eab308'
          },
          {
            label: 'Manutenção',
            valor: resumo.manutencaoSVDD,
            cor: '#ef4444'
          },
          {
            label: 'Baixados',
            valor: resumo.baixados,
            cor: '#334155'
          }
        ]
      }

      return [
        { label: 'Cofre do P4', valor: resumo.p4, cor: '#22c55e' },
        { label: 'Cofre do SVDD', valor: resumo.svdd, cor: '#3b82f6' },
        { label: 'Cautelas ativas', valor: resumo.cautelas, cor: '#eab308' },
        { label: 'Manutenção', valor: resumo.manutencao, cor: '#ef4444' },
        { label: 'Outras Cias', valor: resumo.outrasCias, cor: '#2563eb' },
        { label: 'Batalhão', valor: resumo.batalhao, cor: '#1d4ed8' },
        { label: 'Baixados', valor: resumo.baixados, cor: '#334155' },
        { label: 'Outros', valor: resumo.outros, cor: '#94a3b8' }
      ]
    },
    [resumo, ehPerfilSVDD]
  )

  const totalGrafico = useMemo(
    () =>
      ehPerfilSVDD
        ? dadosGrafico.reduce(
            (totalAtual, item) =>
              totalAtual + Number(item?.valor || 0),
            0
          )
        : resumo.total,
    [dadosGrafico, ehPerfilSVDD, resumo.total]
  )

  return (
    <main className="taser-page">
      <header className="taser-header">
        <div>
          <span className="taser-kicker">
            Gestão Patrimonial
          </span>

          <h1>Taser</h1>

          <p>
            Cadastro, consulta e controle patrimonial dos dispositivos Taser.
          </p>
        </div>

        <div className="taser-hero-actions">
          <button
            type="button"
            className="taser-btn-secondary"
            onClick={() => Promise.all([carregarTasers(), carregarResumo()])}
            disabled={loading || loadingResumo}
          >
            {loading || loadingResumo ? 'Atualizando...' : 'Atualizar'}
          </button>

          {podeAdministrarTaser && (
            <button
              type="button"
              className="taser-btn-primary"
              onClick={abrirNovoCadastro}
            >
              + Novo Taser
            </button>
          )}
        </div>
      </header>

      {erro && (
        <div className="taser-alert-error">
          {erro}
        </div>
      )}

      <section
        className="taser-summary-grid"
        aria-label="Resumo patrimonial dos Tasers"
        style={{
          gridTemplateColumns:
            'repeat(auto-fit, minmax(180px, 1fr))'
        }}
      >
        <ResumoCard
          titulo="Total controlado"
          valor={
            ehPerfilSVDD
              ? resumo.svdd
              : resumo.total
          }
          detalhe={
            ehPerfilSVDD
              ? 'Tasers atualmente sob controle do SVDD'
              : 'Tasers cadastrados'
          }
          tone="blue"
        />

        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Cofre do P4"
            valor={resumo.p4}
            detalhe="Tasers sob guarda do P4"
            tone="cyan"
          />
        )}

        <ResumoCard
          titulo="Cofre do SVDD"
          valor={resumo.svdd}
          detalhe="Tasers disponíveis no Serviço de Dia"
          tone="green"
        />

        <ResumoCard
          titulo="Cautelas ativas"
          valor={resumo.cautelas}
          detalhe="Tasers com policiais"
          tone="purple"
        />

        <ResumoCard
          titulo="Manutenção"
          valor={
            ehPerfilSVDD
              ? resumo.manutencaoSVDD
              : resumo.manutencao
          }
          detalhe={
            ehPerfilSVDD
              ? 'Tasers em manutenção sob responsabilidade do SVDD'
              : 'Material indisponível'
          }
          tone="red"
        />

        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Outras Cias"
            valor={resumo.outrasCias}
            detalhe="Outras companhias"
            tone="blue"
          />
        )}

        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Batalhão"
            valor={resumo.batalhao}
            detalhe="Carga do batalhão"
            tone="blue"
          />
        )}

        <ResumoCard
          titulo="Baixados"
          valor={resumo.baixados}
          detalhe="Baixas registradas"
          tone="dark"
        />

        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Outros"
            valor={resumo.outros}
            detalhe="Outra unidade ou destino"
            tone="slate"
          />
        )}
      </section>

      <section
        className="taser-charts-grid"
        aria-label="Gráficos patrimoniais dos Tasers"
      >
        <GraficoRoscaTaser total={totalGrafico} itens={dadosGrafico} />
        <GraficoBarrasTaser total={totalGrafico} itens={dadosGrafico} />
      </section>

      {mensagemSucesso && (
        <div className="taser-alert-success">{mensagemSucesso}</div>
      )}

      <section className="taser-operations-panel" aria-label="Operações patrimoniais do Taser">
        <div className="taser-operation-groups">
          <GrupoOperacao
            icone="📦"
            titulo="Saídas e movimentações"
            descricao="Distribuição e movimentação patrimonial de Tasers."
          >
            <button type="button" disabled={!podeMovimentarTaser} onClick={abrirTransferenciaTaser}>
              <strong>{contextoOrigemSVDD ? 'Devolver ao P4' : 'Transferir patrimônio'}</strong>
              <span>
                {contextoOrigemSVDD
                  ? 'Selecionar um ou vários Tasers e devolver ao P4'
                  : 'Escolher o destino e selecionar um ou vários Tasers'}
              </span>
            </button>

            <button type="button" disabled={!podeMovimentarTaser} onClick={abrirCancelamentoTransferencia}>
              <strong>Cancelar movimentação</strong>
              <span>Cancelar uma transferência que ainda não foi recebida</span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao
            icone="📥"
            titulo="Entradas e recebimentos"
            descricao="Entrada, devolução e retorno de patrimônio."
          >
            {podeAdministrarTaser && (
              <button type="button" onClick={abrirNovoCadastro}>
                <strong>Receber material novo</strong>
                <span>Cadastrar um novo Taser recebido pelo P4</span>
              </button>
            )}

            <button
              type="button"
              disabled={!podeMovimentarTaser}
              onClick={() =>
                ehPerfilP4
                  ? abrirRetornoExternoTaser()
                  : abrirOperacao(
                      'DEVOLUCAO'
                    )
              }
            >
              <strong>
                Receber devolução
              </strong>
              <span>
                {ehPerfilP4
                  ? 'Selecionar Taser em Batalhão, outra Cia ou outra unidade e solicitar retorno ao Cofre do P4'
                  : 'Encerrar cautela e receber o Taser'}
              </span>
            </button>

            {ehPerfilP4 && (
              <button
                type="button"
                disabled={!podeMovimentarTaser}
                onClick={() =>
                  abrirOperacao(
                    'DEVOLUCAO'
                  )
                }
              >
                <strong>
                  Receber cautela devolvida
                </strong>
                <span>
                  Encerrar cautela de policial e devolver o Taser ao Cofre do P4
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={!podeMovimentarTaser}
              onClick={() => {
                setRecebimentoModalAberta(true)
                carregarTransferenciasPendentes()
              }}
            >
              <strong>{ehPerfilP4 ? 'Receber do SVDD' : 'Receber do P4'}</strong>
              <span>{ehPerfilP4 ? 'Confirmar Taser devolvido pelo SVDD' : 'Confirmar Taser enviado ao Cofre do SVDD'}</span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao
            icone="⚙️"
            titulo="Gestão patrimonial"
            descricao="Manutenção, manutenção externa e baixa."
          >
            <button type="button" disabled={!podeMovimentarTaser} onClick={() => abrirOperacao('REGULARIZAR')}>
              <strong>Regularizar cautela</strong>
              <span>Registrar providência para cautela vencida</span>
            </button>

            <button type="button" disabled={!podeMovimentarTaser} onClick={abrirSeletorManutencao}>
              <strong>Enviar manutenção</strong>
              <span>Selecionar um Taser e registrar a saída para reparo</span>
            </button>

            {ehPerfilP4 && (
              <button type="button" onClick={() => setManutencaoExternaModalAberta(true)}>
                <strong>Enviar manutenção externa</strong>
                <span>Selecionar Tasers já em manutenção no P4 e solicitar saída da Cia</span>
              </button>
            )}

            <button
              type="button"
              disabled={!ehPerfilP4 || tasersElegiveisBaixa.length === 0}
              className="taser-operation-danger"
              onClick={() => setBaixaModalAberta(true)}
            >
              <strong>Baixar patrimônio</strong>
              <span>{ehPerfilP4 ? 'Solicitar baixa patrimonial definitiva' : 'Operação exclusiva do P4'}</span>
            </button>

            {ehPerfilGestor && (
              <button type="button" onClick={() => setAprovacoesModalAberta(true)}>
                <strong>Aprovações de baixa</strong>
                <span>{solicitacoesBaixa.length} solicitação(ões) pendente(s)</span>
              </button>
            )}
          </GrupoOperacao>
        </div>
      </section>

      <section className="taser-toolbar">
        <div className="taser-search">
          <label htmlFor="pesquisa">
            Pesquisar
          </label>

          <input
            id="pesquisa"
            name="pesquisa"
            type="search"
            value={filtros.pesquisa}
            onChange={handleFiltroChange}
            placeholder="Patrimônio, série, marca, modelo, equipe ou viatura"
          />
        </div>

        <div className="taser-filter">
          <label htmlFor="tipo_taser">
            Tipo
          </label>

          <select
            id="tipo_taser"
            name="tipo_taser"
            value={filtros.tipo_taser}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {tipoOptions.map((option) => {
              const valor =
                obterValorOpcao(option)

              return (
                <option
                  key={valor}
                  value={valor}
                >
                  {obterLabelOpcao(option)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="taser-filter">
          <label htmlFor="marca">
            Marca
          </label>

          <input
            id="marca"
            name="marca"
            value={filtros.marca}
            onChange={handleFiltroChange}
            placeholder="Ex.: AXON"
          />
        </div>

        <div className="taser-filter">
          <label htmlFor="modelo">
            Modelo
          </label>

          <input
            id="modelo"
            name="modelo"
            value={filtros.modelo}
            onChange={handleFiltroChange}
            placeholder="Ex.: TASER 7"
          />
        </div>

        <div className="taser-filter">
          <label htmlFor="status_operacional">
            Status
          </label>

          <select
            id="status_operacional"
            name="status_operacional"
            value={filtros.status_operacional}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {statusOptions.map((option) => {
              const valor =
                obterValorOpcao(option)

              return (
                <option
                  key={valor}
                  value={valor}
                >
                  {obterLabelOpcao(option)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="taser-filter">
          <label htmlFor="unidade">
            Unidade
          </label>

          <select
            id="unidade"
            name="unidade"
            value={filtros.unidade}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todas
            </option>

            {UNIDADES_27_BPMM.map(
              (unidade) => (
                <option
                  key={unidade}
                  value={unidade}
                >
                  {unidade}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          className="taser-btn-secondary taser-toolbar-clear"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="taser-form-area">
          <TaserForm
            user={user}
            taserEditando={taserEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="taser-list-card">
        <div className="taser-list-header">
          <div>
            <h2>
              Tasers cadastrados
            </h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        <TaserTable
          tasers={tasers}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={podeAdministrarTaser ? abrirEdicao : undefined}
          onDelete={podeAdministrarTaser ? handleExcluir : undefined}
        />

        <footer className="taser-pagination">
          <button
            type="button"
            disabled={
              pagina <= 1 ||
              loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.max(
                  1,
                  prev - 1
                )
              )
            }
          >
            Anterior
          </button>

          <span>
            Página {pagina} de{' '}
            {totalPaginas}
          </span>

          <button
            type="button"
            disabled={
              pagina >= totalPaginas ||
              loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.min(
                  totalPaginas,
                  prev + 1
                )
              )
            }
          >
            Próxima
          </button>
        </footer>
      </section>
            {transferenciaDestinoModalAberta && (
        <div
          className="taser-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTransferenciaDestinoModalAberta(false)
            }
          }}
        >
          <section
            className="taser-transfer-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Escolher destino da transferência de Taser"
          >
            <header>
              <div>
                <span>SIGMO • TASER</span>
                <h2>Transferir Taser</h2>
                <p>Escolha o destino da movimentação.</p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setTransferenciaDestinoModalAberta(false)}
              >
                ×
              </button>
            </header>

            <div className="taser-operation-actions" style={{ padding: '34px 36px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <button type="button" onClick={() => selecionarCategoriaTransferencia('SVDD')}>
                <strong>SVDD</strong>
                <span>Transferir Tasers para o Serviço de Dia.</span>
              </button>

              <button type="button" onClick={() => selecionarCategoriaTransferencia('CAUTELA')}>
                <strong>Cautela</strong>
                <span>Registrar entrega temporária de Taser com previsão de devolução.</span>
              </button>

              <button type="button" onClick={() => selecionarCategoriaTransferencia('OUTRAS_CIAS')}>
                <strong>Outras Cias</strong>
                <span>Transferir Taser para outra Companhia.</span>
              </button>

              <button type="button" onClick={() => selecionarCategoriaTransferencia('BATALHAO')}>
                <strong>Batalhão</strong>
                <span>Transferir Taser para carga do Batalhão.</span>
              </button>

              <button type="button" onClick={() => selecionarCategoriaTransferencia('OUTRA_UNIDADE')}>
                <strong>Outra unidade / Outros</strong>
                <span>Registrar transferência para outro destino ou unidade.</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {transferenciaModalAberta && (
        <div className="taser-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !processandoTransferenciaId) setTransferenciaModalAberta(false)
        }}>
          <section className="taser-transfer-modal" role="dialog" aria-modal="true" aria-label="Transferir Tasers">
            <header>
              <div>
                <span>Transferência patrimonial</span>
                <h2>
                  {categoriaTransferencia === 'RETORNO_EXTERNO'
                    ? 'Retorno externo → P4'
                    : contextoOrigemSVDD
                      ? 'SVDD → P4'
                      : categoriaTransferencia === 'OUTRAS_CIAS'
                      ? 'P4 → Outras Cias'
                      : categoriaTransferencia === 'BATALHAO'
                        ? 'P4 → Batalhão'
                        : categoriaTransferencia === 'OUTRA_UNIDADE'
                          ? 'P4 → Outra unidade / Outros'
                          : `P4 → ${destinoTransferencia || 'Selecionar destino'}`}
                </h2>
                <p>
                  {categoriaTransferencia === 'RETORNO_EXTERNO'
                    ? 'Selecione os Tasers que retornarão de Batalhão, outra Cia ou outra unidade para o Cofre do P4. O retorno será efetivado após aprovação do Cmt de Cia.'
                    : contextoOrigemSVDD
                      ? 'Selecione os Tasers que serão devolvidos ao P4.'
                      : 'Selecione um ou vários Tasers disponíveis para esta movimentação.'}
                </p>
              </div>
              <button type="button" onClick={() => setTransferenciaModalAberta(false)} disabled={Boolean(processandoTransferenciaId)}>×</button>
            </header>

            <div className="taser-transfer-body">
              {!contextoOrigemSVDD &&
                categoriaTransferencia !== 'RETORNO_EXTERNO' &&
                (
                  categoriaTransferencia === 'OUTRAS_CIAS' ||
                  categoriaTransferencia === null
                ) && (
                <div className="taser-transfer-destination">
                  <label htmlFor="taser-destino-transferencia">Destino</label>
                  <select
                    id="taser-destino-transferencia"
                    value={destinoTransferenciaSelecionado}
                    onChange={(event) => {
                      setDestinoTransferenciaSelecionado(event.target.value)
                      if (event.target.value !== 'OUTROS') setDestinoTransferenciaOutro('')
                    }}
                  >
                    <option value="">Selecione o destino</option>
                    {(categoriaTransferencia === 'OUTRAS_CIAS'
                      ? DESTINOS_TRANSFERENCIA_P4.filter((destino) =>
                          ['1 CIA', '2 CIA', '3 CIA', '4 CIA', '5 CIA', '6 CIA'].includes(destino.codigo)
                        )
                      : DESTINOS_TRANSFERENCIA_P4
                    ).map((destino) => (
                      <option key={destino.codigo} value={destino.codigo}>{destino.nome}</option>
                    ))}
                  </select>

                  {destinoTransferenciaSelecionado === 'OUTROS' && (
                    <>
                      <input
                        type="text"
                        value={destinoTransferenciaOutro}
                        onChange={(event) => setDestinoTransferenciaOutro(event.target.value.toUpperCase())}
                        placeholder="Informe o destino, órgão ou local"
                      />

                      <label htmlFor="taser-observacoes-transferencia-generico">
                        Observações / Documento
                      </label>
                      <textarea
                        id="taser-observacoes-transferencia-generico"
                        value={observacoesTransferencia}
                        onChange={(event) =>
                          setObservacoesTransferencia(
                            event.target.value.toUpperCase()
                          )
                        }
                        placeholder="Informe documento, referência ou observações da transferência"
                        rows={3}
                      />
                    </>
                  )}
                </div>
              )}

              {!contextoOrigemSVDD && categoriaTransferencia === 'OUTRA_UNIDADE' && (
                <div className="taser-transfer-destination">
                  <label htmlFor="taser-destino-transferencia-outros">Destino / unidade</label>
                  <input
                    id="taser-destino-transferencia-outros"
                    type="text"
                    value={destinoTransferenciaOutro}
                    onChange={(event) => setDestinoTransferenciaOutro(event.target.value.toUpperCase())}
                    placeholder="Informe o destino, órgão ou unidade"
                  />

                  <label htmlFor="taser-observacoes-transferencia-outros">
                    Observações / Documento
                  </label>
                  <textarea
                    id="taser-observacoes-transferencia-outros"
                    value={observacoesTransferencia}
                    onChange={(event) =>
                      setObservacoesTransferencia(
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="Informe documento, referência ou observações da transferência"
                    rows={3}
                  />
                </div>
              )}

              {!contextoOrigemSVDD &&
                ['OUTRAS_CIAS', 'BATALHAO'].includes(categoriaTransferencia) && (
                  <div className="taser-transfer-destination">
                    <label htmlFor="taser-observacoes-transferencia">
                      Observações / Documento
                    </label>
                    <textarea
                      id="taser-observacoes-transferencia"
                      value={observacoesTransferencia}
                      onChange={(event) =>
                        setObservacoesTransferencia(
                          event.target.value.toUpperCase()
                        )
                      }
                      placeholder="Informe documento, referência ou observações da transferência"
                      rows={3}
                    />
                  </div>
                )}

              {categoriaTransferencia === 'RETORNO_EXTERNO' && (
                <div className="taser-transfer-destination">
                  <label htmlFor="taser-observacoes-retorno-externo">
                    Observações / Documento
                  </label>
                  <textarea
                    id="taser-observacoes-retorno-externo"
                    value={observacoesTransferencia}
                    onChange={(event) =>
                      setObservacoesTransferencia(
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="Informe documento, referência ou observações do retorno"
                    rows={3}
                  />
                </div>
              )}

              <input
                type="search"
                value={pesquisaTransferencia}
                onChange={(event) => setPesquisaTransferencia(event.target.value)}
                placeholder="Pesquisar patrimônio, série, marca ou modelo"
              />

              <div className="taser-transfer-select-all">
                <button
                  type="button"
                  className="taser-btn-secondary"
                  onClick={alternarTodosTasersTransferencia}
                  disabled={tasersDisponiveisTransferencia.length === 0}
                >
                  {tasersDisponiveisTransferencia.length > 0 &&
                  tasersDisponiveisTransferencia.every((taser) =>
                    tasersSelecionadosTransferencia.includes(taser.id)
                  )
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </button>

                <span>
                  {tasersSelecionadosTransferencia.length} selecionado(s)
                </span>
              </div>

              <div className="taser-transfer-list">
                {tasersDisponiveisTransferencia.length === 0 ? (
                  <div className="taser-transfer-empty">
                    {categoriaTransferencia === 'RETORNO_EXTERNO'
                      ? 'Nenhum Taser externo disponível para retorno ao P4.'
                      : 'Nenhum Taser disponível para esta transferência.'}
                  </div>
                ) : (
                  tasersDisponiveisTransferencia.map((taser) => (
                    <label key={taser.id} className="taser-transfer-item">
                      <input
                        type="checkbox"
                        checked={tasersSelecionadosTransferencia.includes(taser.id)}
                        onChange={() => alternarTaserTransferencia(taser.id)}
                      />
                      <div>
                        <strong>{taser.patrimonio || taser.numero_serie || 'TASER'}</strong>
                        <span>{[taser.marca, taser.modelo].filter(Boolean).join(' ') || 'Dispositivo Taser'} · {taser.local_atual || '-'}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <footer>
              <span>{tasersSelecionadosTransferencia.length} selecionado(s)</span>
              <button type="button" className="taser-btn-secondary" onClick={() => setTransferenciaModalAberta(false)} disabled={Boolean(processandoTransferenciaId)}>Cancelar</button>
              <button
                type="button"
                className="taser-btn-primary"
                onClick={confirmarTransferenciaTaser}
                disabled={
                  !tasersSelecionadosTransferencia.length ||
                  (
                    categoriaTransferencia !== 'RETORNO_EXTERNO' &&
                    !destinoTransferencia
                  ) ||
                  (
                    categoriaTransferencia !== 'RETORNO_EXTERNO' &&
                    destinoTransferencia === 'OUTROS' &&
                    !destinoTransferenciaOutro.trim()
                  ) ||
                  Boolean(processandoTransferenciaId)
                }
              >
                {processandoTransferenciaId
                  ? 'Enviando...'
                  : categoriaTransferencia === 'RETORNO_EXTERNO'
                    ? 'Solicitar retorno'
                    : 'Criar transferência'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {cancelamentoTransferenciaModalAberto && (
        <div className="taser-modal-backdrop" role="presentation">
          <section className="taser-transfer-modal">
            <header>
              <div>
                <span>Transferências pendentes</span>
                <h2>Cancelar transferência</h2>
              </div>
              <button type="button" onClick={() => setCancelamentoTransferenciaModalAberto(false)}>×</button>
            </header>
            <div className="taser-transfer-list">
              {loadingTransferenciasCancelaveis ? (
                <div className="taser-transfer-empty">Carregando transferências...</div>
              ) : transferenciasCancelaveis.length === 0 ? (
                <div className="taser-transfer-empty">Nenhuma transferência pendente criada por este setor.</div>
              ) : transferenciasCancelaveis.map((movimentacao) => {
                const dados = movimentacao.dados || movimentacao.metadata?.dados_engine || {}
                return (
                  <article key={movimentacao.id} className="taser-receive-item">
                    <div>
                      <strong>
                        {dados.numero_serie ||
                          dados.patrimonio ||
                          movimentacao?.metadata?.patrimonio?.identificacao ||
                          movimentacao?.metadata?.patrimonio?.descricao ||
                          dados.referencia_id ||
                          'TASER'}
                      </strong>
                      <span>{movimentacao.origem_guardiao_codigo || movimentacao?.metadata?.guardiao_origem?.codigo || dados?.guardiao_origem?.codigo || origemTransferencia} → {movimentacao.destino_guardiao_nome || movimentacao.destino_guardiao_codigo || movimentacao?.metadata?.guardiao_destino?.nome || dados?.guardiao_destino?.nome || dados?.policial_nome || 'Destino'}</span>
                    </div>
                    <button type="button" onClick={() => cancelarTransferenciaPendente(movimentacao)} disabled={Boolean(processandoTransferenciaId)}>
                      {processandoTransferenciaId === movimentacao.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </article>
                )
              })}
            </div>
            <footer>
              <button type="button" className="taser-btn-secondary" onClick={() => setCancelamentoTransferenciaModalAberto(false)}>Fechar</button>
            </footer>
          </section>
        </div>
      )}

      {recebimentoModalAberta && (
        <div className="taser-modal-backdrop" role="presentation">
          <section className="taser-transfer-modal">
            <header>
              <div>
                <span>Recebimento patrimonial</span>
                <h2>{ehPerfilP4 ? 'SVDD → P4' : 'P4 → SVDD'}</h2>
              </div>
              <button type="button" onClick={() => setRecebimentoModalAberta(false)}>×</button>
            </header>

            <div className="taser-transfer-list">
              {loadingTransferencias ? (
                <div className="taser-transfer-empty">Atualizando pendências...</div>
              ) : transferenciasPendentes.length === 0 ? (
                <div className="taser-transfer-empty">Nenhum Taser pendente de recebimento.</div>
              ) : transferenciasPendentes.map((movimentacao) => {
                const dados = movimentacao.dados || movimentacao.metadata?.dados_engine || {}
                return (
                  <div key={movimentacao.id} className="taser-receive-item">
                    <div>
                      <strong>{dados.patrimonio || dados.numero_serie || 'TASER'}</strong>
                      <span>{[dados.marca, dados.modelo].filter(Boolean).join(' ') || 'Dispositivo Taser'}</span>
                    </div>
                    <div className="taser-receive-actions">
                      <button type="button" onClick={() => receberTransferenciaTaser(movimentacao)} disabled={Boolean(processandoTransferenciaId)}>Receber</button>
                      <button type="button" className="danger" onClick={() => recusarTransferenciaPendente(movimentacao)} disabled={Boolean(processandoTransferenciaId)}>Recusar</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <footer>
              <button type="button" className="taser-btn-secondary" onClick={() => setRecebimentoModalAberta(false)}>Fechar</button>
            </footer>
          </section>
        </div>
      )}

      {seletorManutencaoAberto && (
        <div className="taser-modal-backdrop" role="presentation">
          <section className="taser-maintenance-selector">
            <header>
              <div>
                <span>Manutenção individual</span>
                <h2>Selecionar Taser</h2>
                <p>Escolha o equipamento que será enviado para reparo.</p>
              </div>
              <button type="button" onClick={() => setSeletorManutencaoAberto(false)}>×</button>
            </header>

            <div className="taser-maintenance-selector-body">
              <input
                type="search"
                value={buscaSeletorManutencao}
                onChange={(event) => setBuscaSeletorManutencao(event.target.value)}
                placeholder="Patrimônio, série, marca, modelo ou local"
                autoFocus
              />

              <div className="taser-maintenance-selector-list">
                {tasersElegiveisManutencao.length === 0 ? (
                  <div className="taser-transfer-empty">Nenhum Taser disponível para envio à manutenção.</div>
                ) : tasersElegiveisManutencao.map((taser) => (
                  <button
                    key={taser.id}
                    type="button"
                    className="taser-maintenance-selector-item"
                    onClick={() => selecionarTaserParaManutencao(taser)}
                  >
                    <div>
                      <strong>{taser.patrimonio || taser.numero_serie || 'Taser sem identificação'}</strong>
                      <span>{[taser.marca, taser.modelo].filter(Boolean).join(' ') || 'Marca/modelo não informado'}</span>
                    </div>
                    <small>{taser.local_atual || taser.unidade || taser.status_operacional}</small>
                  </button>
                ))}
              </div>
            </div>

            <footer>
              <span>{tasersElegiveisManutencao.length} equipamento(s) disponível(is)</span>
              <button type="button" className="taser-btn-secondary" onClick={() => setSeletorManutencaoAberto(false)}>Cancelar</button>
            </footer>
          </section>
        </div>
      )}

      <TaserOperacaoModal
        aberto={Boolean(operacaoModal)}
        modo={operacaoModal}
        titulo={
          operacaoModal === 'CAUTELA' ? 'Pagar cautela' :
          operacaoModal === 'DEVOLUCAO' ? 'Receber devolução' :
          'Regularizar cautela vencida'
        }
        descricao={
          operacaoModal === 'CAUTELA' ? 'Registre a entrega temporária e a previsão de devolução.' :
          operacaoModal === 'DEVOLUCAO' ? 'Selecione as cargas ou cautelas devolvidas ao guardião de origem.' :
          'Estenda o prazo ou encaminhe uma providência ao P4 ou ao Comandante.'
        }
        tasers={tasersDisponiveisOperacao}
        policiais={policiaisOperacao}
        entregas={entregasAtivas}
        salvando={salvandoOperacao}
        onClose={() => { if (!salvandoOperacao) setOperacaoModal(null) }}
        onConfirm={confirmarOperacao}
      />

      <TaserBaixaModal
        aberto={baixaModalAberta}
        tasers={tasersElegiveisBaixa}
        salvando={salvandoBaixa}
        onClose={() => { if (!salvandoBaixa) setBaixaModalAberta(false) }}
        onConfirm={confirmarSolicitacaoBaixa}
      />

      <TaserAprovacoesModal
        aberto={aprovacoesModalAberta}
        itens={solicitacoesBaixa}
        podeDecidir={ehPerfilGestor}
        processandoId={processandoAprovacaoId}
        onClose={() => { if (!processandoAprovacaoId) setAprovacoesModalAberta(false) }}
        onDecidir={decidirSolicitacaoBaixa}
      />

      <TaserManutencaoModal
        taser={taserManutencao}
        salvando={salvandoManutencao}
        onClose={() => { if (!salvandoManutencao) setTaserManutencao(null) }}
        onConfirm={confirmarManutencao}
      />

      <TaserRetornoManutencaoModal
        contexto={retornoManutencao}
        salvando={salvandoRetorno}
        onClose={() => { if (!salvandoRetorno) setRetornoManutencao(null) }}
        onConfirm={confirmarRetornoManutencao}
      />

      {manutencaoExternaModalAberta && (
        <TaserManutencaoExternaModal
          user={user}
          onClose={() => setManutencaoExternaModalAberta(false)}
          onCreated={async (solicitacao) => {
            setMensagemSucesso(`Solicitação ${solicitacao?.protocolo || ''} enviada para aprovação do Cmt de Cia.`)
            await Promise.all([carregarTasers(), carregarResumo()])
          }}
        />
      )}

      {taserVisualizando && (
        <TaserDetalhesModal
          taser={taserVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={
            podeAdministrarTaser
              ? () => abrirEdicao(taserVisualizando)
              : undefined
          }
          onReturnMaintenance={
            normalizar(taserVisualizando?.status_operacional) === 'MANUTENCAO'
              ? () => abrirRetornoManutencao(taserVisualizando)
              : undefined
          }
        />
      )}
    </main>
  )
}
