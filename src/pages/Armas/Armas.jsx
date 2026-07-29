import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CALIBRES_ARMAS,
  ESPECIES_ARMAS,
  PROPRIEDADES_ARMAS,
  STATUS_ARMAS
} from '../../constants/armas'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import ArmaForm from './components/ArmaForm'

import {
  excluirArma,
  listarArmas
} from '../../services/armasService'

import {
  aceitarTransferencia,
  criarTransferenciaPendente,
  listarTransferenciasPendentes,
  recusarTransferencia
} from '../../services/patrimonioTransferenciaService'

import {
  listarFotosArma
} from '../../services/armasFotosService'
import './styles/Armas.css'
import './styles/ArmasOperacoes.css'

const LIMITE = 20
const LIMITE_RESUMO = 5000

const statusOptions = [
  'CAUTELADO',
  'CARGA',
  'RESERVA',  
  'RECOLHIDO',
  'BAIXADO',
  'APREENDIDO'
]

const propriedadeOptions = [
  'PMESP',
  'PARTICULAR'
]


function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function obterStatusArma(arma) {
  return normalizarTexto(
    arma?.status_operacional ||
      arma?.status ||
      arma?.situacao_operacional
  )
}

function obterLocalArma(arma) {
  return normalizarTexto(
    arma?.local_atual ||
      arma?.localizacao_atual ||
      arma?.localizacao ||
      arma?.local ||
      arma?.guardiao_nome ||
      ''
  )
}

function estaNaoLocalizada(arma) {
  const status = obterStatusArma(arma)
  const local = obterLocalArma(arma)

  return (
    status.includes('NAO LOCALIZ') ||
    local.includes('NAO LOCALIZ') ||
    (!local && status === '')
  )
}

function estaEmManutencao(arma) {
  const status = obterStatusArma(arma)
  const local = obterLocalArma(arma)

  return (
    status.includes('MANUTENCAO') ||
    local.includes('MANUTENCAO')
  )
}

function estaCautelada(arma) {
  const status = obterStatusArma(arma)

  return (
    status.includes('CAUTELA') ||
    status.includes('CAUTELADO')
  )
}

function estaEmCarga(arma) {
  const status = obterStatusArma(arma)

  return (
    status === 'CARGA' ||
    status.includes('CARGA PERMANENTE')
  )
}

function estaNoP4(arma) {
  const status = obterStatusArma(arma)
  const local = obterLocalArma(arma)

  return (
    status === 'RESERVA' ||
    status === 'RECOLHIDO' ||
    local.includes('P4') ||
    local.includes('RESERVA') ||
    local.includes('DEPOSITO')
  )
}

function estaNoSVDD(arma) {
  const local = obterLocalArma(arma)

  return (
    local.includes('SVDD') ||
    local.includes('SERVICO DE DIA') ||
    local.includes('COFRE DO SVDD')
  )
}

function percentual(valor, total) {
  const base = Number(total || 0)
  const parte = Number(valor || 0)

  if (!base || !Number.isFinite(parte)) return 0

  return Math.max(0, Math.min(100, (parte / base) * 100))
}

function formatarPercentual(valor) {
  return `${Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`
}

function ArmaResumoCard({ titulo, valor, descricao, destaque = 'padrao', onClick }) {
  return (
    <button
      type="button"
      className={`armas-resumo-card armas-resumo-${destaque}`}
      onClick={onClick}
      disabled={typeof onClick !== 'function'}
    >
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{descricao}</small>
    </button>
  )
}

