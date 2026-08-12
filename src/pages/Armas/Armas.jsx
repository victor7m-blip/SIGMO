import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import ArmaViewModal from './components/ArmaViewModal'

import PolicialViewModal
  from '../Policiais/components/PolicialViewModal'

import {
  buscarArmaPorId,
  excluirArma,
  listarArmas
} from '../../services/armasService'

import {
  listarPoliciais
} from '../../services/policiaisService'

import {
  listarFotosPolicial
} from '../../services/policiaisFotosService'

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
import '../Policiais/components/policialViewModal.css'

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


function obterEspecieArma(arma) {
  const especie = normalizarTexto(arma?.especie || arma?.tipo || '')
  if (especie.includes('PISTOLA')) return 'PISTOLA'
  if (especie.includes('FUZIL')) return 'FUZIL'
  if (especie.includes('ESPINGARDA')) return 'ESPINGARDA'
  return 'OUTRA'
}

function obterResponsavelArma(arma) {
  return {
    nome:
      arma?.responsavel_atual_nome ||
      arma?.carga_policial_nome ||
      arma?.proprietario_nome ||
      arma?.proprietario_policial_nome ||
      arma?.responsavel_nome ||
      arma?.policial_nome ||
      '',
    re:
      arma?.carga_policial_re ||
      arma?.responsavel_re ||
      arma?.proprietario_re ||
      arma?.proprietario_policial_re ||
      arma?.policial_re ||
      ''
  }
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

  // A localização física prevalece sobre o status.
  // Uma arma em RESERVA no COFRE DO SVDD não pode
  // aparecer simultaneamente no P4.
  if (estaNoSVDD(arma)) {
    return false
  }

  if (
    local.includes('P4') ||
    local.includes('DEPOSITO') ||
    local.includes('RESERVA') ||
    local.includes('GUARDA DO QUARTEL')
  ) {
    return true
  }

  // Status é usado somente como compatibilidade para
  // registros antigos que ainda não possuem local definido.
  if (!local) {
    return (
      status === 'RESERVA' ||
      status === 'ATIVO' ||
      status === 'DISPONIVEL'
    )
  }

  return false
}

function estaNoSVDD(arma) {
  const local = obterLocalArma(arma)

  return (
    local.includes('SVDD') ||
    local.includes('SERVICO DE DIA') ||
    local.includes('COFRE DO SVDD')
  )
}

function armaPertenceAoEscopoSVDD(arma) {
  if (
    normalizarTexto(arma?.propriedade) === 'PARTICULAR' ||
    estaEmCarga(arma)
  ) {
    return false
  }

  return (
    estaNoSVDD(arma) ||
    estaCautelada(arma) ||
    estaEmManutencao(arma) ||
    estaNaoLocalizada(arma)
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

function ArmaResumoCard({ titulo, valor, descricao, detalhes = [], destaque = 'padrao', onClick, onDetalheClick }) {
  const temDetalhes = Array.isArray(detalhes) && detalhes.length > 0
  const cardClicavel = typeof onClick === 'function'

  function abrirCard(event) {
    if (!cardClicavel) return

    // Os números internos têm filtro próprio. Nunca deixe o clique
    // deles subir e executar também o clique geral do card.
    if (event?.target?.closest?.('.armas-resumo-detalhe-clicavel')) return

    onClick()
  }

  function tratarTeclaCard(event) {
    if (!cardClicavel || event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`armas-resumo-card armas-resumo-${destaque}${cardClicavel ? ' armas-resumo-card-clicavel' : ''}`}
      role={cardClicavel ? 'button' : undefined}
      tabIndex={cardClicavel ? 0 : undefined}
      onClick={abrirCard}
      onKeyDown={tratarTeclaCard}
    >
      <span>{titulo}</span>
      {temDetalhes ? (
        <div className="armas-resumo-detalhes">
          {detalhes.map((item) => {
            const detalheClicavel = typeof onDetalheClick === 'function' && Number(item.valor || 0) > 0

            return detalheClicavel ? (
              <button
                type="button"
                key={item.titulo}
                className="armas-resumo-detalhe-clicavel"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onDetalheClick(item)
                }}
              >
                <span>{item.titulo}</span>
                <strong>{item.valor}</strong>
              </button>
            ) : (
              <div key={item.titulo}>
                <span>{item.titulo}</span>
                <strong>{item.valor}</strong>
              </div>
            )
          })}
        </div>
      ) : (
        <strong>{valor}</strong>
      )}
      {descricao && <small>{descricao}</small>}
    </div>
  )
}

