import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import { STATUS_HT, TIPOS_HT } from '../../constants/hts'
import { UNIDADES_27_BPMM } from '../../constants/unidades'

import HTForm from './components/HTForm'
import HTTable from './components/HTTable'
import HTManutencaoModal from './components/HTManutencaoModal'
import HTRetornoManutencaoModal from './components/HTRetornoManutencaoModal'
import HTBaixaModal from './components/HTBaixaModal'
import HTAprovacoesModal from './components/HTAprovacoesModal'
import HTOperacaoModal from './components/HTOperacaoModal'
import HTDetalhesModal from './components/HTDetalhesModal'

import { enviarHTParaManutencao, excluirHT, listarHTs } from '../../services/htsService'
import { listarFotosHT } from '../../services/htsFotosService'
import { concluirManutencao, listarFotosManutencao, listarManutencoes } from '../../services/manutencoesService'
import {
  aceitarTransferenciaHT,
  cancelarTransferenciaHT,
  criarTransferenciaHTPendente,
  listarTransferenciasHTCriadasPendentes,
  listarTransferenciasHTPendentes,
  recusarTransferenciaHT
} from '../../services/htsTransferenciaService'
import { decidirBaixaHT, listarSolicitacoesBaixa, solicitarBaixaHT } from '../../services/patrimonioBaixasService'
import { listarPoliciais } from '../../services/policiaisService'
import {
  listarEntregasHTAtivas,
  pagarCargaHT,
  pagarCautelaHT,
  receberDevolucaoHT,
  regularizarCautelaHT
} from '../../services/htsOperacoesService'

import './styles/HT.css'
import './styles/HTBaixaModal.css'

const LIMITE = 20
const LIMITE_RESUMO = 5000
const statusOptions = STATUS_HT
const tipoOptions = TIPOS_HT

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

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function formatarStatus(valor) {
  const nomes = {
    RESERVA: 'Reserva',
    EM_SERVICO: 'Em serviço',
    MANUTENCAO: 'Manutenção',
    RECOLHIDO: 'Recolhido',
    BAIXADO: 'Baixado',
    AGUARDANDO_APROVACAO_BAIXA: 'Aguardando aprovação de baixa',
    NAO_LOCALIZADO: 'Não localizado'
  }

  const chave = normalizar(valor).replaceAll(' ', '_')
  return nomes[chave] || String(valor || 'Sem status').replaceAll('_', ' ')
}

function resumirHTs(lista = []) {
  const resumo = {
    total: lista.length,
    p4: 0,
    svdd: 0,
    emServico: 0,
    cargaPermanente: 0,
    cautelas: 0,
    manutencao: 0,
    naoLocalizados: 0,
    recolhidos: 0,
    baixados: 0,
    aguardandoAprovacao: 0,
    outros: 0
  }

  lista.forEach((ht) => {
    const status = normalizar(ht?.status_operacional || ht?.status)
    const local = normalizar(ht?.local_atual)

    if (status === 'AGUARDANDO_APROVACAO_BAIXA') {
      resumo.aguardandoAprovacao += 1
      return
    }

    if (status === 'BAIXADO') {
      resumo.baixados += 1
      return
    }

    if (status === 'MANUTENCAO' || local.includes('MANUTENCAO')) {
      resumo.manutencao += 1
      return
    }

    if (status === 'RECOLHIDO') {
      resumo.recolhidos += 1
      return
    }

    if (
      status.includes('NAO_LOCALIZ') ||
      local.includes('NAO_LOCALIZ') ||
      !local
    ) {
      resumo.naoLocalizados += 1
      return
    }

    if (status.includes('CAUTELA')) {
      resumo.cautelas += 1
      return
    }

    if (status === 'CARGA' || status.includes('CARGA_PERMANENTE')) {
      resumo.cargaPermanente += 1
      return
    }

    if (status === 'EM_SERVICO') {
      // Para o HT, o equipamento em serviço representa uma cautela ativa.
      // Mantemos uma única categoria operacional para evitar contagem duplicada.
      resumo.cautelas += 1
      return
    }

    if (local.includes('SVDD') || local.includes('SERVICO DE DIA')) {
      resumo.svdd += 1
      return
    }

    if (
      status === 'RESERVA' ||
      status === 'DISPONIVEL' ||
      local.includes('P4') ||
      local.includes('DEPOSITO') ||
      local.includes('RESERVA')
    ) {
      resumo.p4 += 1
      return
    }

    resumo.outros += 1
  })

  return resumo
}


function correspondeAoResumo(ht, tipo) {
  const status = normalizar(ht?.status_operacional || ht?.status)
  const local = normalizar(ht?.local_atual)

  if (tipo === 'TOTAL') return true

  if (tipo === 'P4') {
    return (
      status === 'RESERVA' ||
      status === 'DISPONIVEL' ||
      local.includes('P4') ||
      local.includes('DEPOSITO') ||
      local.includes('RESERVA')
    ) && status !== 'MANUTENCAO' && status !== 'BAIXADO'
  }

  if (tipo === 'SVDD') {
    return (
      local.includes('SVDD') ||
      local.includes('SERVICO DE DIA')
    ) && status !== 'MANUTENCAO' && status !== 'BAIXADO'
  }

  if (tipo === 'CARGA') {
    return status === 'CARGA' || status.includes('CARGA_PERMANENTE')
  }

  if (tipo === 'CAUTELA') {
    return status === 'EM_SERVICO' || status.includes('CAUTELA')
  }

  if (tipo === 'MANUTENCAO') {
    return status === 'MANUTENCAO' || local.includes('MANUTENCAO')
  }

  if (tipo === 'BAIXADO') return status === 'BAIXADO'

  if (tipo === 'AGUARDANDO_APROVACAO') return status === 'AGUARDANDO_APROVACAO_BAIXA'

  if (tipo === 'NAO_LOCALIZADO') {
    return (
      status.includes('NAO_LOCALIZ') ||
      local.includes('NAO_LOCALIZ') ||
      !local
    )
  }

  return false
}

function pertenceAoEscopoSVDD(ht) {
  const status = normalizar(ht?.status_operacional || ht?.status)
  const camposEscopo = [
    ht?.local_atual,
    ht?.local_anterior,
    ht?.origem_manutencao,
    ht?.guardiao_anterior,
    ht?.responsavel_atual,
    ht?.unidade
  ].map(normalizar)

  if (camposEscopo.some((valor) => valor.includes('SVDD') || valor.includes('SERVICO DE DIA'))) {
    return true
  }

  // Sem uma referência explícita ao SVDD, o item não pertence ao escopo
  // operacional desse perfil. Isso evita exibir cautelas ou cargas originadas no P4.
  return false
}


function percentual(valor, total) {
  if (!Number(total)) return 0
  return Math.max(0, Math.min(100, (Number(valor || 0) / Number(total)) * 100))
}