function GraficoRoscaArmas({ resumo }) {
 const fatias = [
  { label: 'Depósito do P4', valor: resumo.p4, cor: '#2563eb' },
  { label: 'Cofre do SVDD', valor: resumo.svdd, cor: '#7c3aed' },
  { label: 'Carga permanente', valor: resumo.carga, cor: '#16a34a' },
  { label: 'Cautelas ativas', valor: resumo.cautelas, cor: '#eab308' },
  { label: 'Manutenção', valor: resumo.manutencao, cor: '#f97316' },
  { label: 'Não localizadas', valor: resumo.naoLocalizadas, cor: '#dc2626' },
  { label: 'Apreendidas', valor: resumo.apreendidas, cor: '#8b5cf6' },
  { label: 'Recolhidas', valor: resumo.recolhidas, cor: '#64748b' }
]

  let acumulado = 0
  const partes = fatias.map((item) => {
    const inicio = acumulado
    const fim = acumulado + percentual(item.valor, resumo.total)
    acumulado = fim
    return `${item.cor} ${inicio}% ${fim}%`
  })

  if (acumulado < 100) {
    partes.push(`#e8edf5 ${acumulado}% 100%`)
  }

  return (
    <section className="armas-grafico-card armas-grafico-rosca-card">
      <div className="armas-grafico-header">
        <span>Visão consolidada</span>
        <h3>Distribuição do armamento</h3>
      </div>

      <div className="armas-rosca-layout">
        <div
          className="armas-rosca"
          style={{ background: `conic-gradient(${partes.join(', ')})` }}
        >
          <div className="armas-rosca-centro">
            <strong>{resumo.total}</strong>
            <span>Total de armas</span>
          </div>
        </div>

        <div className="armas-grafico-legenda">
          {fatias.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.cor }} />
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
              <small>{formatarPercentual(percentual(item.valor, resumo.total))}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GraficoBarrasArmas({ resumo }) {
  const categorias = [
  { label: 'Depósito do P4', valor: resumo.p4 },
  { label: 'Cofre do SVDD', valor: resumo.svdd },
  { label: 'Carga permanente', valor: resumo.carga },
  { label: 'Cautelas', valor: resumo.cautelas },
  { label: 'Manutenção', valor: resumo.manutencao },
  { label: 'Não localizadas', valor: resumo.naoLocalizadas },
  { label: 'Apreendidas', valor: resumo.apreendidas },
  { label: 'Recolhidas', valor: resumo.recolhidas }
]

  const maior = Math.max(1, ...categorias.map((item) => item.valor))

  return (
    <section className="armas-grafico-card armas-grafico-barras-card">
      <div className="armas-grafico-header">
        <span>Comparativo patrimonial</span>
        <h3>Quantidade de armas por situação</h3>
      </div>

      <div className="armas-barras-area">
        {categorias.map((item) => (
          <div className="armas-barra-grupo" key={item.label}>
            <div className="armas-barra-coluna">
              <strong>{item.valor}</strong>
              <div
                className="armas-barra"
                style={{ height: `${Math.max(8, percentual(item.valor, maior))}%` }}
              />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Armas({ user }) {
  const [armas, setArmas] = useState([])
  const [armasResumo, setArmasResumo] = useState([])
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [transferindoArmaId, setTransferindoArmaId] =
    useState(null)

  const [transferenciaModalAberta, setTransferenciaModalAberta] =
    useState(false)
  const [recebimentoModalAberta, setRecebimentoModalAberta] =
    useState(false)
  const [pesquisaTransferencia, setPesquisaTransferencia] =
    useState('')
  const [armasSelecionadas, setArmasSelecionadas] =
    useState([])
  const [enviandoLote, setEnviandoLote] =
    useState(false)

  const [mensagemSucesso, setMensagemSucesso] =
    useState('')

  const [transferenciasPendentesArmas, setTransferenciasPendentesArmas] =
    useState([])

  const [loadingTransferenciasArmas, setLoadingTransferenciasArmas] =
    useState(false)

  const [processandoTransferenciaId, setProcessandoTransferenciaId] =
    useState(null)

  const [transferenciasSelecionadas, setTransferenciasSelecionadas] =
    useState([])

  const [processandoRecebimentoEmLote, setProcessandoRecebimentoEmLote] =
    useState(false)

  const [formAberto, setFormAberto] = useState(false)
  const [armaEditando, setArmaEditando] = useState(null)
  const [armaVisualizando, setArmaVisualizando] = useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] =
    useState([])

  const [
    loadingFotosVisualizacao,
    setLoadingFotosVisualizacao
  ] = useState(false)

  const [
    fotoSelecionadaVisualizacao,
    setFotoSelecionadaVisualizacao
  ] = useState(null)

  const [sortBy, setSortBy] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    propriedade: '',
    especie: '',
    calibre: '',
    status: '',
    unidade: ''
  })

  const perfilUsuario = normalizarTexto(
    user?.perfil ||
    user?.role ||
    user?.tipo_usuario ||
    user?.user_metadata?.perfil ||
    user?.user_metadata?.role ||
    ''
  )

  const ehPerfilP4 = [
    'P4',
    'SECAO P4',
    'SEÇÃO P4',
    'GESTOR PATRIMONIAL'
  ].includes(perfilUsuario)

  const ehPerfilSVDD = [
    'SVDD',
    'ENCARREGADO SVDD',
    'ENCARREGADO DO SVDD',
    'AUXILIAR SVDD',
    'AUXILIAR DO SVDD'
  ].includes(perfilUsuario)

  const ehPerfilGestor = [
    'ADMINISTRADOR',
    'COMANDANTE DE CIA',
    'COMANDANTE DA CIA',
    'COMANDANTE'
  ].includes(perfilUsuario)

  const podeTransferirArmas = ehPerfilP4 || ehPerfilSVDD || ehPerfilGestor
  const contextoTransferenciaSVDD = ehPerfilSVDD
  const codigoOrigemTransferencia = contextoTransferenciaSVDD ? 'SVDD' : 'P4'
  const nomeOrigemTransferencia = contextoTransferenciaSVDD ? 'COFRE DO SVDD' : 'GUARDA DO P4'
  const codigoDestinoTransferencia = contextoTransferenciaSVDD ? 'P4' : 'SVDD'
  const nomeDestinoTransferencia = contextoTransferenciaSVDD ? 'GUARDA DO P4' : 'COFRE DO SVDD'
  const podeReceberTransferencia = ehPerfilP4 || ehPerfilSVDD || ehPerfilGestor

  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(total / LIMITE))
  }, [total])

  const carregarArmas = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const pesquisa = filtros.pesquisa.trim()

      const filtrosService = {
  pesquisa,
  propriedade: filtros.propriedade,
  especie: filtros.especie,
  calibre: filtros.calibre,
  status: filtros.status,
  unidade: filtros.unidade
}

      const resultado = await listarArmas({
        filtros: filtrosService,
        pagina,
        limite: LIMITE,
        sortBy,
        sortDirection
      })

      setArmas(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao carregar as armas.'
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

  useEffect(() => {
    carregarArmas()
  }, [carregarArmas])


  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true)

      const resultado = await listarArmas({
        filtros: {},
        pagina: 1,
        limite: LIMITE_RESUMO,
        sortBy: 'created_at',
        sortDirection: 'desc'
      })

      setArmasResumo(resultado.data || [])
    } catch (error) {
      console.error('Erro ao carregar resumo de armas:', error)
      setArmasResumo([])
    } finally {
      setLoadingResumo(false)
    }
  }, [])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  const carregarTransferenciasPendentesArmas = useCallback(async () => {
    if (!podeReceberTransferencia) {
      setTransferenciasPendentesArmas([])
      return
    }

    try {
      setLoadingTransferenciasArmas(true)

      const resultado = await listarTransferenciasPendentes({
        destinoCodigo: ehPerfilP4 ? 'P4' : 'SVDD',
        categoria: 'ARMA',
        limite: 100
      })

      setTransferenciasPendentesArmas(resultado || [])
    } catch (error) {
      console.error(
        'Erro ao carregar transferências de armas:',
        error
      )

      setErro(
        error.message ||
        'Não foi possível carregar as armas pendentes de recebimento.'
      )
    } finally {
      setLoadingTransferenciasArmas(false)
    }
  }, [podeReceberTransferencia, ehPerfilP4])

  useEffect(() => {
    carregarTransferenciasPendentesArmas()
  }, [carregarTransferenciasPendentesArmas])

   useEffect(() => {
  async function carregarFotosVisualizacao() {
    if (!armaVisualizando?.id) {
  setFotosVisualizacao([])
  setFotoSelecionadaVisualizacao(null)
  return
}

    try {
      setLoadingFotosVisualizacao(true)

      const resultado = await listarFotosArma(
        armaVisualizando.id
      )

      const fotosCarregadas = resultado || []

setFotosVisualizacao(fotosCarregadas)

setFotoSelecionadaVisualizacao(
  fotosCarregadas.find(
    (foto) => foto.principal
  ) ||
  fotosCarregadas[0] ||
  null
)
    } catch (error) {
      console.error(
        'Erro ao carregar fotos da arma:',
        error
      )

      setFotosVisualizacao([])
    } finally {
      setLoadingFotosVisualizacao(false)
    }
  }

  carregarFotosVisualizacao()
}, [armaVisualizando?.id])

  const resumo = useMemo(() => {
    const categorias = {
  p4: 0,
  svdd: 0,
  carga: 0,
  cautelas: 0,
  manutencao: 0,
  naoLocalizadas: 0,
  apreendidas: 0,
  recolhidas: 0,
  outros: 0
}

armasResumo.forEach((arma) => {
  const status = String(
    arma.status_operacional ||
    arma.status ||
    ''
  )
    .trim()
    .toUpperCase()

  if (status === 'APREENDIDO') {
    categorias.apreendidas += 1
    return
  }

  if (status === 'RECOLHIDO') {
    categorias.recolhidas += 1
    return
  }

  if (estaNaoLocalizada(arma)) {
    categorias.naoLocalizadas += 1
    return
  }

  if (estaEmManutencao(arma)) {
    categorias.manutencao += 1
    return
  }

  if (estaCautelada(arma)) {
    categorias.cautelas += 1
    return
  }

  if (estaEmCarga(arma)) {
    categorias.carga += 1
    return
  }

  if (estaNoSVDD(arma)) {
    categorias.svdd += 1
    return
  }

  if (estaNoP4(arma)) {
    categorias.p4 += 1
    return
  }

  categorias.outros += 1
})

return {
  total: armasResumo.length,
  ...categorias
}
  }, [armasResumo])
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
      propriedade: '',
      especie: '',
      calibre: '',
      status: '',
      unidade: ''
    })

    setPagina(1)
  }

  function abrirNovoCadastro() {
    setArmaEditando(null)
    setArmaVisualizando(null)
    setFormAberto(true)

    requestAnimationFrame(() => {
      document
        .querySelector('.armas-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function abrirEdicao(arma) {
    setArmaEditando(arma)
    setArmaVisualizando(null)
    setFormAberto(true)

    requestAnimationFrame(() => {
      document
        .querySelector('.armas-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function fecharFormulario() {
    setFormAberto(false)
    setArmaEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await Promise.all([carregarArmas(), carregarResumo()])
  }

  async function handleExcluir(arma) {
    const identificacao =
      arma.patrimonio ||
      arma.numero_serie ||
      'registro selecionado'

    const confirmou = window.confirm(
      `Deseja realmente excluir a arma ${identificacao}?`
    )

    if (!confirmou) return

    try {
      setErro('')

      await excluirArma(arma.id, user)

      if (armaVisualizando?.id === arma.id) {
        setArmaVisualizando(null)
      }

      if (
        armas.length === 1 &&
        pagina > 1
      ) {
        setPagina((prev) => prev - 1)
      } else {
        await Promise.all([carregarArmas(), carregarResumo()])
      }
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao excluir a arma.'
      )
    }
  }

  function alternarTransferenciaSelecionada(transferenciaId) {
    setTransferenciasSelecionadas((atuais) =>
      atuais.includes(transferenciaId)
        ? atuais.filter((id) => id !== transferenciaId)
        : [...atuais, transferenciaId]
    )
  }

  function selecionarTodasTransferenciasPendentes() {
    const idsVisiveis = transferenciasPendentesArmas.map(
      (transferencia) => transferencia.id
    )

    const todasSelecionadas =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((id) => transferenciasSelecionadas.includes(id))

    setTransferenciasSelecionadas(
      todasSelecionadas ? [] : idsVisiveis
    )
  }

  async function handleReceberTransferenciasSelecionadas() {
    const selecionadas = transferenciasPendentesArmas.filter(
      (transferencia) => transferenciasSelecionadas.includes(transferencia.id)
    )

    if (selecionadas.length === 0) {
      setErro('Selecione ao menos uma arma para receber.')
      return
    }

    const confirmou = window.confirm(
      `Confirmar o recebimento de ${selecionadas.length} ${
        selecionadas.length === 1 ? 'arma' : 'armas'
      } no ${ehPerfilP4 ? 'P4' : 'Cofre do SVDD'}?`
    )

    if (!confirmou) return

    try {
      setProcessandoRecebimentoEmLote(true)
      setErro('')
      setMensagemSucesso('')

      const falhas = []

      for (const transferencia of selecionadas) {
        try {
          await aceitarTransferencia({
            transferenciaId: transferencia.id,
            user
          })
        } catch (error) {
          falhas.push({ transferencia, error })
        }
      }

      setTransferenciasSelecionadas([])

      await Promise.all([
        carregarTransferenciasPendentesArmas(),
        carregarArmas(),
        carregarResumo()
      ])

      if (falhas.length > 0) {
        setErro(
          `${selecionadas.length - falhas.length} recebida(s) e ${falhas.length} com erro. ` +
          (falhas[0]?.error?.message || 'Confira as pendências restantes.')
        )
      } else {
        setMensagemSucesso(
          `${selecionadas.length} ${
            selecionadas.length === 1 ? 'arma recebida' : 'armas recebidas'
          } com sucesso.`
        )
      }
    } finally {
      setProcessandoRecebimentoEmLote(false)
    }
  }

  async function handleAceitarTransferenciaArma(transferencia) {
    if (!transferencia?.id) return

    const confirmou = window.confirm(
      `Confirmar o recebimento da arma ${
        transferencia?.metadata?.descricao_arma ||
        transferencia?.metadata?.patrimonio ||
        transferencia?.metadata?.numero_serie ||
        transferencia.protocolo
      } no ${ehPerfilP4 ? 'P4' : 'Cofre do SVDD'}?`
    )

    if (!confirmou) return

    try {
      setProcessandoTransferenciaId(transferencia.id)
      setTransferenciasSelecionadas((atuais) =>
        atuais.filter((id) => id !== transferencia.id)
      )
      setErro('')
      setMensagemSucesso('')

      await aceitarTransferencia({
        transferenciaId: transferencia.id,
        user
      })

      setMensagemSucesso(
        `Transferência ${transferencia.protocolo} recebida. ` +
        `A arma agora está ${ehPerfilP4 ? 'na Guarda do P4' : 'no Cofre do SVDD'}.`
      )

      await Promise.all([
        carregarTransferenciasPendentesArmas(),
        carregarArmas(),
        carregarResumo()
      ])
    } catch (error) {
      console.error(
        'Erro ao aceitar transferência de arma:',
        error
      )

      setErro(
        error.message ||
        'Não foi possível receber a arma.'
      )
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function handleRecusarTransferenciaArma(transferencia) {
    if (!transferencia?.id) return

    const motivo = window.prompt(
      `Informe o motivo da recusa da transferência ${transferencia.protocolo}:`
    )

    if (motivo === null) return

    if (!String(motivo).trim()) {
      setErro('Informe o motivo da recusa.')
      return
    }

    try {
      setProcessandoTransferenciaId(transferencia.id)
      setErro('')
      setMensagemSucesso('')

      await recusarTransferencia({
        transferenciaId: transferencia.id,
        motivoRecusa: motivo,
        user
      })

      setMensagemSucesso(
        `Transferência ${transferencia.protocolo} recusada.`
      )

      await carregarTransferenciasPendentesArmas()
    } catch (error) {
      console.error(
        'Erro ao recusar transferência de arma:',
        error
      )

      setErro(
        error.message ||
        'Não foi possível recusar a transferência.'
      )
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function handleTransferirParaSVDD(arma) {
    if (!arma?.id) {
      setErro('Arma inválida para transferência.')
      return
    }

    if (!estaNoP4(arma) || estaNoSVDD(arma)) {
      setErro(
        'Somente armas localizadas no P4 podem ser transferidas para o SVDD.'
      )
      return
    }

    const identificacao =
      [arma.especie, arma.marca, arma.modelo]
        .filter(Boolean)
        .join(' ') ||
      arma.patrimonio ||
      arma.numero_serie ||
      'arma selecionada'

    const confirmou = window.confirm(
      `Deseja enviar ${identificacao} do P4 para o Cofre do SVDD?\n\n` +
      'A movimentação ficará pendente até o aceite do SVDD.'
    )

    if (!confirmou) return

    try {
      setTransferindoArmaId(arma.id)
      setErro('')
      setMensagemSucesso('')

      const transferencia = await criarTransferenciaPendente({
        armaId: arma.id,
        patrimonioId: arma.patrimonio_id || null,
        categoria: 'ARMA',
        quantidade: 1,
        origemTipo: 'SETOR',
        origemCodigo: 'P4',
        origemNome: 'GUARDA DO P4',
        destinoTipo: 'SETOR',
        destinoCodigo: 'SVDD',
        destinoNome: 'COFRE DO SVDD',
        motivo: contextoTransferenciaSVDD ? 'DEVOLUCAO_AO_P4' : 'DISTRIBUICAO_OPERACIONAL',
        observacoes:
          `Envio da arma ${
            arma.patrimonio ||
            arma.numero_serie ||
            arma.id
          } do P4 para o SVDD.`,
        metadata: {
          arma_id: arma.id,
          patrimonio: arma.patrimonio || null,
          numero_serie: arma.numero_serie || null,
          especie: arma.especie || null,
          marca: arma.marca || null,
          modelo: arma.modelo || null
        },
        user
      })

      setMensagemSucesso(
        `Transferência ${transferencia.protocolo} criada. ` +
        'A arma está aguardando recebimento pelo SVDD.'
      )

      setArmaVisualizando(null)

      await Promise.all([
        carregarArmas(),
        carregarResumo()
      ])
    } catch (error) {
      console.error(
        'Erro ao transferir arma para o SVDD:',
        error
      )

      setErro(
        error.message ||
        'Não foi possível criar a transferência da arma.'
      )
    } finally {
      setTransferindoArmaId(null)
    }
  }


  const armasDisponiveisTransferencia = useMemo(() => {
    const termo = normalizarTexto(pesquisaTransferencia)

    return armasResumo.filter((arma) => {
      const estaNaOrigem = contextoTransferenciaSVDD
        ? estaNoSVDD(arma)
        : estaNoP4(arma) && !estaNoSVDD(arma)

      if (!estaNaOrigem) return false
      if (estaCautelada(arma) || estaEmCarga(arma) || estaEmManutencao(arma)) {
        return false
      }

      if (!termo) return true

      const alvo = normalizarTexto([
        arma.patrimonio,
        arma.numero_serie,
        arma.especie,
        arma.marca,
        arma.modelo,
        arma.calibre
      ].filter(Boolean).join(' '))

      return alvo.includes(termo)
    })
  }, [armasResumo, pesquisaTransferencia, contextoTransferenciaSVDD])

  function abrirTransferenciaEmLote() {
    setPesquisaTransferencia('')
    setArmasSelecionadas([])
    setTransferenciaModalAberta(true)
    setErro('')
    setMensagemSucesso('')
  }

  function alternarArmaSelecionada(armaId) {
    setArmasSelecionadas((atuais) =>
      atuais.includes(armaId)
        ? atuais.filter((id) => id !== armaId)
        : [...atuais, armaId]
    )
  }

  function selecionarTodasVisiveis() {
    const ids = armasDisponiveisTransferencia.map((arma) => arma.id)
    const todasSelecionadas =
      ids.length > 0 && ids.every((id) => armasSelecionadas.includes(id))

    setArmasSelecionadas((atuais) => {
      if (todasSelecionadas) {
        return atuais.filter((id) => !ids.includes(id))
      }

      return Array.from(new Set([...atuais, ...ids]))
    })
  }

  async function confirmarTransferenciaEmLote() {
    const selecionadas = armasResumo.filter((arma) =>
      armasSelecionadas.includes(arma.id)
    )

    if (selecionadas.length === 0) {
      setErro('Selecione ao menos uma arma para transferir.')
      return
    }

    const confirmou = window.confirm(
      `${contextoTransferenciaSVDD ? 'Devolver' : 'Enviar'} ${selecionadas.length} ${selecionadas.length === 1 ? 'arma' : 'armas'} ${contextoTransferenciaSVDD ? 'do Cofre do SVDD para o P4' : 'do P4 para o Cofre do SVDD'}?\n\n` +
      `Cada arma ficará pendente até o aceite do ${codigoDestinoTransferencia}.`
    )

    if (!confirmou) return

    try {
      setEnviandoLote(true)
      setErro('')
      setMensagemSucesso('')

      const resultados = []

      for (const arma of selecionadas) {
        const transferencia = await criarTransferenciaPendente({
          armaId: arma.id,
          patrimonioId: arma.patrimonio_id || null,
          categoria: 'ARMA',
          quantidade: 1,
          origemTipo: 'SETOR',
          origemCodigo: codigoOrigemTransferencia,
          origemNome: nomeOrigemTransferencia,
          destinoTipo: 'SETOR',
          destinoCodigo: codigoDestinoTransferencia,
          destinoNome: nomeDestinoTransferencia,
          motivo: contextoTransferenciaSVDD ? 'DEVOLUCAO_AO_P4' : 'DISTRIBUICAO_OPERACIONAL',
          observacoes: `${contextoTransferenciaSVDD ? 'Devolução' : 'Envio'} em lote da arma ${arma.patrimonio || arma.numero_serie || arma.id} ${contextoTransferenciaSVDD ? 'do SVDD para o P4' : 'do P4 para o SVDD'}.`,
          metadata: {
            arma_id: arma.id,
            patrimonio: arma.patrimonio || null,
            numero_serie: arma.numero_serie || null,
            especie: arma.especie || null,
            marca: arma.marca || null,
            modelo: arma.modelo || null,
            lote_operacional: true
          },
          user
        })

        resultados.push(transferencia)
      }

      setTransferenciaModalAberta(false)
      setArmasSelecionadas([])
      setMensagemSucesso(
        `${resultados.length} ${resultados.length === 1 ? 'arma foi movimentada' : 'armas foram movimentadas'} para o ${codigoDestinoTransferencia} e ${resultados.length === 1 ? 'está' : 'estão'} aguardando aceite.`
      )

      await Promise.all([
        carregarArmas(),
        carregarResumo(),
        carregarTransferenciasPendentesArmas()
      ])
    } catch (error) {
      console.error('Erro ao transferir armas em lote:', error)
      setErro(
        error.message ||
        'Não foi possível concluir a transferência das armas selecionadas.'
      )
    } finally {
      setEnviandoLote(false)
    }
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) =>
        prev === 'asc' ? 'desc' : 'asc'
      )

      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function indicadorOrdenacao(campo) {
    if (sortBy !== campo) return ''

    return sortDirection === 'asc'
      ? ' ↑'
      : ' ↓'
  }


  return (
    <main className="armas-page">
      <header className="armas-header">
        <div>
          <span className="armas-kicker">
            Gestão Patrimonial
          </span>

          <h1>Armas</h1>

          <p>
            Cadastro, consulta e controle do
            armamento institucional e particular.
          </p>
        </div>

        <button
          type="button"
          className="armas-btn-primary"
          onClick={abrirNovoCadastro}
        >
          Nova arma
        </button>
      </header>

      {erro && (
        <div className="armas-alert-error">
          {erro}
        </div>
      )}

      {mensagemSucesso && (
        <div
          role="status"
          style={{
            marginBottom: '18px',
            padding: '14px 16px',
            border: '1px solid #86efac',
            borderRadius: '12px',
            background: '#f0fdf4',
            color: '#166534',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          {mensagemSucesso}
        </div>
      )}


      <section className="armas-dashboard-section">
        <div className="armas-section-title">
          <div>
            <span>Visão estratégica</span>
            <h2>Carga patrimonial de armas</h2>
          </div>

          {loadingResumo && <small>Atualizando indicadores...</small>}
        </div>

        <div className="armas-resumo-grid">
          <ArmaResumoCard
            titulo="Total de armas"
            valor={resumo.total}
            descricao="Armamento institucional e particular"
            destaque="azul"
            onClick={limparFiltros}
          />

          <ArmaResumoCard
            titulo="Depósito do P4"
            valor={resumo.p4}
            descricao="Armas disponíveis ou recolhidas no P4"
            destaque="verde"
            onClick={() => {
              setFiltros((prev) => ({ ...prev, pesquisa: '', status: 'RESERVA' }))
              setPagina(1)
            }}
          />

          <ArmaResumoCard
            titulo="Cofre do SVDD"
            valor={resumo.svdd}
            descricao="Armas sob guarda operacional do Serviço de Dia"
            destaque="roxo"
            onClick={() => {
              setFiltros((prev) => ({
                ...prev,
                pesquisa: 'SVDD',
                status: ''
              }))
              setPagina(1)
            }}
          />

          <ArmaResumoCard
            titulo="Carga permanente"
            valor={resumo.carga}
            descricao="Armas vinculadas permanentemente"
            destaque="azul"
            onClick={() => {
              setFiltros((prev) => ({ ...prev, pesquisa: '', status: 'CARGA' }))
              setPagina(1)
            }}
          />

          <ArmaResumoCard
            titulo="Cautelas ativas"
            valor={resumo.cautelas}
            descricao="Armas entregues temporariamente"
            destaque="amarelo"
            onClick={() => {
              setFiltros((prev) => ({ ...prev, pesquisa: '', status: 'CAUTELADO' }))
              setPagina(1)
            }}
          />

          <ArmaResumoCard
            titulo="Manutenção"
            valor={resumo.manutencao}
            descricao="Armas fora de disponibilidade para reparo"
            destaque="laranja"
            onClick={() => {
              setFiltros((prev) => ({ ...prev, pesquisa: 'MANUTENÇÃO', status: '' }))
              setPagina(1)
            }}
          />

                    <ArmaResumoCard
            titulo="Não localizadas"
            valor={resumo.naoLocalizadas}
            descricao="Registros que exigem conferência"
            destaque="vermelho"
            onClick={() => {
              setFiltros((prev) => ({
                ...prev,
                pesquisa: 'NÃO LOCALIZADA',
                status: ''
              }))
              setPagina(1)
            }}
          />

          <ArmaResumoCard
            titulo="Apreendidas"
            valor={resumo.apreendidas}
            descricao="Armas apreendidas"
            destaque="vermelho"
            onClick={() => {
              setFiltros((prev) => ({
                ...prev,
                pesquisa: '',
                status: 'APREENDIDO'
              }))
              setPagina(1)
            }}
          />

          <ArmaResumoCard
            titulo="Recolhidas"
            valor={resumo.recolhidas}
            descricao="Armas recolhidas"
            destaque="azul"
            onClick={() => {
              setFiltros((prev) => ({
                ...prev,
                pesquisa: '',
                status: 'RECOLHIDO'
              }))
              setPagina(1)
            }}
          />
        </div>
      </section>

      <section className="armas-dashboard-section armas-graficos-section">
        <div className="armas-section-title">
          <div>
            <span>Painel gráfico</span>
            <h2>Distribuição das armas</h2>
          </div>
        </div>

        <div className="armas-graficos-verticais">
          <GraficoRoscaArmas resumo={resumo} />
          <GraficoBarrasArmas resumo={resumo} />
        </div>
      </section>

      <section className="armas-toolbar">
        <div className="armas-search">
          <label htmlFor="pesquisa">
            Pesquisar
          </label>

          <input
            id="pesquisa"
            name="pesquisa"
            type="search"
            value={filtros.pesquisa}
            onChange={handleFiltroChange}
            placeholder="Nº RE, SÉRIE, PATRIMONIO, NOME"
          />
        </div>

        <div className="armas-filter">
          <label htmlFor="propriedade">
            Propriedade
          </label>

          <select
            id="propriedade"
            name="propriedade"
            value={filtros.propriedade}
            onChange={handleFiltroChange}
          >
            <option value="">Todas</option>

            {propriedadeOptions.map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              )
            )}
          </select>
        </div>

        <div className="armas-filter">
  <label htmlFor="especie">
    Espécie
  </label>

  <select
    id="especie"
    name="especie"
    value={filtros.especie}
    onChange={handleFiltroChange}
  >
    <option value="">
      Todas
    </option>

    {ESPECIES_ARMAS.map((especie) => (
      <option
        key={especie}
        value={especie}
      >
        {especie}
      </option>
    ))}
  </select>
</div>

        <div className="armas-filter">
  <label htmlFor="calibre">
    Calibre
  </label>

  <select
    id="calibre"
    name="calibre"
    value={filtros.calibre}
    onChange={handleFiltroChange}
  >
    <option value="">
      Todos
    </option>

    {CALIBRES_ARMAS.map((calibre) => {
      const valorCalibre =
        typeof calibre === 'string'
          ? calibre
          : calibre?.value || calibre?.label || ''

      const nomeCalibre =
        typeof calibre === 'string'
          ? calibre
          : calibre?.label || calibre?.value || ''

      return (
        <option
          key={valorCalibre}
          value={valorCalibre}
        >
          {nomeCalibre}
        </option>
      )
    })}
  </select>
</div>

        <div className="armas-filter">
          <label htmlFor="status">
            Status
          </label>

          <select
            id="status"
            name="status"
            value={filtros.status}
            onChange={handleFiltroChange}
          >
            <option value="">Todos</option>

            {statusOptions.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="armas-filter">
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

    {UNIDADES_27_BPMM.map((unidade) => (
      <option
        key={unidade}
        value={unidade}
      >
        {unidade}
      </option>
    ))}
  </select>
</div>

        <button
          type="button"
          className="armas-btn-secondary"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="armas-form-area">
          <ArmaForm
            user={user}
            armaEditando={armaEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="armas-dashboard-section armas-operacoes-section">
        <div className="armas-section-title">
          <div>
            <span>Operações permitidas</span>
            <h2>Movimentações patrimoniais</h2>
          </div>
        </div>

        <div className="armas-movement-groups">
          <div className="armas-movement-group">
            <div className="armas-movement-group-header">
              <div className="armas-movement-group-icon">📦</div>
              <div>
                <h3>Distribuir patrimônio</h3>
                <p>Transferências e entregas de armamento.</p>
              </div>
            </div>

            <div className="armas-action-grid">
              <button
                type="button"
                disabled={!podeTransferirArmas}
                onClick={abrirTransferenciaEmLote}
              >
                <strong>{contextoTransferenciaSVDD ? 'Devolver ao P4' : 'Transferir'}</strong>
                <span>{contextoTransferenciaSVDD ? 'Selecionar uma ou várias armas e devolver ao P4' : 'Selecionar uma ou várias armas e enviar ao SVDD'}</span>
              </button>

              <button type="button" disabled>
                <strong>Pagar carga</strong>
                <span>Vincular permanentemente a um policial</span>
              </button>

              <button type="button" disabled>
                <strong>Pagar cautela</strong>
                <span>Entrega temporária com previsão de devolução</span>
              </button>
            </div>
          </div>

          <div className="armas-movement-group">
            <div className="armas-movement-group-header">
              <div className="armas-movement-group-icon">📥</div>
              <div>
                <h3>Receber patrimônio</h3>
                <p>Devoluções e retornos patrimoniais.</p>
              </div>
            </div>

            <div className="armas-action-grid">
              <button type="button" disabled>
                <strong>Receber devolução</strong>
                <span>Encerrar carga ou cautela e receber a arma</span>
              </button>

              <button type="button" disabled>
                <strong>Receber manutenção</strong>
                <span>Registrar retorno do armamento reparado</span>
              </button>

              <button
                type="button"
                disabled={!podeReceberTransferencia}
                onClick={() => {
                  setRecebimentoModalAberta(true)
                  carregarTransferenciasPendentesArmas()
                }}
              >
                <strong>{ehPerfilP4 ? 'Receber do SVDD' : 'Receber do P4'}</strong>
                <span>{ehPerfilP4 ? 'Confirmar armamento devolvido pelo SVDD' : 'Confirmar armamento enviado ao Cofre do SVDD'}</span>
              </button>
            </div>
          </div>

          <div className="armas-movement-group">
            <div className="armas-movement-group-header">
              <div className="armas-movement-group-icon">⚙️</div>
              <div>
                <h3>Gestão patrimonial</h3>
                <p>Manutenção, regularização e baixa.</p>
              </div>
            </div>

            <div className="armas-action-grid">
              <button type="button" disabled>
                <strong>Enviar manutenção</strong>
                <span>Registrar saída para reparo</span>
              </button>

              <button type="button" disabled>
                <strong>Regularizar</strong>
                <span>Corrigir localização ou responsabilidade</span>
              </button>

              <button type="button" className="danger" disabled>
                <strong>Baixar patrimônio</strong>
                <span>Encerrar o controle patrimonial da arma</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {recebimentoModalAberta && (
        <div
          className="armas-transferencia-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !processandoTransferenciaId
            ) {
              setRecebimentoModalAberta(false)
            }
          }}
        >
          <section
            className="armas-transferencia-modal"
            role="dialog"
            aria-modal="true"
            aria-label={ehPerfilP4 ? 'Receber armas do SVDD' : 'Receber armas do P4'}
          >
            <header>
              <div>
                <span>Recebimento patrimonial</span>
                <h2>{ehPerfilP4 ? 'SVDD → P4' : 'P4 → Cofre do SVDD'}</h2>
                <p>Confirme ou recuse as armas pendentes de recebimento.</p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                disabled={Boolean(processandoTransferenciaId)}
                onClick={() => setRecebimentoModalAberta(false)}
              >
                ×
              </button>
            </header>

            {transferenciasPendentesArmas.length > 0 && (
              <div className="armas-recebimento-toolbar">
                <button
                  type="button"
                  disabled={
                    Boolean(processandoTransferenciaId) ||
                    processandoRecebimentoEmLote
                  }
                  onClick={selecionarTodasTransferenciasPendentes}
                >
                  {transferenciasPendentesArmas.every((transferencia) =>
                    transferenciasSelecionadas.includes(transferencia.id)
                  )
                    ? 'Desmarcar todas'
                    : 'Selecionar todas'}
                </button>

                <span>
                  {transferenciasSelecionadas.length} selecionada(s)
                </span>
              </div>
            )}

            <div className="armas-transferencia-lista">
              {loadingTransferenciasArmas ? (
                <div className="armas-empty">Atualizando pendências...</div>
              ) : transferenciasPendentesArmas.length === 0 ? (
                <div className="armas-empty">
                  Nenhuma arma pendente de recebimento.
                </div>
              ) : (
                transferenciasPendentesArmas.map((transferencia) => (
                  <div
                    key={transferencia.id}
                    className="armas-transferencia-item armas-recebimento-item"
                  >
                    <label className="armas-recebimento-selecao">
                      <input
                        type="checkbox"
                        checked={transferenciasSelecionadas.includes(transferencia.id)}
                        disabled={
                          Boolean(processandoTransferenciaId) ||
                          processandoRecebimentoEmLote
                        }
                        onChange={() =>
                          alternarTransferenciaSelecionada(transferencia.id)
                        }
                      />

                      <div>
                        <strong>
                          {transferencia?.metadata?.descricao_arma || 'ARMA'}
                        </strong>
                        <span>
                          Protocolo: {transferencia.protocolo} · Patrimônio/Série: {transferencia?.metadata?.patrimonio_arma || transferencia?.metadata?.patrimonio || transferencia?.metadata?.numero_serie_arma || transferencia?.metadata?.numero_serie || '-'}
                        </span>
                        <span>
                          Enviado por: {transferencia.enviado_por_nome || '-'}
                        </span>
                      </div>
                    </label>

                    <div className="armas-actions">
                      <button
                        type="button"
                        disabled={
                          Boolean(processandoTransferenciaId) ||
                          processandoRecebimentoEmLote
                        }
                        onClick={() => handleAceitarTransferenciaArma(transferencia)}
                      >
                        {processandoTransferenciaId === transferencia.id
                          ? 'Processando...'
                          : 'Receber'}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        disabled={
                          Boolean(processandoTransferenciaId) ||
                          processandoRecebimentoEmLote
                        }
                        onClick={() => handleRecusarTransferenciaArma(transferencia)}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <footer>
              <button
                type="button"
                className="armas-btn-secondary"
                disabled={
                  Boolean(processandoTransferenciaId) ||
                  processandoRecebimentoEmLote
                }
                onClick={() => {
                  setTransferenciasSelecionadas([])
                  setRecebimentoModalAberta(false)
                }}
              >
                Fechar
              </button>

              <button
                type="button"
                className="armas-btn-primary"
                disabled={
                  transferenciasSelecionadas.length === 0 ||
                  Boolean(processandoTransferenciaId) ||
                  processandoRecebimentoEmLote
                }
                onClick={handleReceberTransferenciasSelecionadas}
              >
                {processandoRecebimentoEmLote
                  ? 'Recebendo...'
                  : `Receber ${transferenciasSelecionadas.length || ''}`.trim()}
              </button>
            </footer>
          </section>
        </div>
      )}

      {transferenciaModalAberta && (
        <div
          className="armas-transferencia-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !enviandoLote) {
              setTransferenciaModalAberta(false)
            }
          }}
        >
          <section
            className="armas-transferencia-modal"
            role="dialog"
            aria-modal="true"
            aria-label={contextoTransferenciaSVDD ? "Devolver armas ao P4" : "Transferir armas para o SVDD"}
          >
            <header>
              <div>
                <span>Transferência patrimonial</span>
                <h2>{contextoTransferenciaSVDD ? 'Cofre do SVDD → P4' : 'P4 → Cofre do SVDD'}</h2>
                <p>Pesquise e selecione uma ou várias armas.</p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                disabled={enviandoLote}
                onClick={() => setTransferenciaModalAberta(false)}
              >×</button>
            </header>

            <div className="armas-transferencia-toolbar">
              <input
                type="search"
                value={pesquisaTransferencia}
                onChange={(event) => setPesquisaTransferencia(event.target.value)}
                placeholder="Pesquisar patrimônio, série, espécie, marca ou modelo"
              />
              <button type="button" onClick={selecionarTodasVisiveis}>
                Selecionar visíveis
              </button>
            </div>

            <div className="armas-transferencia-contador">
              <strong>{armasSelecionadas.length}</strong>
              <span>{armasSelecionadas.length === 1 ? 'arma selecionada' : 'armas selecionadas'}</span>
            </div>

            <div className="armas-transferencia-lista">
              {armasDisponiveisTransferencia.length === 0 ? (
                <div className="armas-empty">Nenhuma arma disponível no {contextoTransferenciaSVDD ? 'SVDD' : 'P4'}.</div>
              ) : armasDisponiveisTransferencia.map((arma) => (
                <label key={arma.id} className="armas-transferencia-item">
                  <input
                    type="checkbox"
                    checked={armasSelecionadas.includes(arma.id)}
                    onChange={() => alternarArmaSelecionada(arma.id)}
                  />
                  <div>
                    <strong>
                      {[arma.especie, arma.marca, arma.modelo].filter(Boolean).join(' ') || 'Arma'}
                    </strong>
                    <span>
                      Patrimônio: {arma.patrimonio || '-'} · Série: {arma.numero_serie || '-'} · Calibre: {arma.calibre || '-'}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <footer>
              <button
                type="button"
                className="armas-btn-secondary"
                disabled={enviandoLote}
                onClick={() => setTransferenciaModalAberta(false)}
              >Cancelar</button>
              <button
                type="button"
                className="armas-btn-primary"
                disabled={enviandoLote || armasSelecionadas.length === 0}
                onClick={confirmarTransferenciaEmLote}
              >
                {enviandoLote
                  ? 'Enviando...'
                  : `${contextoTransferenciaSVDD ? 'Devolver' : 'Enviar'} ${armasSelecionadas.length || ''} para o ${codigoDestinoTransferencia}`}
              </button>
            </footer>
          </section>
        </div>
      )}

      <section className="armas-list-card">
        <div className="armas-list-header">
          <div>
            <h2>Armamento cadastrado</h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="armas-empty">
            Carregando armas...
          </div>
        ) : armas.length === 0 ? (
          <div className="armas-empty">
            Nenhuma arma encontrada.
          </div>
        ) : (
          <div className="armas-table-wrap">
            <table className="armas-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar('propriedade')
                      }
                    >
                      Propriedade
                      {indicadorOrdenacao(
                        'propriedade'
                      )}
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar('patrimonio')
                      }
                    >
                      Patrimônio
                      {indicadorOrdenacao(
                        'patrimonio'
                      )}
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar('numero_serie')
                      }
                    >
                      Número de série
                      {indicadorOrdenacao(
                        'numero_serie'
                      )}
                    </button>
                  </th>

                  <th>Espécie</th>
                  <th>Marca / Modelo</th>
                  <th>Calibre</th>

                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar(
                          'status_operacional'
                        )
                      }
                    >
                      Status
                      {indicadorOrdenacao(
                        'status_operacional'
                      )}
                    </button>
                  </th>

                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {armas.map((arma) => (
                  <tr key={arma.id}>
                    <td>
                      <span
                        className={
                          arma.propriedade ===
                          'PARTICULAR'
                            ? 'armas-badge particular'
                            : 'armas-badge pmesp'
                        }
                      >
                        {arma.propriedade ||
                          'PMESP'}
                      </span>
                    </td>

                    <td>
                      {arma.patrimonio || '-'}
                    </td>

                    <td>
                      {arma.numero_serie || '-'}
                    </td>

                    <td>
                      {arma.especie || '-'}
                    </td>

                    <td>
                      {[arma.marca, arma.modelo]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>

                    <td>
                      {arma.calibre || '-'}
                    </td>

                    <td>
                      <span className="armas-status">
                        {arma.status_operacional ||
                          arma.status ||
                          '-'}
                      </span>
                    </td>

                    <td>
                      <div className="armas-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setArmaVisualizando(
                              arma
                            )
                          }
                        >
                          Ver
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            abrirEdicao(arma)
                          }
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            handleExcluir(arma)
                          }
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="armas-pagination">
          <button
            type="button"
            disabled={pagina <= 1 || loading}
            onClick={() =>
              setPagina((prev) =>
                Math.max(1, prev - 1)
              )
            }
          >
            Anterior
          </button>

          <span>
            Página {pagina} de {totalPaginas}
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

      {armaVisualizando && (
        <div
          className="armas-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setArmaVisualizando(null)
            }
          }}
        >
          <section
            className="armas-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da arma"
          >
            <header>
              <div>
                <span>
                  {armaVisualizando.propriedade ||
                    'PMESP'}
                </span>

                <h2>
                  {armaVisualizando.patrimonio ||
                    armaVisualizando.numero_serie ||
                    'Arma'}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setArmaVisualizando(null)
                }
              >
                ×
              </button>
            </header>

            
            <div className="armas-modal-grid">
              <Info
                label="Número de série"
                value={
                  armaVisualizando.numero_serie
                }
              />

              <Info
                label="Espécie"
                value={armaVisualizando.especie}
              />

              <Info
                label="Marca"
                value={armaVisualizando.marca}
              />

              <Info
                label="Modelo"
                value={armaVisualizando.modelo}
              />

              <Info
                label="Calibre"
                value={armaVisualizando.calibre}
              />

              <Info
                label="Acabamento"
                value={
                  armaVisualizando.acabamento
                }
              />

              <Info
                label="Unidade"
                value={armaVisualizando.unidade}
              />

              <Info
                label="Status"
                value={
                  armaVisualizando.status_operacional ||
                  armaVisualizando.status
                }
              />

              {armaVisualizando.propriedade ===
                'PARTICULAR' && (
                <>
                  <Info
                    label="Número SIGMA"
                    value={
                      armaVisualizando.numero_sigma
                    }
                  />

                  <Info
                    label="Número do registro"
                    value={
                      armaVisualizando.numero_registro
                    }
                  />

                  <Info
                    label="Validade do registro"
                    value={
                      armaVisualizando.validade_registro
                    }
                  />

                  <Info
                    label="Comprimento do cano"
                    value={
                      armaVisualizando.comprimento_cano
                    }
                  />

                  <Info
                    label="Capacidade"
                    value={
                      armaVisualizando.capacidade
                    }
                  />

                  <Info
                    label="País de fabricação"
                    value={
                      armaVisualizando.pais_fabricacao
                    }
                  />

                  <Info
                    label="Ano de fabricação"
                    value={
                      armaVisualizando.ano_fabricacao
                    }
                  />

                  <Info
                    label="Proprietário"
                    value={
                      armaVisualizando.proprietario_nome
                    }
                  />

                  <Info
                    label="RE do proprietário"
                    value={
                      armaVisualizando.proprietario_re
                    }
                  />

                  <Info
                    label="Situação documental"
                    value={
                      armaVisualizando.situacao_documental
                    }
                  />
                </>
              )}
            </div>

           <div className="armas-modal-galeria">
  <div className="armas-modal-galeria-header">
    <strong>Fotos da arma</strong>

    {fotosVisualizacao.length > 0 && (
      <span>
        {fotosVisualizacao.length}{' '}
        {fotosVisualizacao.length === 1
          ? 'foto'
          : 'fotos'}
      </span>
    )}
  </div>

  {loadingFotosVisualizacao ? (
    <div className="armas-modal-sem-foto">
      Carregando fotos...
    </div>
  ) : !fotoSelecionadaVisualizacao ? (
    <div className="armas-modal-sem-foto">
      Nenhuma foto cadastrada.
    </div>
  ) : (
    <>
      <div className="armas-modal-foto-destaque">
        <img
          src={fotoSelecionadaVisualizacao.url}
          alt={`Foto da arma ${
            armaVisualizando?.patrimonio ||
            armaVisualizando?.numero_serie ||
            ''
          }`}
        />

        {fotoSelecionadaVisualizacao.principal && (
          <span className="armas-modal-selo-principal">
            Foto principal
          </span>
        )}

        <button
          type="button"
          className="armas-modal-ampliar"
          onClick={() =>
            window.open(
              fotoSelecionadaVisualizacao.url,
              '_blank',
              'noopener,noreferrer'
            )
          }
        >
          Ampliar
        </button>
      </div>

      {fotosVisualizacao.length > 1 && (
        <div className="armas-modal-miniaturas">
          {fotosVisualizacao.map((foto) => (
            <button
              key={foto.id}
              type="button"
              className={
                fotoSelecionadaVisualizacao.id === foto.id
                  ? 'ativa'
                  : ''
              }
              onClick={() =>
                setFotoSelecionadaVisualizacao(foto)
              }
            >
              <img
                src={foto.url}
                alt="Miniatura da arma"
              />

              {foto.principal && (
                <span>Principal</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  )}
</div>

            <div className="armas-modal-observacoes">
              <strong>Observações</strong>

              <p>
                {armaVisualizando.observacoes ||
                  'Sem observações.'}
              </p>
            </div>

            <footer>
              <button
                type="button"
                className="armas-btn-secondary"
                onClick={() =>
                  setArmaVisualizando(null)
                }
              >
                Fechar
              </button>

              <button
                type="button"
                className="armas-btn-primary"
                onClick={() => {
                  const arma =
                    armaVisualizando

                  setArmaVisualizando(null)
                  abrirEdicao(arma)
                }}
              >
                Editar
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}

function Info({ label, value }) {
  return (
    <div className="armas-info">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}