function GraficoRoscaArmas({ resumo }) {
 const fatias = [
  { label: 'Depósito do P4', valor: resumo.p4.total, cor: '#2563eb' },
  { label: 'Cofre do SVDD', valor: resumo.svdd.total, cor: '#7c3aed' },
  { label: 'Carga permanente', valor: resumo.carga.total, cor: '#16a34a' },
  { label: 'Cautelas ativas', valor: resumo.cautelas.total, cor: '#eab308' },
  { label: 'Manutenção', valor: resumo.manutencao.total, cor: '#f97316' },
  { label: 'Não localizadas', valor: resumo.naoLocalizadas.total, cor: '#dc2626' },
  { label: 'Apreendidas', valor: resumo.apreendidas.total, cor: '#8b5cf6' },
  { label: 'Recolhidas', valor: resumo.recolhidas.total, cor: '#64748b' }
]

  let acumulado = 0
  const partes = fatias.map((item) => {
    const inicio = acumulado
    const fim = acumulado + percentual(item.valor, resumo.total.total)
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
            <strong>{resumo.total.total}</strong>
            <span>Total de armas</span>
          </div>
        </div>

        <div className="armas-grafico-legenda">
          {fatias.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.cor }} />
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
              <small>{formatarPercentual(percentual(item.valor, resumo.total.total))}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GraficoBarrasArmas({ resumo }) {
  const categorias = [
  { label: 'Depósito do P4', valor: resumo.p4.total },
  { label: 'Cofre do SVDD', valor: resumo.svdd.total },
  { label: 'Carga permanente', valor: resumo.carga.total },
  { label: 'Cautelas', valor: resumo.cautelas.total },
  { label: 'Manutenção', valor: resumo.manutencao.total },
  { label: 'Não localizadas', valor: resumo.naoLocalizadas.total },
  { label: 'Apreendidas', valor: resumo.apreendidas.total },
  { label: 'Recolhidas', valor: resumo.recolhidas.total }
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

export default function Armas({ user, onAbrirPolicial }) {
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
  const [policialVisualizando, setPolicialVisualizando] = useState(null)
  const [fotosPolicial, setFotosPolicial] = useState([])
  const [abrindoPolicial, setAbrindoPolicial] = useState(false)
  const [painelResumo, setPainelResumo] = useState(null)

  const listaRef = useRef(null)
  const tabelaScrollRef = useRef(null)
  const tabelaScrollTopoRef = useRef(null)
  const tabelaRef = useRef(null)
  const [larguraTabela, setLarguraTabela] = useState(0)
  const [destacarLista, setDestacarLista] = useState(false)

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
        pagina: ehPerfilSVDD ? 1 : pagina,
        limite: ehPerfilSVDD ? LIMITE_RESUMO : LIMITE,
        sortBy,
        sortDirection
      })

      const listaRecebida = resultado.data || []

      if (ehPerfilSVDD) {
        const listaVisivel = listaRecebida.filter(
          armaPertenceAoEscopoSVDD
        )

        const inicio = (pagina - 1) * LIMITE
        const fim = inicio + LIMITE

        setArmas(listaVisivel.slice(inicio, fim))
        setTotal(listaVisivel.length)
      } else {
        setArmas(listaRecebida)
        setTotal(resultado.total || 0)
      }
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
    sortDirection,
    ehPerfilSVDD
  ])

  useEffect(() => {
    carregarArmas()
  }, [carregarArmas])


  const abrirVisualizacao = useCallback(async (arma) => {
    if (!arma) return

    // Abre imediatamente e, em seguida, recarrega o registro completo.
    // Isso evita perder campos como qr_code após refatorações da listagem.
    setArmaVisualizando(arma)

    if (!arma.id) return

    try {
      const armaCompleta = await buscarArmaPorId(arma.id)

      if (armaCompleta) {
        setArmaVisualizando(armaCompleta)
      }
    } catch (error) {
      console.error('Erro ao carregar os dados completos da arma:', error)
    }
  }, [])

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

      const listaRecebida = resultado.data || []

      setArmasResumo(
        ehPerfilSVDD
          ? listaRecebida.filter(
              armaPertenceAoEscopoSVDD
            )
          : listaRecebida
      )
    } catch (error) {
      console.error('Erro ao carregar resumo de armas:', error)
      setArmasResumo([])
    } finally {
      setLoadingResumo(false)
    }
  }, [ehPerfilSVDD])

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
    const vazio = () => ({ total: 0, pistolas: 0, fuzis: 0, espingardas: 0, outras: 0 })
    const categorias = {
      total: vazio(),
      p4: vazio(),
      svdd: vazio(),
      disponiveis: vazio(),
      carga: vazio(),
      cautelas: vazio(),
      manutencao: vazio(),
      naoLocalizadas: vazio(),
      apreendidas: vazio(),
      recolhidas: vazio(),
      baixadas: vazio(),
      particulares: vazio(),
      outros: vazio()
    }

    function somar(chave, arma) {
      const especie = obterEspecieArma(arma)
      categorias[chave].total += 1
      if (especie === 'PISTOLA') categorias[chave].pistolas += 1
      else if (especie === 'FUZIL') categorias[chave].fuzis += 1
      else if (especie === 'ESPINGARDA') categorias[chave].espingardas += 1
      else categorias[chave].outras += 1
    }

    armasResumo.forEach((arma) => {
      const status = obterStatusArma(arma)
      somar('total', arma)
      
      if (
  normalizarTexto(arma.propriedade) === 'PARTICULAR'
) {
  somar('particulares', arma)
}
      if (status === 'BAIXADO') return somar('baixadas', arma)
      if (status === 'APREENDIDO') return somar('apreendidas', arma)
      if (status === 'RECOLHIDO') return somar('recolhidas', arma)
      if (estaNaoLocalizada(arma)) return somar('naoLocalizadas', arma)
      if (estaEmManutencao(arma)) return somar('manutencao', arma)
      if (estaCautelada(arma)) return somar('cautelas', arma)
      if (estaEmCarga(arma)) return somar('carga', arma)

      if (status === 'RESERVA' || status === 'DISPONIVEL') {
        somar('disponiveis', arma)
      }

      if (estaNoSVDD(arma)) return somar('svdd', arma)
      if (estaNoP4(arma)) return somar('p4', arma)
      somar('outros', arma)
    })

    return {
      ...categorias,
      movimentadas: transferenciasPendentesArmas.length
    }
  }, [armasResumo, transferenciasPendentesArmas])

  const detalhesEspecies = useCallback((grupo) => [
    { titulo: 'Pistolas', especie: 'PISTOLA', valor: grupo?.pistolas || 0 },
    { titulo: 'Fuzis', especie: 'FUZIL', valor: grupo?.fuzis || 0 },
    { titulo: 'Espingardas', especie: 'ESPINGARDA', valor: grupo?.espingardas || 0 }
  ], [])

  const itensPainelResumo = useMemo(() => {
    if (!painelResumo?.tipo) return []

    return armasResumo.filter((arma) => {
      const status = obterStatusArma(arma)
      const pertenceAoGrupo = (() => {
        switch (painelResumo.tipo) {
        case 'TODAS':
          return true
        case 'P4':
          return estaNoP4(arma)
        case 'SVDD':
          return estaNoSVDD(arma)
        case 'CAUTELADAS':
          return estaCautelada(arma)
        case 'PAGAS':
          return estaCautelada(arma) || estaEmCarga(arma)
        case 'CARGA':
          return estaEmCarga(arma)
        case 'RECOLHIDAS':
          return status === 'RECOLHIDO'
        case 'BAIXADAS':
          return status === 'BAIXADO'
        case 'APREENDIDAS':
          return status === 'APREENDIDO'
        case 'MANUTENCAO':
          return estaEmManutencao(arma)
        case 'NAO_LOCALIZADAS':
          return estaNaoLocalizada(arma)
          case 'PARTICULARES':
  return normalizarTexto(arma.propriedade) === 'PARTICULAR'
        case 'OUTROS':
          return !estaNoP4(arma) && !estaNoSVDD(arma) && !estaCautelada(arma) && !estaEmCarga(arma) && !estaEmManutencao(arma) && !estaNaoLocalizada(arma) && !['RECOLHIDO', 'BAIXADO', 'APREENDIDO'].includes(status)
          default:
            return false
        }
      })()

      if (!pertenceAoGrupo) return false
      if (!painelResumo.especie) return true

      return obterEspecieArma(arma) === painelResumo.especie
    })
  }, [armasResumo, painelResumo])

  function abrirPainelResumo(tipo, titulo, descricao, especie = '') {
    const filtrosPainel = {
      TODAS: () => true,
      P4: (arma) => estaNoP4(arma),
      SVDD: (arma) => estaNoSVDD(arma),
      CAUTELADAS: (arma) => estaCautelada(arma),
      PAGAS: (arma) => estaCautelada(arma) || estaEmCarga(arma),
      CARGA: (arma) => estaEmCarga(arma),
      RECOLHIDAS: (arma) => obterStatusArma(arma) === 'RECOLHIDO',
      BAIXADAS: (arma) => obterStatusArma(arma) === 'BAIXADO',
      APREENDIDAS: (arma) => obterStatusArma(arma) === 'APREENDIDO',
      MANUTENCAO: (arma) => estaEmManutencao(arma),
      NAO_LOCALIZADAS: (arma) => estaNaoLocalizada(arma),
      PARTICULARES: (arma) =>
  normalizarTexto(arma.propriedade) === 'PARTICULAR',
      OUTROS: (arma) => {
        const status = obterStatusArma(arma)
        return !estaNoP4(arma) && !estaNoSVDD(arma) && !estaCautelada(arma) && !estaEmCarga(arma) && !estaEmManutencao(arma) && !estaNaoLocalizada(arma) && !['RECOLHIDO', 'BAIXADO', 'APREENDIDO'].includes(status)
      }
    }

    const filtroGrupo = filtrosPainel[tipo] || (() => false)
    const quantidade = armasResumo.filter((arma) => (
      filtroGrupo(arma) && (!especie || obterEspecieArma(arma) === especie)
    )).length
    if (quantidade === 0) return

    setPainelResumo({ tipo, titulo, descricao, especie })
  }

  function abrirPainelResumoPorEspecie(tipo, tituloGrupo, descricaoGrupo, detalhe) {
    const especie = detalhe?.especie || ''
    const tituloEspecie = detalhe?.titulo || 'Armas'

    abrirPainelResumo(
      tipo,
      `${tituloEspecie} — ${tituloGrupo}`,
      `${descricaoGrupo} Exibindo somente ${tituloEspecie.toLowerCase()}.`,
      especie
    )
  }

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
    irParaLista()
  }

  const irParaLista = useCallback(() => {
    requestAnimationFrame(() => {
      listaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })

      setDestacarLista(true)
      window.setTimeout(() => setDestacarLista(false), 1200)
    })
  }, [])

  function aplicarFiltroEspecie(especie) {
    setFiltros((prev) => ({
      ...prev,
      pesquisa: '',
      especie,
      status: ''
    }))
    setPagina(1)
    irParaLista()
  }

  function aplicarFiltroResumo(status, pesquisa = '') {
    setFiltros((prev) => ({
      ...prev,
      pesquisa,
      status
    }))
    setPagina(1)
    irParaLista()
  }

  function abrirNovoCadastro() {
    setArmaEditando(null)
    setArmaVisualizando(null)
    setFormAberto(true)
  }

  function abrirEdicao(arma) {
    if (estaEmCarga(arma)) {
      window.alert(
        'Esta arma está vinculada como CARGA PERMANENTE e não pode ser editada enquanto permanecer em carga. Para alterar cadastro ou fotos, primeiro é necessário devolver a carga ao P4.'
      )
      return
    }

    setArmaEditando(arma)
    setArmaVisualizando(null)
    setFormAberto(true)
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
    if (estaEmCarga(arma)) {
      window.alert(
        'Esta arma está vinculada como CARGA PERMANENTE e não pode ser excluída enquanto permanecer em carga. Primeiro é necessário devolver a carga ao P4.'
      )
      return
    }

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

  useEffect(() => {
    if (!formAberto) return undefined

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function fecharComEscape(event) {
      if (event.key === 'Escape') fecharFormulario()
    }

    window.addEventListener('keydown', fecharComEscape)

    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', fecharComEscape)
    }
  }, [formAberto])

  useEffect(() => {
    function atualizarLarguraTabela() {
      setLarguraTabela(tabelaRef.current?.scrollWidth || 0)
    }

    atualizarLarguraTabela()
    window.addEventListener('resize', atualizarLarguraTabela)

    return () => window.removeEventListener('resize', atualizarLarguraTabela)
  }, [armas, loading, filtros, pagina])

   async function abrirPolicialResponsavel(re) {
  const valorRe = String(re || '').trim()

  if (!valorRe) return

  const normalizarRe = (valor) =>
    String(valor || '')
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')

  const reNormalizado =
    normalizarRe(valorRe)

  const reBusca =
    reNormalizado.length >= 6
      ? reNormalizado.slice(0, 6)
      : reNormalizado

  try {
    setAbrindoPolicial(true)
    setErro('')

    const resultado = await listarPoliciais({
      filtros: {
        re: reBusca
      },
      pagina: 1,
      limite: 20,
      sortBy: 'nome_guerra',
      sortDirection: 'asc'
    })

    const policiais =
      resultado?.data || []

    const policial =
      policiais.find(
        (item) =>
          normalizarRe(item?.re) ===
          reNormalizado
      ) ||
      policiais.find(
        (item) =>
          normalizarRe(item?.re)
            .startsWith(reBusca)
      ) ||
      policiais[0]

    if (!policial) {
      setErro(`Policial RE ${valorRe} não localizado.`)
      return
    }

    const fotos = await listarFotosPolicial(policial.id)

    setArmaVisualizando(null)
    setPolicialVisualizando(policial)
    setFotosPolicial(fotos || [])
  } catch (error) {
    console.error(
      'Erro ao abrir policial responsável:',
      error
    )

    setErro(
      error?.message ||
      'Não foi possível abrir o cadastro do policial.'
    )
  } finally {
    setAbrindoPolicial(false)
  }
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

        <div className="armas-header-actions">
          <button
            type="button"
            className="armas-btn-primary"
            onClick={abrirNovoCadastro}
          >
            Nova arma
          </button>
        </div>
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
            <h2>Carga patrimonial</h2>
          </div>
          {loadingResumo && <small>Atualizando indicadores...</small>}
        </div>

        <div className="armas-resumo-grid armas-resumo-grid-carga">
          <ArmaResumoCard
            titulo="Carga total"
            valor={resumo.total.total}
            descricao="Armamento cadastrado"
            destaque="azul"
            onClick={resumo.total.total ? () => abrirPainelResumo(
              'TODAS',
              'Carga patrimonial completa',
              'Todas as armas cadastradas no SIGMO.'
            ) : undefined}
          />
          <ArmaResumoCard
            titulo="Pistolas"
            valor={resumo.total.pistolas}
            descricao="Quantidade total de pistolas"
            destaque="verde"
            onClick={resumo.total.pistolas ? () => abrirPainelResumo(
              'TODAS',
              'Pistolas cadastradas',
              'Todas as pistolas cadastradas no SIGMO.',
              'PISTOLA'
            ) : undefined}
          />
          <ArmaResumoCard
            titulo="Fuzis"
            valor={resumo.total.fuzis}
            descricao="Quantidade total de fuzis"
            destaque="amarelo"
            onClick={resumo.total.fuzis ? () => abrirPainelResumo(
              'TODAS',
              'Fuzis cadastrados',
              'Todos os fuzis cadastrados no SIGMO.',
              'FUZIL'
            ) : undefined}
          />
          <ArmaResumoCard
            titulo="Espingardas"
            valor={resumo.total.espingardas}
            descricao="Quantidade total de espingardas calibre 12"
            destaque="roxo"
            onClick={resumo.total.espingardas ? () => abrirPainelResumo(
              'TODAS',
              'Espingardas cadastradas',
              'Todas as espingardas calibre 12 cadastradas no SIGMO.',
              'ESPINGARDA'
            ) : undefined}
          />
        </div>
      </section>

      <section className="armas-dashboard-section">
        <div className="armas-section-title">
          <div>
            <span>Distribuição atual</span>
            <h2>Onde estão as armas</h2>
          </div>
        </div>

        <div className="armas-resumo-grid">
          {!ehPerfilSVDD && (
            <ArmaResumoCard
              titulo="Depósito do P4"
              detalhes={detalhesEspecies(resumo.p4)}
              descricao="Armas sob guarda do P4"
              onClick={resumo.p4.total ? () => abrirPainelResumo('P4', 'Armas no Depósito do P4', 'Armamento atualmente sob guarda patrimonial do P4.') : undefined}
              onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('P4', 'Depósito do P4', 'Armamento atualmente sob guarda patrimonial do P4.', detalhe)}
            />
          )}
          <ArmaResumoCard
            titulo="Cofre do SVDD"
            detalhes={detalhesEspecies(resumo.svdd)}
            descricao="Armas sob gestão do Serviço de Dia"
            destaque="verde"
            onClick={resumo.svdd.total ? () => abrirPainelResumo('SVDD', 'Armas no Cofre do SVDD', 'Armamento atualmente sob guarda do Serviço de Dia.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('SVDD', 'Cofre do SVDD', 'Armamento atualmente sob guarda do Serviço de Dia.', detalhe)}
          />
          {!ehPerfilSVDD && (
            <ArmaResumoCard
              titulo="Carga permanente"
              detalhes={detalhesEspecies(resumo.carga)}
              descricao="Vinculadas permanentemente a policiais"
              destaque="azul"
              onClick={resumo.carga.total ? () => abrirPainelResumo('CARGA', 'Carga permanente', 'Armas vinculadas permanentemente a policiais.') : undefined}
              onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('CARGA', 'Carga permanente', 'Armas vinculadas permanentemente a policiais.', detalhe)}
            />
          )}
          <ArmaResumoCard
            titulo="Cautelas ativas"
            detalhes={detalhesEspecies(resumo.cautelas)}
            descricao="Entregas temporárias a policiais"
            destaque="amarelo"
            onClick={resumo.cautelas.total ? () => abrirPainelResumo('CAUTELADAS', 'Armas cauteladas', 'Armamento sob cautela, com identificação do responsável.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('CAUTELADAS', 'Cautelas ativas', 'Armamento sob cautela, com identificação do responsável.', detalhe)}
          />
          <ArmaResumoCard
            titulo="Manutenção"
            detalhes={detalhesEspecies(resumo.manutencao)}
            descricao="Fora de disponibilidade para reparo"
            destaque="laranja"
            onClick={resumo.manutencao.total ? () => abrirPainelResumo('MANUTENCAO', 'Armas em manutenção', 'Armamento temporariamente indisponível para reparo.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('MANUTENCAO', 'Manutenção', 'Armamento temporariamente indisponível para reparo.', detalhe)}
          />
          <ArmaResumoCard
            titulo="Recolhidas"
            detalhes={detalhesEspecies(resumo.recolhidas)}
            descricao="Recolhidas e indisponíveis"
            destaque="azul"
            onClick={resumo.recolhidas.total ? () => abrirPainelResumo('RECOLHIDAS', 'Armas recolhidas', 'Armamento recolhido e indisponível para utilização.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('RECOLHIDAS', 'Recolhidas', 'Armamento recolhido e indisponível para utilização.', detalhe)}
          />
          <ArmaResumoCard
            titulo="Apreendidas"
            detalhes={detalhesEspecies(resumo.apreendidas)}
            descricao="Registradas como apreendidas"
            destaque="roxo"
            onClick={resumo.apreendidas.total ? () => abrirPainelResumo('APREENDIDAS', 'Armas apreendidas', 'Armamento registrado como apreendido.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('APREENDIDAS', 'Apreendidas', 'Armamento registrado como apreendido.', detalhe)}
          />
          <ArmaResumoCard
            titulo="Baixadas"
            detalhes={detalhesEspecies(resumo.baixadas)}
            descricao="Controle patrimonial encerrado"
            destaque="vermelho"
            onClick={resumo.baixadas.total ? () => abrirPainelResumo('BAIXADAS', 'Armas baixadas', 'Armamento com controle patrimonial encerrado.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('BAIXADAS', 'Baixadas', 'Armamento com controle patrimonial encerrado.', detalhe)}
          />
          <ArmaResumoCard
            titulo="Não localizadas"
            detalhes={detalhesEspecies(resumo.naoLocalizadas)}
            descricao="Com localização pendente"
            destaque="vermelho"
            onClick={resumo.naoLocalizadas.total ? () => abrirPainelResumo('NAO_LOCALIZADAS', 'Armas não localizadas', 'Armamento com localização pendente de regularização.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('NAO_LOCALIZADAS', 'Não localizadas', 'Armamento com localização pendente de regularização.', detalhe)}
          />
          <ArmaResumoCard
            titulo="Outras situações"
            detalhes={detalhesEspecies(resumo.outros)}
            descricao="Demais classificações patrimoniais"
            onClick={resumo.outros.total ? () => abrirPainelResumo('OUTROS', 'Outras situações', 'Armas em situações não contempladas nos demais grupos.') : undefined}
            onDetalheClick={(detalhe) => abrirPainelResumoPorEspecie('OUTROS', 'Outras situações', 'Armas em situações não contempladas nos demais grupos.', detalhe)}
          />
          <ArmaResumoCard
  titulo="Armas particulares"
  detalhes={detalhesEspecies(resumo.particulares)}
  descricao="Armamento particular cadastrado"
  destaque="azul"
  onClick={
    resumo.particulares.total
      ? () =>
          abrirPainelResumo(
            'PARTICULARES',
            'Armas particulares',
            'Armamento particular cadastrado no SIGMO.'
          )
      : undefined
  }
  onDetalheClick={(detalhe) =>
    abrirPainelResumoPorEspecie(
      'PARTICULARES',
      'Armas particulares',
      'Armamento particular cadastrado no SIGMO.',
      detalhe
    )
  }
       />
        </div>
      </section>

      {!ehPerfilSVDD && (
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
      )}

      <section className="armas-toolbar">
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
        <div
          className="armas-form-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) fecharFormulario()
          }}
        >
          <section
            className="armas-form-modal"
            role="dialog"
            aria-modal="true"
            aria-label={armaEditando ? 'Editar arma' : 'Cadastrar arma'}
          >
            <ArmaForm
              user={user}
              armaEditando={armaEditando}
              onCancel={fecharFormulario}
              onSaved={handleSaved}
            />
          </section>
        </div>
      )}

      <section
        ref={listaRef}
        className={`armas-list-card ${destacarLista ? 'armas-list-card-destaque' : ''}`}
      >
        <div className="armas-list-header">
          <div className="armas-list-title">
            <h2>Armamento cadastrado</h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>

          <div className="armas-list-search">
            <label htmlFor="pesquisa">Pesquisar armamento</label>

            <div className="armas-list-search-control">
              <input
                id="pesquisa"
                name="pesquisa"
                type="search"
                value={filtros.pesquisa}
                onChange={handleFiltroChange}
                placeholder="RE, série, patrimônio ou nome"
              />

              {filtros.pesquisa && (
                <button
                  type="button"
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, pesquisa: '' }))
                  }
                  aria-label="Limpar pesquisa"
                  title="Limpar pesquisa"
                >
                  ×
                </button>
              )}
            </div>
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
          <>
            <div
              ref={tabelaScrollTopoRef}
              className="armas-table-scroll-top"
              onScroll={(event) => {
                if (tabelaScrollRef.current) {
                  tabelaScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
                }
              }}
            >
              <div style={{ width: larguraTabela, height: 1 }} />
            </div>

            <div
              ref={tabelaScrollRef}
              className="armas-table-wrap"
              onScroll={(event) => {
                if (tabelaScrollTopoRef.current) {
                  tabelaScrollTopoRef.current.scrollLeft = event.currentTarget.scrollLeft
                }
              }}
            >
            <table ref={tabelaRef} className="armas-table">
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
                  <th>Responsável</th>

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
                      {arma.proprietario_nome || arma.responsavel_nome || '-'}
                      {(arma.proprietario_re || arma.responsavel_re) && (
                        <small className="armas-responsavel-re">
                          RE {arma.proprietario_re || arma.responsavel_re}
                        </small>
                      )}
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
                          onClick={() => abrirVisualizacao(arma)}
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
          </>
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

      {painelResumo && (
        <div
          className="armas-resumo-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPainelResumo(null)
          }}
        >
          <section
            className="armas-resumo-modal"
            role="dialog"
            aria-modal="true"
            aria-label={painelResumo.titulo}
          >
            <header>
              <div>
                <span>Visão patrimonial</span>
                <h2>{painelResumo.titulo}</h2>
                <p>{painelResumo.descricao}</p>
              </div>
              <button type="button" onClick={() => setPainelResumo(null)} aria-label="Fechar">×</button>
            </header>

            <div className="armas-resumo-modal-contagem">
              <strong>{itensPainelResumo.length}</strong>
              <span>{itensPainelResumo.length === 1 ? 'arma encontrada' : 'armas encontradas'}</span>
            </div>

            <div className="armas-resumo-modal-lista">
              {itensPainelResumo.map((arma) => (
                <button
                  type="button"
                  className="armas-resumo-modal-item"
                  key={arma.id}
                  onClick={() => {
                    setPainelResumo(null)
                    abrirVisualizacao(arma)
                  }}
                >
                  <div className="armas-resumo-modal-identificacao">
                    <strong>{arma.patrimonio || arma.numero_serie || 'Arma sem identificação'}</strong>
                    <span>{[arma.especie, arma.marca, arma.modelo].filter(Boolean).join(' • ') || 'Dados não informados'}</span>
                    <small>{arma.calibre ? `Calibre ${arma.calibre}` : 'Calibre não informado'}</small>
                  </div>
                  <div className="armas-resumo-modal-responsavel">
                    {(() => {
                      const responsavel = obterResponsavelArma(arma)
                      return (
                        <>
                          <strong>{responsavel.nome || 'Sem responsável informado'}</strong>
                          <span>{responsavel.re ? `RE ${responsavel.re}` : 'RE não informado'}</span>
                          <small>{obterLocalArma(arma) || obterStatusArma(arma) || 'Situação não informada'}</small>
                        </>
                      )
                    })()}
                  </div>
                  <span className="armas-resumo-modal-ver">Visualizar →</span>
                </button>
              ))}
            </div>

            <footer>
              <button type="button" onClick={() => setPainelResumo(null)}>Fechar</button>
            </footer>
          </section>
        </div>
      )}

      {armaVisualizando && (
        <ArmaViewModal
          arma={armaVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={loadingFotosVisualizacao}
          onClose={() => setArmaVisualizando(null)}
          onEdit={(arma) => {
            setArmaVisualizando(null)
            abrirEdicao(arma)
          }}
          onAbrirPolicial={(re) => {
  if (!re) return
  abrirPolicialResponsavel(re)
}}
        />
      )}


    {policialVisualizando && (
  <PolicialViewModal
    policial={policialVisualizando}
    fotos={fotosPolicial}
    user={user}
    modoLateral
    onClose={() => {
      setPolicialVisualizando(null)
      setFotosPolicial([])
    }}
  />
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