function GraficoRoscaHT({ total, itens }) {
  let acumulado = 0
  const segmentos = itens.map((item) => {
    const inicio = acumulado
    acumulado += percentual(item.valor, total)
    return `${item.cor} ${inicio}% ${acumulado}%`
  })

  if (acumulado < 100) segmentos.push(`#e8edf4 ${acumulado}% 100%`)

  return (
    <section className="ht-chart-card ht-chart-donut-card">
      <div className="ht-chart-header">
        <div>
          <span>Distribuição patrimonial</span>
          <h2>Situação dos rádios HT</h2>
        </div>
      </div>

      <div className="ht-chart-donut-layout">
        <div
          className="ht-chart-donut"
          style={{ background: `conic-gradient(${segmentos.join(', ')})` }}
          aria-label={`Total de ${total} HTs`}
        >
          <div>
            <strong>{Number(total || 0).toLocaleString('pt-BR')}</strong>
            <span>TOTAL</span>
          </div>
        </div>

        <div className="ht-chart-legend">
          {itens.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.cor }} />
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
              <small>{percentual(item.valor, total).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GraficoBarrasHT({ total, itens }) {
  const maior = Math.max(1, ...itens.map((item) => Number(item.valor || 0)))

  return (
    <section className="ht-chart-card ht-chart-bars-card">
      <div className="ht-chart-header">
        <div>
          <span>Visão comparativa</span>
          <h2>HTs por local e situação</h2>
        </div>
      </div>

      <div className="ht-chart-bars">
        {itens.map((item) => (
          <div className="ht-chart-bar-item" key={item.label}>
            <div className="ht-chart-bar-value">{item.valor}</div>
            <div className="ht-chart-bar-track">
              <i
                style={{
                  height: `${Math.max(item.valor ? 9 : 2, (Number(item.valor || 0) / maior) * 100)}%`,
                  background: item.cor
                }}
              />
            </div>
            <strong>{item.label}</strong>
            <small>{percentual(item.valor, total).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function ResumoCard({ titulo, valor, detalhe, tone = 'blue', ativo = false, onClick }) {
  const Tag = onClick ? 'button' : 'article'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ht-summary-card ht-summary-${tone}${ativo ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="ht-summary-label">{titulo}</span>
      <strong>{Number(valor || 0).toLocaleString('pt-BR')}</strong>
      <small>{detalhe}</small>
    </Tag>
  )
}

function GrupoOperacao({ icone, titulo, descricao, className = '', children }) {
  return (
    <div className={`ht-operation-group${className ? ` ${className}` : ''}`}>
      <div className="ht-operation-group-header">
        <div className="ht-operation-group-icon" aria-hidden="true">
          {icone}
        </div>

        <div>
          <h3>{titulo}</h3>
          <p>{descricao}</p>
        </div>
      </div>

      <div className="ht-operation-actions">
        {children}
      </div>
    </div>
  )
}


export default function HT({ user }) {
  const [hts, setHTs] = useState([])
  const [todosHTs, setTodosHTs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [erro, setErro] = useState('')

  const [formAberto, setFormAberto] = useState(false)
  const [htEditando, setHTEditando] = useState(null)
  const [htVisualizando, setHTVisualizando] = useState(null)
  const [htManutencao, setHTManutencao] = useState(null)
  const [retornoManutencao, setRetornoManutencao] = useState(null)
  const [salvandoRetorno, setSalvandoRetorno] = useState(false)
  const [salvandoManutencao, setSalvandoManutencao] = useState(false)
  const [seletorManutencaoAberto, setSeletorManutencaoAberto] = useState(false)
  const [buscaSeletorManutencao, setBuscaSeletorManutencao] = useState('')
  const [transferenciaModalAberta, setTransferenciaModalAberta] = useState(false)
  const [destinoTransferenciaSelecionado, setDestinoTransferenciaSelecionado] = useState('')
  const [destinoTransferenciaOutro, setDestinoTransferenciaOutro] = useState('')
  const [cancelamentoTransferenciaModalAberto, setCancelamentoTransferenciaModalAberto] = useState(false)
  const [transferenciasCancelaveis, setTransferenciasCancelaveis] = useState([])
  const [loadingTransferenciasCancelaveis, setLoadingTransferenciasCancelaveis] = useState(false)
  const [recebimentoModalAberta, setRecebimentoModalAberta] = useState(false)
  const [pesquisaTransferencia, setPesquisaTransferencia] = useState('')
  const [htsSelecionadosTransferencia, setHTsSelecionadosTransferencia] = useState([])
  const [transferenciasPendentes, setTransferenciasPendentes] = useState([])
  const [loadingTransferencias, setLoadingTransferencias] = useState(false)
  const [processandoTransferenciaId, setProcessandoTransferenciaId] = useState(null)
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [resumoModal, setResumoModal] = useState(null)
  const [buscaResumoModal, setBuscaResumoModal] = useState('')
  const [baixaModalAberta, setBaixaModalAberta] = useState(false)
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)
  const [aprovacoesModalAberta, setAprovacoesModalAberta] = useState(false)
  const [solicitacoesBaixa, setSolicitacoesBaixa] = useState([])
  const [loadingAprovacoes, setLoadingAprovacoes] = useState(false)
  const [processandoAprovacaoId, setProcessandoAprovacaoId] = useState(null)
  const [operacaoModal, setOperacaoModal] = useState(null)
  const [salvandoOperacao, setSalvandoOperacao] = useState(false)
  const [policiaisOperacao, setPoliciaisOperacao] = useState([])
  const [entregasAtivas, setEntregasAtivas] = useState([])

  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [erroFotos, setErroFotos] = useState('')

  const [sortBy, setSortBy] = useState('criado_em')
  const [sortDirection, setSortDirection] = useState('desc')
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false)

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo_ht: '',
    marca: '',
    modelo: '',
    status_operacional: '',
    unidade: ''
  })

  const perfilUsuario = normalizar(
    user?.perfil || user?.role || user?.tipo_usuario || user?.user_metadata?.perfil || ''
  )

  const ehPerfilP4 = ['P4', 'SECAO P4', 'SEÇÃO P4', 'GESTOR PATRIMONIAL'].includes(perfilUsuario)
  const ehPerfilSVDD = ['SVDD', 'ENCARREGADO SVDD', 'ENCARREGADO DO SVDD', 'AUXILIAR SVDD', 'AUXILIAR DO SVDD'].includes(perfilUsuario)
  const ehPerfilGestor = ['ADMINISTRADOR', 'COMANDANTE DE CIA', 'COMANDANTE DA CIA', 'COMANDANTE'].includes(perfilUsuario)
  const podeMovimentarHT = ehPerfilP4 || ehPerfilSVDD || ehPerfilGestor
  const contextoOrigemSVDD = ehPerfilSVDD
  const origemTransferencia = contextoOrigemSVDD ? 'SVDD' : 'P4'
  const destinoTransferencia = contextoOrigemSVDD
    ? 'P4'
    : destinoTransferenciaSelecionado

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const resumo = useMemo(() => resumirHTs(todosHTs), [todosHTs])

  const htsDisponiveisOperacao = useMemo(() => {
    return todosHTs.filter((ht) => {
      const status = normalizar(ht?.status_operacional)
      const local = normalizar(ht?.local_atual)
      if (ht?.ativo === false || ['MANUTENCAO', 'BAIXADO', 'CARGA', 'EM_SERVICO', 'AGUARDANDO_APROVACAO_BAIXA'].includes(status)) return false
      if (ehPerfilSVDD) return local.includes('SVDD') || local.includes('SERVICO DE DIA')
      if (ehPerfilP4) return local.includes('P4') || local.includes('DEPOSITO') || local.includes('GUARDA')
      return true
    })
  }, [todosHTs, ehPerfilSVDD, ehPerfilP4])

  const itensResumoModal = useMemo(() => {
    if (!resumoModal?.tipo) return []

    const termo = normalizar(buscaResumoModal)

    return todosHTs
      .filter((ht) => correspondeAoResumo(ht, resumoModal.tipo))
      .filter((ht) => !ehPerfilSVDD || pertenceAoEscopoSVDD(ht))
      .filter((ht) => {
        if (!termo) return true

        return [
          ht?.patrimonio,
          ht?.numero_serie,
          ht?.marca,
          ht?.modelo,
          ht?.local_atual,
          ht?.unidade,
          ht?.status_operacional
        ].some((valor) => normalizar(valor).includes(termo))
      })
  }, [todosHTs, resumoModal, buscaResumoModal, ehPerfilSVDD])

  const dadosGrafico = useMemo(() => {
    if (ehPerfilSVDD) {
      return [
        { label: 'Cofre do SVDD', valor: resumo.svdd, cor: '#3b82f6' },
        { label: 'Cautelas ativas', valor: resumo.cautelas, cor: '#eab308' },
        { label: 'Manutenção', valor: resumo.manutencao, cor: '#ef4444' },
        { label: 'Não localizados', valor: resumo.naoLocalizados, cor: '#dc2626' }
      ]
    }

    return [
      { label: 'Depósito do P4', valor: resumo.p4, cor: '#22c55e' },
      { label: 'Cofre do SVDD', valor: resumo.svdd, cor: '#3b82f6' },
      { label: 'Carga permanente', valor: resumo.cargaPermanente, cor: '#f97316' },
      { label: 'Cautelas ativas', valor: resumo.cautelas, cor: '#eab308' },
      { label: 'Manutenção', valor: resumo.manutencao, cor: '#ef4444' },
      { label: 'Não localizados', valor: resumo.naoLocalizados, cor: '#dc2626' },
      { label: 'Outras situações', valor: resumo.recolhidos + resumo.outros, cor: '#64748b' }
    ]
  }, [ehPerfilSVDD, resumo])

  const totalGrafico = useMemo(
    () => dadosGrafico.reduce((soma, item) => soma + Number(item.valor || 0), 0),
    [dadosGrafico]
  )

  const htsElegiveisManutencao = useMemo(() => {
  const termo = normalizar(buscaSeletorManutencao)

  return todosHTs
    .filter((ht) => {
      const status = normalizar(ht?.status_operacional)
      const local = normalizar(ht?.local_atual)

      // Nunca listar equipamentos indisponíveis
      if (
        ht?.ativo === false ||
        status === 'MANUTENCAO' ||
        status === 'BAIXADO'
      ) {
        return false
      }

      // SVDD só pode enviar para manutenção HTs que estão no Cofre do SVDD
      if (ehPerfilSVDD) {
        return (
          local.includes('SVDD') ||
          local.includes('SERVICO DE DIA')
        )
      }

      // P4 vê apenas os HTs que estão sob responsabilidade do P4
      if (ehPerfilP4) {
        return (
          local.includes('P4') ||
          local.includes('DEPOSITO')
        )
      }

      // Administrador / Comandante visualizam todos
      return true
    })
    .filter((ht) => {
      if (!termo) return true

      return [
        ht?.patrimonio,
        ht?.numero_serie,
        ht?.marca,
        ht?.modelo,
        ht?.unidade,
        ht?.local_atual
      ].some((valor) => normalizar(valor).includes(termo))
    })
    .slice(0, 100)
}, [
  todosHTs,
  buscaSeletorManutencao,
  ehPerfilSVDD,
  ehPerfilP4
])

  const htsDisponiveisTransferencia = useMemo(() => {
    const termo = normalizar(pesquisaTransferencia)

    return todosHTs.filter((ht) => {
      const local = normalizar(ht?.local_atual)
      const status = normalizar(ht?.status_operacional)
      const estaNaOrigem = origemTransferencia === 'P4'
        ? local.includes('P4') || local.includes('DEPOSITO') || local.includes('GUARDA')
        : local.includes('SVDD') || local.includes('SERVICO DE DIA')

      if (!estaNaOrigem || ['MANUTENCAO', 'BAIXADO', 'CAUTELADO', 'CARGA'].includes(status)) return false
      if (!termo) return true

      return [ht.patrimonio, ht.numero_serie, ht.marca, ht.modelo, ht.unidade]
        .some((valor) => normalizar(valor).includes(termo))
    })
  }, [todosHTs, pesquisaTransferencia, origemTransferencia])

  const htsElegiveisBaixa = useMemo(() => todosHTs.filter((ht) => {
    const status = normalizar(ht?.status_operacional || ht?.status)
    const local = normalizar(ht?.local_atual)
    return ht?.ativo !== false && !['BAIXADO', 'AGUARDANDO_APROVACAO_BAIXA', 'MANUTENCAO'].includes(status) && (local.includes('P4') || local.includes('DEPOSITO'))
  }), [todosHTs])

  const carregarSolicitacoesBaixa = useCallback(async () => {
    try {
      setLoadingAprovacoes(true)
      const itens = await listarSolicitacoesBaixa({ modulo: 'HT', status: 'AGUARDANDO_APROVACAO' })
      setSolicitacoesBaixa(itens)
    } catch (error) {
      console.error('Erro ao carregar solicitações de baixa:', error)
      setErro(error?.message || 'Não foi possível carregar as aprovações pendentes.')
    } finally {
      setLoadingAprovacoes(false)
    }
  }, [])

  const filtrosAtivos = useMemo(
    () => Object.values(filtros).filter((valor) => String(valor || '').trim()).length,
    [filtros]
  )

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true)

      const resultado = await listarHTs({
        pagina: 1,
        limite: LIMITE_RESUMO,
        sortBy: 'criado_em',
        sortDirection: 'desc'
      })

      setTodosHTs(resultado.data || [])
    } catch (error) {
      console.warn('Não foi possível carregar o resumo dos HTs:', error)
    } finally {
      setLoadingResumo(false)
    }
  }, [])

  const carregarHTs = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarHTs({
        filtros: {
          pesquisa: filtros.pesquisa.trim(),
          tipo_ht: filtros.tipo_ht,
          marca: filtros.marca,
          modelo: filtros.modelo,
          status_operacional: filtros.status_operacional,
          unidade: filtros.unidade
        },
        escopo: ehPerfilSVDD ? 'SVDD' : null,
        pagina,
        limite: LIMITE,
        sortBy,
        sortDirection
      })

      setHTs(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao carregar os HTs.')
    } finally {
      setLoading(false)
    }
  }, [filtros, pagina, sortBy, sortDirection, ehPerfilSVDD])

  useEffect(() => {
    carregarHTs()
  }, [carregarHTs])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  useEffect(() => {
    carregarSolicitacoesBaixa()
  }, [carregarSolicitacoesBaixa])

  function handleFiltroChange(event) {
    const { name, value } = event.target
    setFiltros((prev) => ({ ...prev, [name]: value }))
    setPagina(1)
  }

  function aplicarFiltroStatus(status) {
    setFiltros((prev) => ({
      ...prev,
      status_operacional:
        prev.status_operacional === status ? '' : status
    }))
    setPagina(1)
  }

  function limparFiltros() {
    setFiltros({
      pesquisa: '',
      tipo_ht: '',
      marca: '',
      modelo: '',
      status_operacional: '',
      unidade: ''
    })
    setPagina(1)
  }

  function rolarParaFormulario() {
    requestAnimationFrame(() => {
      document.querySelector('.ht-form-area')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }

  function limparVisualizacao() {
    setHTVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirNovoCadastro() {
    setHTEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(ht) {
    setHTEditando(ht)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(ht) {
    setHTVisualizando(ht)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos = await listarFotosHT(ht.id)
      setFotosVisualizacao(Array.isArray(fotos) ? fotos : [])
    } catch (error) {
      console.error('Erro ao carregar fotos do HT:', error)
      setErroFotos(error.message || 'Não foi possível carregar as fotos do HT.')
    } finally {
      setCarregandoFotos(false)
    }
  }

  function fecharVisualizacao() {
    limparVisualizacao()
  }

  function fecharFormulario() {
    setFormAberto(false)
    setHTEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await Promise.all([carregarHTs(), carregarResumo()])
  }

  async function handleExcluir(ht) {
    const identificacao = ht.patrimonio || ht.numero_serie || 'HT'
    const confirmou = window.confirm(`Deseja realmente excluir o HT "${identificacao}"?`)

    if (!confirmou) return

    try {
      await excluirHT(ht.id, user)
      await Promise.all([carregarHTs(), carregarResumo()])
    } catch (error) {
      window.alert(error.message || 'Erro ao excluir o HT.')
    }
  }


  function abrirSeletorManutencao() {
    // Garante que a manutenção nunca seja confundida com a edição cadastral.
    setFormAberto(false)
    setHTEditando(null)
    limparVisualizacao()
    setBuscaSeletorManutencao('')
    setSeletorManutencaoAberto(true)
  }

  function selecionarHTParaManutencao(ht) {
    setSeletorManutencaoAberto(false)
    setBuscaSeletorManutencao('')

    // Manutenção é um fluxo independente do cadastro/edição.
    setFormAberto(false)
    setHTEditando(null)
    limparVisualizacao()

    abrirManutencao(ht)
  }

  function mostrarHTsEmManutencao() {
    aplicarFiltroStatus('MANUTENCAO')

    requestAnimationFrame(() => {
      document.querySelector('.ht-list-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }

  function abrirManutencao(ht) {
    const status = normalizar(ht?.status_operacional)

    if (status === 'MANUTENCAO') {
      window.alert('Este HT já está em manutenção.')
      return
    }

    if (status === 'BAIXADO' || ht?.ativo === false) {
      window.alert('Um HT baixado ou inativo não pode ser enviado para manutenção.')
      return
    }

    setHTManutencao(ht)
  }

  async function confirmarManutencao(dados) {
    if (!htManutencao?.id) return

    try {
      setSalvandoManutencao(true)

      await enviarHTParaManutencao({
        htId: htManutencao.id,
        ...dados,
        user
      })

      setHTManutencao(null)
      await Promise.all([carregarHTs(), carregarResumo()])
      window.alert('HT enviado para manutenção. O P4 foi notificado.')
    } catch (error) {
      console.error('Erro ao enviar HT para manutenção:', error)
      window.alert(error?.message || 'Não foi possível enviar o HT para manutenção.')
    } finally {
      setSalvandoManutencao(false)
    }
  }

  const carregarTransferenciasPendentes = useCallback(async () => {
    if (!podeMovimentarHT) return

    try {
      setLoadingTransferencias(true)
      const destino = ehPerfilP4 ? 'P4' : 'SVDD'
      const resultado = await listarTransferenciasHTPendentes({ destinoCodigo: destino, limite: 100 })
      setTransferenciasPendentes(resultado || [])
    } catch (error) {
      console.error('Erro ao carregar transferências de HT:', error)
      setErro(error?.message || 'Não foi possível carregar as transferências pendentes.')
    } finally {
      setLoadingTransferencias(false)
    }
  }, [podeMovimentarHT, ehPerfilP4])

  useEffect(() => {
    carregarTransferenciasPendentes()
  }, [carregarTransferenciasPendentes])

  function abrirTransferenciaHT() {
    setPesquisaTransferencia('')
    setHTsSelecionadosTransferencia([])
    setDestinoTransferenciaSelecionado(contextoOrigemSVDD ? 'P4' : '')
    setDestinoTransferenciaOutro('')
    setTransferenciaModalAberta(true)
    setMensagemSucesso('')
  }

  async function abrirCancelamentoTransferencia() {
    try {
      setLoadingTransferenciasCancelaveis(true)
      setErro('')
      setCancelamentoTransferenciaModalAberto(true)
      const itens = await listarTransferenciasHTCriadasPendentes({
        origemCodigo: origemTransferencia,
        limite: 200
      })
      setTransferenciasCancelaveis(itens || [])
    } catch (error) {
      console.error('Erro ao carregar transferências canceláveis:', error)
      setErro(error?.message || 'Não foi possível carregar as transferências pendentes.')
      setTransferenciasCancelaveis([])
    } finally {
      setLoadingTransferenciasCancelaveis(false)
    }
  }

  async function cancelarTransferenciaPendente(movimentacao) {
    const motivo = window.prompt('Informe o motivo do cancelamento da transferência:')
    if (!motivo?.trim()) return

    try {
      setProcessandoTransferenciaId(movimentacao.id)
      setErro('')
      await cancelarTransferenciaHT({
        movimentacaoId: movimentacao.id,
        motivo,
        origemCodigo: origemTransferencia,
        user
      })
      setMensagemSucesso('Transferência cancelada. O HT permaneceu no guardião de origem.')
      const itens = await listarTransferenciasHTCriadasPendentes({
        origemCodigo: origemTransferencia,
        limite: 200
      })
      setTransferenciasCancelaveis(itens || [])
      await Promise.all([carregarHTs(), carregarResumo(), carregarTransferenciasPendentes()])
    } catch (error) {
      console.error('Erro ao cancelar transferência:', error)
      setErro(error?.message || 'Não foi possível cancelar a transferência.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  function alternarHTTransferencia(id) {
    setHTsSelecionadosTransferencia((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
    )
  }

  async function confirmarTransferenciaHT() {
    const selecionados = htsDisponiveisTransferencia.filter((ht) => htsSelecionadosTransferencia.includes(ht.id))
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
      setErro('')
      for (const ht of selecionados) {
        await criarTransferenciaHTPendente({
          htId: ht.id,
          origemCodigo: origemTransferencia,
          destinoCodigo: destinoTransferencia,
          destinoNome,
          user
        })
      }

      setMensagemSucesso(`${selecionados.length} HT(s) enviado(s). A movimentação aguarda recebimento em ${destinoNome}.`)
      setTransferenciaModalAberta(false)
      setHTsSelecionadosTransferencia([])
      setDestinoTransferenciaSelecionado('')
      setDestinoTransferenciaOutro('')
      await Promise.all([carregarHTs(), carregarResumo(), carregarTransferenciasPendentes()])
    } catch (error) {
      console.error('Erro ao transferir HT:', error)
      setErro(error?.message || 'Não foi possível transferir o HT.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function receberTransferenciaHT(movimentacao) {
    try {
      setProcessandoTransferenciaId(movimentacao.id)
      setErro('')
      await aceitarTransferenciaHT({ movimentacaoId: movimentacao.id, user })
      setMensagemSucesso('Recebimento do HT confirmado.')
      await Promise.all([carregarHTs(), carregarResumo(), carregarTransferenciasPendentes()])
    } catch (error) {
      setErro(error?.message || 'Não foi possível receber o HT.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function recusarTransferenciaPendente(movimentacao) {
    const motivo = window.prompt('Informe o motivo da recusa:')
    if (!motivo?.trim()) return

    try {
      setProcessandoTransferenciaId(movimentacao.id)
      await recusarTransferenciaHT({ movimentacaoId: movimentacao.id, motivo, user })
      setMensagemSucesso('Transferência recusada.')
      await carregarTransferenciasPendentes()
    } catch (error) {
      setErro(error?.message || 'Não foi possível recusar a transferência.')
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  function abrirResumoModal(tipo, titulo, subtitulo) {
    setBuscaResumoModal('')
    setResumoModal({ tipo, titulo, subtitulo })
  }

  function fecharResumoModal() {
    setResumoModal(null)
    setBuscaResumoModal('')
  }

  async function visualizarHTDoResumo(ht) {
    fecharResumoModal()
    await abrirVisualizacao(ht)
  }

  async function abrirRetornoManutencao(ht) {
    try {
      const resultado = await listarManutencoes({
        modulo: 'HT',
        status: 'EM_MANUTENCAO',
        referenciaId: ht.id,
        pagina: 1,
        limite: 20
      })

      const manutencaoAtiva = (resultado?.data || []).find(
        (item) => String(item.status || '').toUpperCase() === 'EM_MANUTENCAO'
      )

      if (!manutencaoAtiva) {
        window.alert('Não foi encontrada uma manutenção ativa para este HT.')
        return
      }

      setRetornoManutencao({ ht, manutencao: manutencaoAtiva })
    } catch (error) {
      console.error('Erro ao abrir retorno da manutenção:', error)
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
      limparVisualizacao()
      await Promise.all([carregarHTs(), carregarResumo()])
      window.alert('Retorno da manutenção registrado com sucesso.')
    } catch (error) {
      console.error('Erro ao retornar HT da manutenção:', error)
      window.alert(error?.message || 'Não foi possível concluir o retorno da manutenção.')
    } finally {
      setSalvandoRetorno(false)
    }
  }

  async function confirmarSolicitacaoBaixa({ ht, motivo, observacoes, fotos }) {
    try {
      setSalvandoBaixa(true)
      await solicitarBaixaHT({ ht, motivo, observacoes, fotos, user })
      setBaixaModalAberta(false)
      setMensagemSucesso('Solicitação de baixa enviada ao Comandante da Cia.')
      await Promise.all([carregarHTs(), carregarResumo(), carregarSolicitacoesBaixa()])
    } catch (error) {
      console.error('Erro ao solicitar baixa:', error)
      window.alert(error?.message || 'Não foi possível solicitar a baixa do HT.')
    } finally {
      setSalvandoBaixa(false)
    }
  }

  async function decidirSolicitacaoBaixa(item, decisao) {
    let observacoes = ''
    if (decisao !== 'APROVAR') {
      observacoes = window.prompt(decisao === 'DILIGENCIA' ? 'Informe a diligência solicitada ao P4:' : 'Informe o motivo da reprovação:') || ''
      if (!observacoes.trim()) return
    } else if (!window.confirm(`Confirma a baixa definitiva do HT ${item.patrimonio || item.numero_serie || ''}?`)) {
      return
    }

    try {
      setProcessandoAprovacaoId(item.id)
      await decidirBaixaHT({ solicitacao: item, decisao, observacoes, user })
      setMensagemSucesso(decisao === 'APROVAR' ? 'Baixa patrimonial aprovada.' : 'Solicitação de baixa atualizada.')
      await Promise.all([carregarHTs(), carregarResumo(), carregarSolicitacoesBaixa()])
    } catch (error) {
      window.alert(error?.message || 'Não foi possível registrar a decisão.')
    } finally {
      setProcessandoAprovacaoId(null)
    }
  }

  async function abrirOperacao(modo) {
    try {
      setErro('')
      setOperacaoModal(modo)

      if (['CARGA', 'CAUTELA'].includes(modo)) {
        const resultado = await listarPoliciais({ pagina: 1, limite: 500, filtros: { ativo: true } })
        setPoliciaisOperacao(resultado?.data || resultado || [])
      }

      if (['DEVOLUCAO', 'REGULARIZAR'].includes(modo)) {
        const lista = await listarEntregasHTAtivas()
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
      console.error(error)
      setErro(error?.message || 'Não foi possível abrir a operação.')
      setOperacaoModal(null)
    }
  }

  async function confirmarOperacao(dados) {
    try {
      setSalvandoOperacao(true)
      setErro('')

      if (operacaoModal === 'CARGA') {
        await pagarCargaHT({ htIds: dados.ids, policial: dados.policial, observacoes: dados.observacoes, user })
        setMensagemSucesso('Carga permanente registrada com sucesso.')
      } else if (operacaoModal === 'CAUTELA') {
        await pagarCautelaHT({ htIds: dados.ids, policial: dados.policial, devolucaoPrevista: dados.devolucaoPrevista, observacoes: dados.observacoes, user })
        setMensagemSucesso('Cautela registrada com sucesso.')
      } else if (operacaoModal === 'DEVOLUCAO') {
        const selecionadas = entregasAtivas.filter((item) => dados.ids.includes(item.id))
        await receberDevolucaoHT({ movimentacoes: selecionadas, destinoCodigo: ehPerfilSVDD ? 'SVDD' : 'P4', observacoes: dados.observacoes, user })
        setMensagemSucesso('Devolução recebida com sucesso.')
      } else if (operacaoModal === 'REGULARIZAR') {
        await regularizarCautelaHT({ movimentacaoId: dados.movimentacaoId, acao: dados.acao, novaPrevisao: dados.devolucaoPrevista, observacoes: dados.observacoes, user })
        setMensagemSucesso('Providência de regularização registrada.')
      }

      setOperacaoModal(null)
      await Promise.all([carregarHTs(), carregarResumo()])
    } catch (error) {
      console.error(error)
      setErro(error?.message || 'Não foi possível concluir a operação.')
    } finally {
      setSalvandoOperacao(false)
    }
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function obterValorOpcao(option) {
    return typeof option === 'string' ? option : option.value
  }

  function obterLabelOpcao(option) {
    return typeof option === 'string' ? option : option.label
  }

  return (
    <main className="ht-page">
      <header className="ht-hero">
        <div className="ht-hero-copy">
          <span className="ht-kicker">Gestão patrimonial e operacional</span>
          <h1>Rádios HT</h1>
          <p>
            Cadastro, localização e acompanhamento dos rádios portáteis integrados ao patrimônio do SIGMO.
          </p>
        </div>

        <div className="ht-hero-actions">
          <button
            type="button"
            className="ht-btn-secondary"
            onClick={() => Promise.all([carregarHTs(), carregarResumo()])}
            disabled={loading || loadingResumo}
          >
            {loading || loadingResumo ? 'Atualizando...' : 'Atualizar'}
          </button>

          <button type="button" className="ht-btn-primary" onClick={abrirNovoCadastro}>
            + Novo HT
          </button>
        </div>
      </header>

      {erro && <div className="ht-alert-error">{erro}</div>}
      {mensagemSucesso && <div className="ht-alert-success">{mensagemSucesso}</div>}

      <section
        className={`ht-summary-grid ht-summary-grid-complete${ehPerfilSVDD ? ' ht-summary-grid-svdd' : ''}`}
        aria-label="Resumo patrimonial dos rádios HT"
      >
        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Total de HTs"
            valor={resumo.total}
            detalhe="equipamentos cadastrados"
            tone="blue"
            onClick={() => abrirResumoModal('TOTAL', 'Total de HTs', 'Todos os rádios HT cadastrados na companhia.')}
          />
        )}
        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Depósito do P4"
            valor={resumo.p4}
            detalhe="sob guarda patrimonial do P4"
            tone="green"
            onClick={() => abrirResumoModal('P4', 'HTs no Depósito do P4', 'Equipamentos atualmente sob guarda patrimonial do P4.')}
          />
        )}
        <ResumoCard
          titulo="Cofre do SVDD"
          valor={resumo.svdd}
          detalhe="sob guarda do Serviço de Dia"
          tone="cyan"
          onClick={() => abrirResumoModal('SVDD', 'HTs no Cofre do SVDD', 'Equipamentos disponíveis sob responsabilidade do Serviço de Dia.')}
        />
        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Carga permanente"
            valor={resumo.cargaPermanente}
            detalhe="vinculados permanentemente"
            tone="orange"
            onClick={() => abrirResumoModal('CARGA', 'HTs em carga permanente', 'Equipamentos vinculados permanentemente a policiais.')}
          />
        )}
        <ResumoCard
          titulo="Cautelas ativas"
          valor={resumo.cautelas}
          detalhe="entregas temporárias ativas"
          tone="yellow"
          onClick={() => abrirResumoModal('CAUTELA', 'Cautelas ativas', 'Rádios HT entregues temporariamente e ainda não devolvidos.')}
        />
        <ResumoCard
          titulo="Manutenção"
          valor={resumo.manutencao}
          detalhe="temporariamente indisponíveis"
          tone="red"
          onClick={() => abrirResumoModal('MANUTENCAO', 'HTs em manutenção', 'Equipamentos indisponíveis por reparo ou avaliação técnica.')}
        />
        <ResumoCard
          titulo="Não localizados"
          valor={resumo.naoLocalizados}
          detalhe="localização pendente"
          tone="slate"
          onClick={() => abrirResumoModal('NAO_LOCALIZADO', 'HTs não localizados', 'Equipamentos com localização pendente ou divergente.')}
        />
        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Baixados"
            valor={resumo.baixados}
            detalhe="mantidos no histórico"
            tone="dark"
            onClick={() => abrirResumoModal('BAIXADO', 'HTs baixados', 'Patrimônios com baixa definitivamente aprovada.')}
          />
        )}
        {!ehPerfilSVDD && (
          <ResumoCard
            titulo="Aguardando aprovações"
            valor={solicitacoesBaixa.length}
            detalhe={loadingAprovacoes ? 'atualizando' : 'processos pendentes'}
            tone="approval"
            onClick={() => { setAprovacoesModalAberta(true); carregarSolicitacoesBaixa() }}
          />
        )}
      </section>

      <section className="ht-charts-grid" aria-label="Gráficos patrimoniais dos rádios HT">
        <GraficoRoscaHT total={totalGrafico} itens={dadosGrafico} />
        <GraficoBarrasHT total={totalGrafico} itens={dadosGrafico} />
      </section>

      <section className="ht-operations-section ht-operations-complete">
        <div className="ht-operations-title">
          <div>
            <span>Operações permitidas</span>
            <h2>Movimentações patrimoniais</h2>
          </div>
        </div>

        <div className="ht-operation-groups">
          <GrupoOperacao
            icone="📦"
            titulo="Distribuir patrimônio"
            descricao="Transferências e entregas de rádios HT."
            className="ht-operation-group-distribute"
          >
            <button type="button" disabled={!podeMovimentarHT} onClick={abrirTransferenciaHT}>
              <strong>{contextoOrigemSVDD ? 'Devolver ao P4' : 'Transferir'}</strong>
              <span>{contextoOrigemSVDD ? 'Selecionar um ou vários HTs e devolver ao P4' : 'Escolher o destino e selecionar um ou vários HTs'}</span>
            </button>
            <button type="button" disabled={!podeMovimentarHT} onClick={abrirCancelamentoTransferencia}>
              <strong>Cancelar transferência</strong>
              <span>Cancelar uma movimentação que ainda não foi recebida</span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao icone="📥" titulo="Receber patrimônio" descricao="Devoluções e retornos patrimoniais.">
            <button type="button" disabled={!podeMovimentarHT} onClick={() => abrirOperacao('DEVOLUCAO')}>
              <strong>Receber devolução</strong>
              <span>Encerrar carga ou cautela e receber o rádio HT</span>
            </button>
            <button
              type="button"
              onClick={() => abrirResumoModal('MANUTENCAO', 'HTs em manutenção', 'Equipamentos em reparo e disponíveis para acompanhamento do retorno.')}
            >
              <strong>Receber manutenção</strong>
              <span>Visualizar equipamentos em reparo e acompanhar o retorno</span>
            </button>
            <button
              type="button"
              disabled={!podeMovimentarHT}
              onClick={() => {
                setRecebimentoModalAberta(true)
                carregarTransferenciasPendentes()
              }}
            >
              <strong>{ehPerfilP4 ? 'Receber do SVDD' : 'Receber do P4'}</strong>
              <span>{ehPerfilP4 ? 'Confirmar HT devolvido pelo SVDD' : 'Confirmar HT enviado ao Cofre do SVDD'}</span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao icone="⚙️" titulo="Gestão patrimonial" descricao="Manutenção, regularização e baixa.">
            <button type="button" onClick={abrirSeletorManutencao}>
              <strong>Enviar manutenção</strong>
              <span>Selecionar um HT e registrar a saída para reparo</span>
            </button>
            <button type="button" disabled={!podeMovimentarHT} onClick={() => abrirOperacao('REGULARIZAR')}>
              <strong>Regularizar</strong>
              <span>Prorrogar cautela vencida ou solicitar providência</span>
            </button>
            <button
              type="button"
              disabled={!ehPerfilP4 || htsElegiveisBaixa.length === 0}
              className="ht-operation-danger"
              onClick={() => setBaixaModalAberta(true)}
            >
              <strong>Baixar patrimônio</strong>
              <span>{ehPerfilP4 ? 'Solicitar baixa com observações e fotos para aprovação do Comandante' : 'Operação exclusiva do P4'}</span>
            </button>
          </GrupoOperacao>
        </div>
      </section>

      <section className="ht-filter-panel">
        <div className="ht-filter-topline">
          <div className="ht-search ht-search-main">
            <label htmlFor="pesquisa">Pesquisar HT</label>
            <input
              id="pesquisa"
              name="pesquisa"
              type="search"
              value={filtros.pesquisa}
              onChange={handleFiltroChange}
              placeholder="Patrimônio, série, marca, modelo, equipe ou viatura"
            />
          </div>

          <button
            type="button"
            className="ht-btn-secondary ht-filter-toggle"
            onClick={() => setFiltrosExpandidos((prev) => !prev)}
          >
            {filtrosExpandidos ? 'Ocultar filtros' : 'Mais filtros'}
            {filtrosAtivos > 0 && <span>{filtrosAtivos}</span>}
          </button>

          {filtrosAtivos > 0 && (
            <button type="button" className="ht-filter-clear" onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </div>

        {filtrosExpandidos && (
          <div className="ht-toolbar">
            <div className="ht-filter">
              <label htmlFor="tipo_ht">Tipo</label>
              <select id="tipo_ht" name="tipo_ht" value={filtros.tipo_ht} onChange={handleFiltroChange}>
                <option value="">Todos</option>
                {tipoOptions.map((option) => {
                  const valor = obterValorOpcao(option)
                  return <option key={valor} value={valor}>{obterLabelOpcao(option)}</option>
                })}
              </select>
            </div>

            <div className="ht-filter">
              <label htmlFor="marca">Marca</label>
              <input id="marca" name="marca" value={filtros.marca} onChange={handleFiltroChange} placeholder="Ex.: Motorola" />
            </div>

            <div className="ht-filter">
              <label htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" value={filtros.modelo} onChange={handleFiltroChange} placeholder="Ex.: APX 2000" />
            </div>

            <div className="ht-filter">
              <label htmlFor="status_operacional">Status</label>
              <select id="status_operacional" name="status_operacional" value={filtros.status_operacional} onChange={handleFiltroChange}>
                <option value="">Todos</option>
                {statusOptions.map((option) => {
                  const valor = obterValorOpcao(option)
                  return <option key={valor} value={valor}>{obterLabelOpcao(option)}</option>
                })}
              </select>
            </div>

            <div className="ht-filter">
              <label htmlFor="unidade">Unidade</label>
              <select id="unidade" name="unidade" value={filtros.unidade} onChange={handleFiltroChange}>
                <option value="">Todas</option>
                {UNIDADES_27_BPMM.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      {formAberto && (
        <section className="ht-form-area">
          <HTForm user={user} htEditando={htEditando} onCancel={fecharFormulario} onSaved={handleSaved} />
        </section>
      )}

      <section className="ht-list-card">
        <div className="ht-list-header">
          <div>
            <span className="ht-section-kicker">Inventário operacional</span>
            <h2>HTs cadastrados</h2>
            <p>{total} {total === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
          </div>

          {filtros.status_operacional && (
            <span className="ht-active-filter">
              Status: {formatarStatus(filtros.status_operacional)}
            </span>
          )}
        </div>

        <HTTable
          hts={hts}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={abrirEdicao}
          onDelete={handleExcluir}
        />

        <footer className="ht-pagination">
          <span>Exibindo página {pagina} de {totalPaginas}</span>
          <div>
            <button type="button" disabled={pagina <= 1 || loading} onClick={() => setPagina((prev) => Math.max(1, prev - 1))}>Anterior</button>
            <strong>{pagina}</strong>
            <button type="button" disabled={pagina >= totalPaginas || loading} onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))}>Próxima</button>
          </div>
        </footer>
      </section>

      {resumoModal && (
        <div
          className="ht-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) fecharResumoModal()
          }}
        >
          <section
            className="ht-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-label={resumoModal.titulo}
          >
            <header>
              <div>
                <span>Consulta patrimonial</span>
                <h2>{resumoModal.titulo}</h2>
                <p>{resumoModal.subtitulo}</p>
              </div>

              <button type="button" aria-label="Fechar" onClick={fecharResumoModal}>
                ×
              </button>
            </header>

            <div className="ht-summary-modal-body">
              <div className="ht-summary-modal-toolbar">
                <input
                  type="search"
                  value={buscaResumoModal}
                  onChange={(event) => setBuscaResumoModal(event.target.value)}
                  placeholder="Pesquisar patrimônio, série, marca, modelo ou local"
                  autoFocus
                />

                <strong>{itensResumoModal.length} equipamento(s)</strong>
              </div>

              <div className="ht-summary-modal-list">
                {itensResumoModal.length === 0 ? (
                  <div className="ht-summary-modal-empty">
                    Nenhum HT encontrado nesta situação.
                  </div>
                ) : (
                  itensResumoModal.map((ht) => (
                    <article key={ht.id} className="ht-summary-modal-item">
                      <div className="ht-summary-modal-identification">
                        {ht.foto_url ? (
                          <img src={ht.foto_url} alt="Foto do HT" />
                        ) : (
                          <span aria-hidden="true">📻</span>
                        )}

                        <div>
                          <strong>{ht.patrimonio || ht.numero_serie || 'HT sem identificação'}</strong>
                          <small>{[ht.marca, ht.modelo].filter(Boolean).join(' ') || 'Marca/modelo não informado'}</small>
                        </div>
                      </div>

                      <div className="ht-summary-modal-details">
                        <span><b>Local:</b> {ht.local_atual || 'Não informado'}</span>
                        <span><b>Status:</b> {formatarStatus(ht.status_operacional || ht.status)}</span>
                        <span><b>Unidade:</b> {ht.unidade || 'Não informada'}</span>
                      </div>

                      <button
                        type="button"
                        className="ht-summary-modal-view"
                        onClick={() => visualizarHTDoResumo(ht)}
                      >
                        Ver
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>

            <footer>
              <button type="button" className="ht-btn-secondary" onClick={fecharResumoModal}>
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}

      {transferenciaModalAberta && (
        <div className="ht-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !processandoTransferenciaId) setTransferenciaModalAberta(false)
        }}>
          <section className="ht-transfer-modal" role="dialog" aria-modal="true" aria-label="Transferir HTs">
            <header>
              <div>
                <span>Transferência patrimonial</span>
                <h2>{origemTransferencia} → {destinoTransferencia || 'Selecionar destino'}</h2>
                <p>{contextoOrigemSVDD ? 'Selecione os rádios HT que serão devolvidos ao P4.' : 'Escolha o destino e selecione um ou vários rádios HT.'}</p>
              </div>
              <button type="button" onClick={() => setTransferenciaModalAberta(false)} disabled={Boolean(processandoTransferenciaId)}>×</button>
            </header>
            <div className="ht-transfer-body">
              {!contextoOrigemSVDD && (
                <div className="ht-transfer-destination">
                  <label htmlFor="ht-destino-transferencia">Destino</label>
                  <select
                    id="ht-destino-transferencia"
                    value={destinoTransferenciaSelecionado}
                    onChange={(event) => {
                      setDestinoTransferenciaSelecionado(event.target.value)
                      if (event.target.value !== 'OUTROS') setDestinoTransferenciaOutro('')
                    }}
                    autoFocus
                  >
                    <option value="">Selecione o destino</option>
                    {DESTINOS_TRANSFERENCIA_P4.map((destino) => (
                      <option key={destino.codigo} value={destino.codigo}>{destino.nome}</option>
                    ))}
                  </select>
                  {destinoTransferenciaSelecionado === 'OUTROS' && (
                    <input
                      type="text"
                      value={destinoTransferenciaOutro}
                      onChange={(event) => setDestinoTransferenciaOutro(event.target.value)}
                      placeholder="Informe o destino, órgão ou local"
                    />
                  )}
                </div>
              )}
              <input
                type="search"
                value={pesquisaTransferencia}
                onChange={(event) => setPesquisaTransferencia(event.target.value)}
                placeholder="Pesquisar patrimônio, série, marca ou modelo"
                autoFocus={contextoOrigemSVDD}
              />
              <div className="ht-transfer-list">
                {htsDisponiveisTransferencia.length === 0 ? (
                  <div className="ht-transfer-empty">Nenhum HT disponível para esta transferência.</div>
                ) : htsDisponiveisTransferencia.map((ht) => (
                  <label key={ht.id} className="ht-transfer-item">
                    <input type="checkbox" checked={htsSelecionadosTransferencia.includes(ht.id)} onChange={() => alternarHTTransferencia(ht.id)} />
                    <div>
                      <strong>{ht.patrimonio || ht.numero_serie || 'HT'}</strong>
                      <span>{[ht.marca, ht.modelo].filter(Boolean).join(' ') || 'Rádio HT'} · {ht.local_atual || '-'}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <footer>
              <span>{htsSelecionadosTransferencia.length} selecionado(s)</span>
              <button type="button" className="ht-btn-secondary" onClick={() => setTransferenciaModalAberta(false)} disabled={Boolean(processandoTransferenciaId)}>Cancelar</button>
              <button
                type="button"
                className="ht-btn-primary"
                onClick={confirmarTransferenciaHT}
                disabled={
                  !htsSelecionadosTransferencia.length ||
                  !destinoTransferencia ||
                  (destinoTransferencia === 'OUTROS' && !destinoTransferenciaOutro.trim()) ||
                  Boolean(processandoTransferenciaId)
                }
              >
                {processandoTransferenciaId ? 'Enviando...' : 'Criar transferência'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {cancelamentoTransferenciaModalAberto && (
        <div className="ht-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !processandoTransferenciaId) setCancelamentoTransferenciaModalAberto(false)
        }}>
          <section className="ht-transfer-modal" role="dialog" aria-modal="true" aria-label="Cancelar transferência de HT">
            <header>
              <div>
                <span>Transferências pendentes</span>
                <h2>Cancelar transferência</h2>
                <p>Somente movimentações ainda não recebidas podem ser canceladas.</p>
              </div>
              <button type="button" onClick={() => setCancelamentoTransferenciaModalAberto(false)} disabled={Boolean(processandoTransferenciaId)}>×</button>
            </header>
            <div className="ht-transfer-list ht-cancel-transfer-list">
              {loadingTransferenciasCancelaveis ? (
                <div className="ht-transfer-empty">Carregando transferências...</div>
              ) : transferenciasCancelaveis.length === 0 ? (
                <div className="ht-transfer-empty">Nenhuma transferência pendente criada por este setor.</div>
              ) : transferenciasCancelaveis.map((movimentacao) => {
                const dados = movimentacao.dados || movimentacao.metadata?.dados_engine || {}
                const origem = movimentacao.origem_guardiao_codigo || dados?.guardiao_origem?.codigo || origemTransferencia
                const destino = movimentacao.destino_guardiao_nome || movimentacao.destino_guardiao_codigo || dados?.guardiao_destino?.nome || dados?.guardiao_destino?.codigo || 'Destino não informado'
                const criadoEm = movimentacao.criadoEm || movimentacao.created_at || movimentacao.criado_em
                return (
                  <article key={movimentacao.id} className="ht-cancel-transfer-item">
                    <div>
                      <strong>{dados.patrimonio || dados.numero_serie || 'HT'}</strong>
                      <span>{origem} → {destino}</span>
                      <small>Protocolo {movimentacao.protocolo || '—'}{criadoEm ? ` · ${new Date(criadoEm).toLocaleString('pt-BR')}` : ''}</small>
                    </div>
                    <button type="button" onClick={() => cancelarTransferenciaPendente(movimentacao)} disabled={Boolean(processandoTransferenciaId)}>
                      {processandoTransferenciaId === movimentacao.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </article>
                )
              })}
            </div>
            <footer>
              <span>{transferenciasCancelaveis.length} pendente(s)</span>
              <button type="button" className="ht-btn-secondary" onClick={() => setCancelamentoTransferenciaModalAberto(false)} disabled={Boolean(processandoTransferenciaId)}>Fechar</button>
            </footer>
          </section>
        </div>
      )}

      {recebimentoModalAberta && (
        <div className="ht-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !processandoTransferenciaId) setRecebimentoModalAberta(false)
        }}>
          <section className="ht-transfer-modal" role="dialog" aria-modal="true" aria-label="Receber HTs">
            <header>
              <div>
                <span>Recebimento patrimonial</span>
                <h2>{ehPerfilP4 ? 'SVDD → P4' : 'P4 → SVDD'}</h2>
                <p>Confirme ou recuse os rádios HT pendentes de recebimento.</p>
              </div>
              <button type="button" onClick={() => setRecebimentoModalAberta(false)} disabled={Boolean(processandoTransferenciaId)}>×</button>
            </header>
            <div className="ht-transfer-list ht-receive-list">
              {loadingTransferencias ? (
                <div className="ht-transfer-empty">Atualizando pendências...</div>
              ) : transferenciasPendentes.length === 0 ? (
                <div className="ht-transfer-empty">Nenhum HT pendente de recebimento.</div>
              ) : transferenciasPendentes.map((movimentacao) => {
                const dados = movimentacao.dados || movimentacao.metadata?.dados_engine || {}
                return (
                  <div key={movimentacao.id} className="ht-receive-item">
                    <div>
                      <strong>{dados.patrimonio || dados.numero_serie || 'HT'}</strong>
                      <span>{[dados.marca, dados.modelo].filter(Boolean).join(' ') || 'Rádio HT'} · Protocolo {movimentacao.protocolo || '-'}</span>
                    </div>
                    <div className="ht-receive-actions">
                      <button type="button" onClick={() => receberTransferenciaHT(movimentacao)} disabled={Boolean(processandoTransferenciaId)}>
                        {processandoTransferenciaId === movimentacao.id ? 'Processando...' : 'Receber'}
                      </button>
                      <button type="button" className="danger" onClick={() => recusarTransferenciaPendente(movimentacao)} disabled={Boolean(processandoTransferenciaId)}>Recusar</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <footer>
              <button type="button" className="ht-btn-secondary" onClick={() => setRecebimentoModalAberta(false)} disabled={Boolean(processandoTransferenciaId)}>Fechar</button>
            </footer>
          </section>
        </div>
      )}

      {seletorManutencaoAberto && (
        <div
          className="ht-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSeletorManutencaoAberto(false)
            }
          }}
        >
          <section
            className="ht-maintenance-selector"
            role="dialog"
            aria-modal="true"
            aria-label="Selecionar HT para manutenção"
          >
            <header>
              <div>
                <span>Manutenção individual</span>
                <h2>Selecionar rádio HT</h2>
                <p>Escolha o equipamento que será enviado para reparo.</p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setSeletorManutencaoAberto(false)}
              >
                ×
              </button>
            </header>

            <div className="ht-maintenance-selector-body">
              <label htmlFor="ht-seletor-manutencao">Pesquisar equipamento</label>
              <input
                id="ht-seletor-manutencao"
                type="search"
                value={buscaSeletorManutencao}
                onChange={(event) => setBuscaSeletorManutencao(event.target.value)}
                placeholder="Patrimônio, série, marca, modelo ou local"
                autoFocus
              />

              <div className="ht-maintenance-selector-list">
                {htsElegiveisManutencao.length === 0 ? (
                  <div className="ht-maintenance-selector-empty">
                    Nenhum HT disponível para envio à manutenção.
                  </div>
                ) : (
                  htsElegiveisManutencao.map((ht) => (
                    <button
                      key={ht.id}
                      type="button"
                      className="ht-maintenance-selector-item"
                      onClick={() => selecionarHTParaManutencao(ht)}
                    >
                      <div>
                        <strong>{ht.patrimonio || ht.numero_serie || 'HT sem identificação'}</strong>
                        <span>{[ht.marca, ht.modelo].filter(Boolean).join(' ') || 'Marca/modelo não informado'}</span>
                      </div>

                      <small>
                        {ht.local_atual || ht.unidade || formatarStatus(ht.status_operacional)}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </div>

            <footer>
              <span>{htsElegiveisManutencao.length} equipamento(s) disponível(is)</span>
              <button
                type="button"
                className="ht-btn-secondary"
                onClick={() => setSeletorManutencaoAberto(false)}
              >
                Cancelar
              </button>
            </footer>
          </section>
        </div>
      )}

      <HTOperacaoModal
        aberto={Boolean(operacaoModal)}
        modo={operacaoModal}
        titulo={
          operacaoModal === 'CARGA' ? 'Pagar carga permanente' :
          operacaoModal === 'CAUTELA' ? 'Pagar cautela' :
          operacaoModal === 'DEVOLUCAO' ? 'Receber devolução' :
          'Regularizar cautela vencida'
        }
        descricao={
          operacaoModal === 'CARGA' ? 'Vincule um ou vários HTs a um policial cadastrado.' :
          operacaoModal === 'CAUTELA' ? 'Registre a entrega temporária e a previsão de devolução.' :
          operacaoModal === 'DEVOLUCAO' ? 'Selecione as cargas ou cautelas devolvidas ao guardião de origem.' :
          'Estenda o prazo ou encaminhe uma providência ao P4 ou ao Comandante.'
        }
        hts={htsDisponiveisOperacao}
        policiais={policiaisOperacao}
        entregas={entregasAtivas}
        salvando={salvandoOperacao}
        onClose={() => { if (!salvandoOperacao) setOperacaoModal(null) }}
        onConfirm={confirmarOperacao}
      />

      <HTBaixaModal
        aberto={baixaModalAberta}
        hts={htsElegiveisBaixa}
        salvando={salvandoBaixa}
        onClose={() => { if (!salvandoBaixa) setBaixaModalAberta(false) }}
        onConfirm={confirmarSolicitacaoBaixa}
      />

      <HTAprovacoesModal
        aberto={aprovacoesModalAberta}
        itens={solicitacoesBaixa}
        podeDecidir={ehPerfilGestor}
        processandoId={processandoAprovacaoId}
        onClose={() => { if (!processandoAprovacaoId) setAprovacoesModalAberta(false) }}
        onDecidir={decidirSolicitacaoBaixa}
      />

      <HTManutencaoModal
        ht={htManutencao}
        salvando={salvandoManutencao}
        onClose={() => { if (!salvandoManutencao) setHTManutencao(null) }}
        onConfirm={confirmarManutencao}
      />

      <HTRetornoManutencaoModal
        contexto={retornoManutencao}
        salvando={salvandoRetorno}
        onClose={() => { if (!salvandoRetorno) setRetornoManutencao(null) }}
        onConfirm={confirmarRetornoManutencao}
      />

      {htVisualizando && (
        <HTDetalhesModal
          ht={htVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={() => abrirEdicao(htVisualizando)}
          onReturnMaintenance={() => abrirRetornoManutencao(htVisualizando)}
        />
      )}
    </main>
  )
}
