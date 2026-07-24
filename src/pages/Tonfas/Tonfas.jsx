import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import { TIPOS_TONFA, STATUS_TONFA } from '../../constants/tonfas'
import { UNIDADES_27_BPMM } from '../../constants/unidades'
import {
  excluirTonfa,
  listarTonfas
} from '../../services/tonfasService'
import {
  criarTransferenciaPendente
} from '../../services/patrimonioTransferenciaService'
import { listarFotosTonfa } from '../../services/tonfasFotosService'
import TonfaForm from './components/TonfaForm'
import TonfaTable from './components/TonfaTable'
import TonfaTransferenciaModal from './components/TonfaTransferenciaModal'
import HistoricoPatrimonial from '../../components/Patrimonio/HistoricoPatrimonial'
import PagarMaterial from '../PagarMaterial/PagarMaterial'
import ReceberMaterial from '../ReceberMaterial/ReceberMaterial'
import TonfaReceberP4 from './components/TonfaReceberP4'
import './styles/Tonfas.css'
import './styles/TonfaFotos.css'
import './styles/TonfaFotoCard.css'

const LIMITE = 20
const LIMITE_RESUMO = 5000

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function obterPerfil(user) {
  return normalizarTexto(
    user?.perfil ||
      user?.role ||
      user?.tipo_perfil ||
      user?.nome_perfil ||
      user?.usuario?.perfil
  )
}

function obterVisaoPerfil(user) {
  const perfil = obterPerfil(user)

  const perfilSVDD =
    perfil.includes('SVDD') ||
    perfil.includes('ENCARREGADO DO SVDD') ||
    perfil.includes('AUXILIAR DO SVDD')

  const perfilP4 =
    perfil.includes('P4') ||
    perfil.includes('MATERIAL') ||
    perfil.includes('ADMINISTRADOR') ||
    perfil.includes('COMANDANTE')

  if (perfilSVDD) return 'SVDD'
  if (perfilP4) return 'P4'

  return 'POLICIAL'
}

function obterLocal(item) {
  return normalizarTexto(
    item?.local_atual ||
      item?.localizacao_atual ||
      item?.localizacao ||
      item?.local ||
      ''
  )
}

function resumirLocalAtual(valor) {
  const original = String(valor || '').trim()
  const normalizado = normalizarTexto(original)

  if (/^\d+(?:[.,]\d+)?\s+NO\s+P4$/.test(normalizado)) {
    return 'P4'
  }

  if (/^\d+(?:[.,]\d+)?\s+NO\s+SERVICO\s+DE\s+DIA$/.test(normalizado)) {
    return 'SERVIÇO DE DIA'
  }

  if (/^\d+(?:[.,]\d+)?\s+EM\s+SERVICO$/.test(normalizado)) {
    return 'MATERIAIS EM SERVIÇO'
  }

  return original || '—'
}

function prepararTonfaParaExibicao(item) {
  return {
    ...item,
    local_atual: resumirLocalAtual(item?.local_atual)
  }
}

function obterStatus(item) {
  return normalizarTexto(
    item?.status_operacional ||
      item?.status ||
      item?.situacao_operacional ||
      ''
  )
}

function obterQuantidade(item) {
  const quantidade = Number(
    item?.quantidade_total ??
      item?.quantidade ??
      item?.saldo_total ??
      1
  )

  return Number.isFinite(quantidade) && quantidade > 0
    ? quantidade
    : 1
}

function somarQuantidades(itens) {
  return itens.reduce(
    (total, item) => total + obterQuantidade(item),
    0
  )
}

function resumirPorTipo(itens) {
  return {
    tonfas: somarQuantidades(
      itens.filter(
        (item) => normalizarTexto(item?.tipo) === 'TONFA'
      )
    ),
    cassetetes: somarQuantidades(
      itens.filter(
        (item) => normalizarTexto(item?.tipo) === 'CASSETETE'
      )
    )
  }
}

function estaNaoLocalizado(item) {
  const local = obterLocal(item)
  const status = obterStatus(item)

  return (
    !local ||
    local.includes('NAO LOCALIZADO') ||
    status.includes('NAO LOCALIZADO')
  )
}

function estaNoP4(item) {
  return Number(item?.quantidade_p4 || 0) > 0
}

function estaNoSVDD(item) {
  return Number(item?.quantidade_svdd || 0) > 0
}

function estaEmCarga(item) {
  const quantidadeEmServico =
    Number(item?.quantidade_em_servico || 0)

  return quantidadeEmServico > 0
}

function estaEmCautela(item) {
  const status = obterStatus(item)
  const local = obterLocal(item)

  return (
    status.includes('CAUTELA') ||
    status.includes('CAUTELADO') ||
    local.includes('CAUTELA') ||
    local.includes('EM SERVICO')
  )
}

function estaEmManutencao(item) {
  const status = obterStatus(item)
  const local = obterLocal(item)

  return (
    status.includes('MANUTENCAO') ||
    local.includes('MANUTENCAO')
  )
}

function estaBaixado(item) {
  return obterStatus(item).includes('BAIXADO')
}

function estaEmOutraCia(item) {
  const local = obterLocal(item)

  return (
    local.includes('OUTRA CIA') ||
    local.includes('OUTRA COMPANHIA') ||
    local.includes('1 CIA') ||
    local.includes('2 CIA') ||
    local.includes('3 CIA') ||
    local.includes('4 CIA')
  )
}

function estaNaFT(item) {
  const local = obterLocal(item)

  return (
    local === 'FT' ||
    local.includes('FORCA TATICA')
  )
}

function estaNoBTL(item) {
  const local = obterLocal(item)

  return (
    local === 'BTL' ||
    local.includes('BATALHAO')
  )
}

function possuiCautelaVencida(item) {
  if (!estaEmCautela(item)) return false

  const previsao =
    item?.previsao_devolucao ||
    item?.data_prevista_devolucao ||
    item?.cautela_previsao_devolucao

  if (!previsao) return false

  const data = new Date(previsao)

  if (Number.isNaN(data.getTime())) return false

  return data.getTime() < Date.now()
}

function CardResumo({
  titulo,
  valor,
  descricao,
  detalhes = [],
  detalhesSecundarios = [],
  destaque = 'padrao',
  onClick
}) {
  const clicavel = typeof onClick === 'function'
  const possuiValor =
    valor !== undefined &&
    valor !== null &&
    valor !== ''

  const possuiDetalhes =
    detalhes.length > 0 ||
    detalhesSecundarios.length > 0

  function renderDetalhes(itens, prefixo) {
    return itens.map((item, index) => (
      <div key={`${prefixo}-${item.titulo}-${index}`}>
        <span>{item.titulo}</span>
        <strong>{item.valor}</strong>
      </div>
    ))
  }

  return (
    <button
      type="button"
      className={`tonfa-resumo-card tonfa-resumo-${destaque} ${
        clicavel ? 'tonfa-resumo-clicavel' : ''
      } ${
        possuiDetalhes
          ? 'tonfa-resumo-card-com-detalhes'
          : ''
      }`}
      onClick={onClick}
      disabled={!clicavel}
    >
      <span className="tonfa-resumo-titulo">
        {titulo}
      </span>

      {possuiValor && (
        <strong className="tonfa-resumo-valor">
          {valor}
        </strong>
      )}

      {detalhes.length > 0 && (
        <div className="tonfa-resumo-detalhes">
          {renderDetalhes(detalhes, 'principal')}
        </div>
      )}

      {detalhesSecundarios.length > 0 && (
        <div className="tonfa-resumo-bloco-secundario">
          <div className="tonfa-resumo-divisor" />

          <div className="tonfa-resumo-detalhes">
            {renderDetalhes(
              detalhesSecundarios,
              'secundario'
            )}
          </div>
        </div>
      )}

      {descricao && <small>{descricao}</small>}
    </button>
  )
}


function limitarPercentual(valor) {
  const numero = Number(valor || 0)

  if (!Number.isFinite(numero)) return 0

  return Math.max(0, Math.min(100, numero))
}

function percentual(valor, total) {
  const base = Number(total || 0)
  const parte = Number(valor || 0)

  if (!base || !Number.isFinite(parte)) return 0

  return limitarPercentual((parte / base) * 100)
}

function formatarPercentual(valor) {
  return `${Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`
}

function GraficoRosca({ resumo }) {
  const total = Number(resumo.totalGeral || 0)
  const p4 = Number(resumo.depositoP4 || 0)
  const svdd = Number(
    (resumo.cofreSVDD?.tonfas || 0) +
      (resumo.cofreSVDD?.cassetetes || 0)
  )
  const carga = Number(resumo.cargas || 0)
  const cautelas = Number(resumo.cautelas || 0)
  const naoLocalizadas = Number(resumo.naoLocalizadas || 0)

  const fatias = [
    { label: 'Depósito do P4', valor: p4, classe: 'p4' },
    { label: 'Carga do SVDD', valor: svdd, classe: 'svdd' },
    { label: 'Carga permanente', valor: carga, classe: 'carga' },
    { label: 'Cautelas ativas', valor: cautelas, classe: 'cautela' },
    { label: 'Não localizadas', valor: naoLocalizadas, classe: 'nao-localizada' }
  ]

  const cores = {
    p4: '#22c55e',
    svdd: '#7c3aed',
    carga: '#f97316',
    cautela: '#facc15',
    'nao-localizada': '#ef4444'
  }

  let acumulado = 0
  const partes = fatias.map((item) => {
    const inicio = acumulado
    const fim = acumulado + percentual(item.valor, total)
    acumulado = fim

    return `${cores[item.classe]} ${inicio}% ${fim}%`
  })

  if (acumulado < 100) {
    partes.push(`#e8edf5 ${acumulado}% 100%`)
  }

  return (
    <div className="tonfa-grafico-card tonfa-grafico-card-rosca">
      <div className="tonfa-grafico-header">
        <div>
          <span>Visão consolidada</span>
          <h3>Distribuição por localização</h3>
        </div>
      </div>

      <div className="tonfa-rosca-layout">
        <div
          className="tonfa-rosca"
          style={{
            background: `conic-gradient(${partes.join(', ')})`
          }}
        >
          <div className="tonfa-rosca-centro">
            <strong>{total}</strong>
            <span>Total</span>
            <small>Tonfas + Cassetetes</small>
          </div>
        </div>

        <div className="tonfa-grafico-legenda">
          {fatias.map((item) => {
            const valorPercentual = percentual(item.valor, total)

            return (
              <div key={item.label}>
                <i className={`tonfa-legenda-cor tonfa-legenda-${item.classe}`} />
                <span>{item.label}</span>
                <strong>{item.valor}</strong>
                <small>{formatarPercentual(valorPercentual)}</small>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GraficoBarras({ resumo }) {
  const categorias = [
    {
      label: 'Depósito do P4',
      tonfas: resumo.distribuicao?.depositoP4?.tonfas || 0,
      cassetetes: resumo.distribuicao?.depositoP4?.cassetetes || 0
    },
    {
      label: 'Carga do SVDD',
      tonfas: resumo.cofreSVDD?.tonfas || 0,
      cassetetes: resumo.cofreSVDD?.cassetetes || 0
    },
    {
      label: 'Carga permanente',
      tonfas: resumo.distribuicao?.cargaPermanente?.tonfas || 0,
      cassetetes: resumo.distribuicao?.cargaPermanente?.cassetetes || 0
    },
    {
      label: 'Cautelas',
      tonfas: resumo.distribuicao?.cautelas?.tonfas || 0,
      cassetetes: resumo.distribuicao?.cautelas?.cassetetes || 0
    },
    {
      label: 'Não localizadas',
      tonfas: resumo.distribuicaoNaoLocalizada?.tonfas || 0,
      cassetetes: resumo.distribuicaoNaoLocalizada?.cassetetes || 0
    }
  ]

  const maior = Math.max(
    1,
    ...categorias.flatMap((item) => [
      Number(item.tonfas || 0),
      Number(item.cassetetes || 0)
    ])
  )

  return (
    <div className="tonfa-grafico-card tonfa-grafico-card-barras">
      <div className="tonfa-grafico-header">
        <div>
          <span>Comparativo por material</span>
          <h3>Tonfas e Cassetetes por localização</h3>
        </div>

        <div className="tonfa-barras-legenda">
          <span><i className="tonfa-legenda-cor tonfa-legenda-tonfa" />Tonfas</span>
          <span><i className="tonfa-legenda-cor tonfa-legenda-cassetete" />Cassetetes</span>
        </div>
      </div>

      <div className="tonfa-barras-area">
        {categorias.map((item) => (
          <div className="tonfa-barra-grupo" key={item.label}>
            <div className="tonfa-barra-colunas">
              <div className="tonfa-barra-coluna">
                <strong>{item.tonfas}</strong>
                <div
                  className="tonfa-barra tonfa-barra-tonfa"
                  style={{
                    height: `${Math.max(8, percentual(item.tonfas, maior))}%`
                  }}
                />
              </div>

              <div className="tonfa-barra-coluna">
                <strong>{item.cassetetes}</strong>
                <div
                  className="tonfa-barra tonfa-barra-cassetete"
                  style={{
                    height: `${Math.max(8, percentual(item.cassetetes, maior))}%`
                  }}
                />
              </div>
            </div>

            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResumoMaterial({ titulo, valor, itens, tipo }) {
  return (
    <article className={`tonfa-material-resumo tonfa-material-${tipo}`}>
      <div className="tonfa-material-resumo-header">
        <div className="tonfa-material-icone">
          {tipo === 'tonfa' ? '╱' : '│'}
        </div>

        <div>
          <span>{titulo}</span>
          <strong>{valor} unidades</strong>
        </div>
      </div>

      <div className="tonfa-material-resumo-lista">
        {itens.map((item) => (
          <div key={item.label}>
            <i className={`tonfa-legenda-cor tonfa-legenda-${item.classe}`} />
            <span>{item.label}</span>
            <strong>{item.valor}</strong>
            <small>{formatarPercentual(percentual(item.valor, valor))}</small>
          </div>
        ))}
      </div>
    </article>
  )
}

function PainelGraficosTonfas({ resumo }) {
  const tonfas = Number(resumo.totalTonfas || 0)
  const cassetetes = Number(resumo.totalCassetetes || 0)

  return (
    <section className="tonfa-dashboard-section tonfa-graficos-section">
      <div className="tonfa-section-title tonfa-section-title-graficos">
        <div>
          <span>Painel gráfico</span>
          <h2>Distribuição de Tonfas e Cassetetes</h2>
        </div>

        <small>Atualizado com os saldos patrimoniais atuais</small>
      </div>

      <div className="tonfa-graficos-principais">
        <GraficoRosca resumo={resumo} />
        <GraficoBarras resumo={resumo} />
      </div>

      <div className="tonfa-resumo-materiais-grid">
        <ResumoMaterial
          titulo="Tonfas"
          valor={tonfas}
          tipo="tonfa"
          itens={[
            { label: 'Depósito do P4', valor: resumo.distribuicao?.depositoP4?.tonfas || 0, classe: 'p4' },
            { label: 'Carga do SVDD', valor: resumo.cofreSVDD?.tonfas || 0, classe: 'svdd' },
            { label: 'Carga permanente', valor: resumo.distribuicao?.cargaPermanente?.tonfas || 0, classe: 'carga' },
            { label: 'Cautelas ativas', valor: resumo.distribuicao?.cautelas?.tonfas || 0, classe: 'cautela' },
            { label: 'Não localizadas', valor: resumo.distribuicaoNaoLocalizada?.tonfas || 0, classe: 'nao-localizada' }
          ]}
        />

        <ResumoMaterial
          titulo="Cassetetes"
          valor={cassetetes}
          tipo="cassetete"
          itens={[
            { label: 'Depósito do P4', valor: resumo.distribuicao?.depositoP4?.cassetetes || 0, classe: 'p4' },
            { label: 'Carga do SVDD', valor: resumo.cofreSVDD?.cassetetes || 0, classe: 'svdd' },
            { label: 'Carga permanente', valor: resumo.distribuicao?.cargaPermanente?.cassetetes || 0, classe: 'carga' },
            { label: 'Cautelas ativas', valor: resumo.distribuicao?.cautelas?.cassetetes || 0, classe: 'cautela' },
            { label: 'Não localizadas', valor: resumo.distribuicaoNaoLocalizada?.cassetetes || 0, classe: 'nao-localizada' }
          ]}
        />
      </div>
    </section>
  )
}

function GrupoMovimentacao({
  icone,
  titulo,
  descricao,
  children
}) {
  return (
    <div className="tonfa-movement-group">
      <div className="tonfa-movement-group-header">
        <div className="tonfa-movement-group-icon">
          {icone}
        </div>

        <div>
          <h3>{titulo}</h3>
          <p>{descricao}</p>
        </div>
      </div>

      <div className="tonfa-action-grid">
        {children}
      </div>
    </div>
  )
}

export default function Tonfas({ user }) {
  const [tonfas, setTonfas] = useState([])
  const [tonfasResumo, setTonfasResumo] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [erro, setErro] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [visualizando, setVisualizando] = useState(null)
  const [fotos, setFotos] = useState([])
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [transferenciaAberta, setTransferenciaAberta] = useState(false)
  const [transferenciaModo, setTransferenciaModo] = useState('P4_SVDD')
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [movimentacaoAtiva, setMovimentacaoAtiva] = useState(null)

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo: '',
    status_operacional: '',
    unidade: ''
  })

  const visaoPerfil = useMemo(
    () => obterVisaoPerfil(user),
    [user]
  )

  const perfilUsuario = useMemo(
    () => obterPerfil(user),
    [user]
  )

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarTonfas({
        filtros,
        pagina,
        limite: LIMITE
      })

      setTonfas((resultado.data || []).map(prepararTonfaParaExibicao))
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao carregar Tonfas e Cassetetes.'
      )
    } finally {
      setLoading(false)
    }
  }, [filtros, pagina])

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true)

      const resultado = await listarTonfas({
        filtros: {
          pesquisa: '',
          tipo: '',
          status_operacional: '',
          unidade: ''
        },
        pagina: 1,
        limite: LIMITE_RESUMO
      })

      setTonfasResumo((resultado.data || []).map(prepararTonfaParaExibicao))
    } catch (error) {
      console.error(
        'Erro ao carregar resumo patrimonial:',
        error
      )

      setTonfasResumo([])
    } finally {
      setLoadingResumo(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  const resumo = useMemo(() => {
    const base = tonfasResumo

    const totalGeral = somarQuantidades(base)

    const totalTonfas = somarQuantidades(
      base.filter(
        (item) => normalizarTexto(item?.tipo) === 'TONFA'
      )
    )

    const totalCassetetes = somarQuantidades(
      base.filter(
        (item) =>
          normalizarTexto(item?.tipo) === 'CASSETETE'
      )
    )

    const itensNaoLocalizados = base.filter(
      estaNaoLocalizado
    )
    const itensDepositoP4 = base.filter(estaNoP4)
    const itensNoCofreSVDD = base.filter(estaNoSVDD)
    const itensEmServicoSVDD = base.filter(
      (item) =>
        estaEmCautela(item) &&
        !estaNoSVDD(item)
    )

    const itensSobResponsabilidadeSVDD = [
      ...itensNoCofreSVDD,
      ...itensEmServicoSVDD
    ]

    const itensCarga = base.filter(estaEmCarga)
    const itensCautela = base.filter(estaEmCautela)
    const itensManutencao = base.filter(
      estaEmManutencao
    )
    const itensOutraCia = base.filter(estaEmOutraCia)
    const itensFT = base.filter(estaNaFT)
    const itensBTL = base.filter(estaNoBTL)
    const itensBaixados = base.filter(estaBaixado)

    const itensOutros = base.filter(
      (item) =>
        !estaNaoLocalizado(item) &&
        !estaNoP4(item) &&
        !estaNoSVDD(item) &&
        !estaEmCarga(item) &&
        !estaEmCautela(item) &&
        !estaEmManutencao(item) &&
        !estaEmOutraCia(item) &&
        !estaNaFT(item) &&
        !estaNoBTL(item) &&
        !estaBaixado(item)
    )

    const depositoP4PorTipo =
  resumirSaldoPorTipo(
    base,
    'quantidade_p4'
  )

const cofreSVDDPorTipo =
  resumirSaldoPorTipo(
    base,
    'quantidade_svdd'
  )

const emServicoPorTipo =
  resumirSaldoPorTipo(
    base,
    'quantidade_em_servico'
  )

function resumirSaldoPorTipo(
  itens,
  campo
) {
  return {
    tonfas: itens
      .filter(
        (item) =>
          normalizarTexto(item?.tipo) ===
          'TONFA'
      )
      .reduce(
        (total, item) =>
          total +
          Number(item?.[campo] || 0),
        0
      ),

    cassetetes: itens
      .filter(
        (item) =>
          normalizarTexto(item?.tipo) ===
          'CASSETETE'
      )
      .reduce(
        (total, item) =>
          total +
          Number(item?.[campo] || 0),
        0
      )
  }
}

    return {
      totalGeral,
      totalTonfas,
      totalCassetetes,
      naoLocalizadas: somarQuantidades(
        itensNaoLocalizados
      ),
      localizadas:
        totalGeral -
        somarQuantidades(itensNaoLocalizados),

      depositoP4:
  depositoP4PorTipo.tonfas +
  depositoP4PorTipo.cassetetes,

cofreSVDD: {
  tonfas:
    cofreSVDDPorTipo.tonfas +
    emServicoPorTipo.tonfas,

  cassetetes:
    cofreSVDDPorTipo.cassetetes +
    emServicoPorTipo.cassetetes,

  noCofreTonfas:
    cofreSVDDPorTipo.tonfas,

  noCofreCassetetes:
    cofreSVDDPorTipo.cassetetes,

  emServicoTonfas:
    emServicoPorTipo.tonfas,

  emServicoCassetetes:
    emServicoPorTipo.cassetetes
},

      cargas: somarQuantidades(itensCarga),
      cautelas: somarQuantidades(itensCautela),
      cautelasVencidas: somarQuantidades(
        base.filter(possuiCautelaVencida)
      ),
      manutencao: somarQuantidades(itensManutencao),
      outraCia: somarQuantidades(itensOutraCia),
      ft: somarQuantidades(itensFT),
      btl: somarQuantidades(itensBTL),
      baixados: somarQuantidades(itensBaixados),
outros: somarQuantidades(itensOutros),

distribuicaoNaoLocalizada: resumirPorTipo(
  itensNaoLocalizados
),

distribuicao: {
  depositoP4:
  depositoP4PorTipo,
  cargaPermanente: resumirPorTipo(itensCarga),
  cautelas: resumirPorTipo(itensCautela),
  manutencao: resumirPorTipo(itensManutencao),
  outraCia: resumirPorTipo(itensOutraCia),
  forcaTatica: resumirPorTipo(itensFT),
  batalhao: resumirPorTipo(itensBTL),
  baixados: resumirPorTipo(itensBaixados),
  outros: resumirPorTipo(itensOutros)
}
    }
  }, [tonfasResumo])

  const tonfasDoPolicial = useMemo(() => {
    const policialId = String(
      user?.policial_id ||
        user?.id_policial ||
        user?.policial?.id ||
        user?.id ||
        ''
    )

    const reUsuario = normalizarTexto(
      user?.re ||
        user?.policial_re ||
        user?.usuario?.re ||
        user?.policial?.re
    )

    return tonfasResumo.filter((item) => {
      const responsavelId = String(
        item?.responsavel_policial_id ||
          item?.carga_policial_id ||
          item?.policial_id ||
          ''
      )

      const responsavelRe = normalizarTexto(
        item?.responsavel_re ||
          item?.carga_policial_re ||
          item?.policial_re
      )

      return (
        (policialId && responsavelId === policialId) ||
        (reUsuario && responsavelRe === reUsuario)
      )
    })
  }, [tonfasResumo, user])

  const resumoPolicial = useMemo(
    () => ({
      total: tonfasDoPolicial.length,
      cargas: tonfasDoPolicial.filter(estaEmCarga).length,
      cautelas: tonfasDoPolicial.filter(estaEmCautela)
        .length,
      vencidas: tonfasDoPolicial.filter(
        possuiCautelaVencida
      ).length
    }),
    [tonfasDoPolicial]
  )

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
      tipo: '',
      status_operacional: '',
      unidade: ''
    })

    setPagina(1)
  }

  function filtrarPorPesquisa(pesquisa) {
    setFiltros((prev) => ({
      ...prev,
      pesquisa,
      status_operacional: ''
    }))

    setPagina(1)
  }

  function filtrarPorStatus(status_operacional) {
    setFiltros((prev) => ({
      ...prev,
      pesquisa: '',
      status_operacional
    }))

    setPagina(1)
  }

  function abrirNovoCadastro() {
    setEditando(null)
    setFormAberto(true)
  }

  function iniciarMovimentacao(tipo) {
    setMensagemSucesso('')

    if (tipo === 'Transferência') {
      setTransferenciaModo('P4_SVDD')
      setTransferenciaAberta(true)
      return
    }

    const pagamentos = [
      'Pagamento de carga permanente',
      'Pagamento de cautela'
    ]

    const recebimentos = [
      'Recebimento de devolução',
      'Recebimento de cautela'
    ]

    if (pagamentos.includes(tipo)) {
      setMovimentacaoAtiva('PAGAR')
      return
    }

    if (recebimentos.includes(tipo)) {
      setMovimentacaoAtiva('RECEBER')
      return
    }

    if (tipo === 'Recebimento do P4') {
      setMovimentacaoAtiva('RECEBER_P4')
      return
    }

    if (tipo === 'Devolução ao P4') {
      setTransferenciaModo('SVDD_P4')
      setTransferenciaAberta(true)
      return
    }

    if (tipo === 'Recebimento de devolução do SVDD') {
      setMovimentacaoAtiva('RECEBER_DEVOLUCAO_P4')
      return
    }

    const operacoesPendentes = {
      'Recebimento de manutenção':
        'O fluxo específico de retorno da manutenção ainda não possui formulário no projeto.',
      'Retorno da manutenção':
        'O fluxo específico de retorno da manutenção ainda não possui formulário no projeto.',
      'Envio para manutenção':
        'O envio para manutenção ainda não possui formulário no projeto.',
      'Regularização patrimonial':
        'A regularização patrimonial ainda não possui formulário no projeto.',
      'Baixa patrimonial':
        'A baixa patrimonial ainda não possui formulário no projeto.',
      
    }

    setMensagemSucesso(
      operacoesPendentes[tipo] ||
        `${tipo} ainda não possui formulário conectado.`
    )
  }

 async function confirmarTransferencia({
  tonfaId,
  categoria,
  patrimonioId,
  itemId,
  quantidade,

  origemCodigo,
  origemNome,

  destinoCodigo,
  destinoNome,

  motivo,
  observacoes
}) {
  await criarTransferenciaPendente({

  tonfaId,
  categoria,

  patrimonioId,
  itemId,

  quantidade,

  origemCodigo,
  origemNome,

  destinoCodigo,
  destinoNome,

  motivo,
  observacoes,

  user
})

  setTransferenciaAberta(false)

  setMensagemSucesso(
    destinoCodigo === 'P4'
      ? 'Devolução enviada ao P4 e aguardando aceite.'
      : 'Transferência enviada ao SVDD e aguardando aceite.'
  )
}

function importarPlanilha() {
  window.alert(
    'Importar planilha\n\nA importação patrimonial será conectada em uma próxima etapa.'
  )
}

  function abrirHistoricoCadastros() {
    setHistoricoAberto(true)
  }

  async function abrirVisualizacao(item) {
    setVisualizando(item)

    try {
      setFotos(await listarFotosTonfa(item.id))
    } catch {
      setFotos([])
    }
  }

  async function handleExcluir(item) {
    const descricao =
      item.tipo === 'CASSETETE'
        ? 'o cassetete'
        : 'a tonfa'

    if (!window.confirm(`Excluir ${descricao}?`)) {
      return
    }

    try {
      await excluirTonfa(item.id, user)

      await Promise.all([
        carregar(),
        carregarResumo()
      ])
    } catch (error) {
      window.alert(
        error.message ||
          'Erro ao excluir.'
      )
    }
  }

async function finalizarMovimentacao(resultado) {
  await Promise.all([
    carregar(),
    carregarResumo()
  ])

  setMovimentacaoAtiva(null)

  setMensagemSucesso(
    resultado?.mensagem ||
      'Movimentação concluída. Os saldos e indicadores foram atualizados.'
  )

  return resultado
}

  function renderPainelP4() {
    return (
      <>
        <section className="tonfa-dashboard-section">
          <div className="tonfa-section-title">
            <div>
              <span>Visão estratégica</span>
              <h2>Carga patrimonial</h2>
            </div>

            {loadingResumo && (
              <small>Atualizando indicadores...</small>
            )}
          </div>

          <div className="tonfa-resumo-grid tonfa-resumo-grid-carga">
  <CardResumo
    titulo="Carga total"
    valor={resumo.totalGeral}
    descricao="Tonfas e cassetetes registrados"
    destaque="azul"
    onClick={limparFiltros}
  />

  <CardResumo
    titulo="Tonfas"
    valor={resumo.totalTonfas}
    descricao="Quantidade total de tonfas"
    destaque="verde"
    onClick={() => {
      setFiltros((prev) => ({
        ...prev,
        pesquisa: '',
        tipo: 'TONFA',
        status_operacional: ''
      }))

      setPagina(1)
    }}
  />

  <CardResumo
    titulo="Cassetetes"
    valor={resumo.totalCassetetes}
    descricao="Quantidade total de cassetetes"
    destaque="amarelo"
    onClick={() => {
      setFiltros((prev) => ({
        ...prev,
        pesquisa: '',
        tipo: 'CASSETETE',
        status_operacional: ''
      }))

      setPagina(1)
    }}
  />

  <CardResumo
  titulo="Não localizadas"
  detalhes={[
    {
      titulo: 'Tonfas',
      valor:
        resumo.distribuicaoNaoLocalizada.tonfas
    },
    {
      titulo: 'Cassetetes',
      valor:
        resumo.distribuicaoNaoLocalizada.cassetetes
    }
  ]}
  destaque="vermelho"
  onClick={() =>
    filtrarPorPesquisa('não localizado')
  }
/>
</div>
        </section>

        <section className="tonfa-dashboard-section">
          <div className="tonfa-section-title">
            <div>
              <span>Distribuição atual</span>
              <h2>Onde estão os materiais</h2>
            </div>
          </div>

          <div className="tonfa-resumo-grid">
            <CardResumo
              titulo="Depósito do P4"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.depositoP4.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.depositoP4.cassetetes
                }
              ]}
              onClick={() => filtrarPorPesquisa('P4')}
            />

            <CardResumo
              titulo="Carga do SVDD"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.cofreSVDD.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.cofreSVDD.cassetetes
                }
              ]}
              detalhesSecundarios={[
  {
    titulo: 'Tonfas no cofre',
    valor:
      resumo.cofreSVDD.noCofreTonfas
  },
  {
    titulo: 'Cassetetes no cofre',
    valor:
      resumo.cofreSVDD.noCofreCassetetes
  }
]}
              destaque="verde"
              onClick={() => filtrarPorPesquisa('SVDD')}
            />

            <CardResumo
              titulo="Carga permanente"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.cargaPermanente.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.cargaPermanente.cassetetes
                }
              ]}
              destaque="azul"
              onClick={() => filtrarPorStatus('CARGA')}
            />

            <CardResumo
              titulo="Cautelas ativas"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.cautelas.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.cautelas.cassetetes
                }
              ]}
              destaque="amarelo"
              onClick={() => filtrarPorPesquisa('cautela')}
            />

            <CardResumo
              titulo="Manutenção"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.manutencao.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.manutencao.cassetetes
                }
              ]}
              onClick={() => filtrarPorPesquisa('manutenção')}
            />

            <CardResumo
              titulo="Outra companhia"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.outraCia.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.outraCia.cassetetes
                }
              ]}
              onClick={() => filtrarPorPesquisa('CIA')}
            />

            <CardResumo
              titulo="Força Tática"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.forcaTatica.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.forcaTatica.cassetetes
                }
              ]}
              onClick={() => filtrarPorPesquisa('Força Tática')}
            />

            <CardResumo
              titulo="Batalhão"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.batalhao.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.batalhao.cassetetes
                }
              ]}
              onClick={() => filtrarPorPesquisa('Batalhão')}
            />

            <CardResumo
              titulo="Baixados"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.baixados.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.baixados.cassetetes
                }
              ]}
              destaque="vermelho"
              onClick={() => filtrarPorStatus('BAIXADO')}
            />

            <CardResumo
              titulo="Outros"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.distribuicao.outros.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.distribuicao.outros.cassetetes
                }
              ]}
              onClick={limparFiltros}
            />
          </div>
        </section>

        <PainelGraficosTonfas resumo={resumo} />

        <section className="tonfa-dashboard-section tonfa-movements-section">
          <div className="tonfa-section-title">
            <div>
              <span>Operações permitidas</span>
              <h2>Movimentações patrimoniais</h2>
            </div>
          </div>

          <div className="tonfa-movement-groups">
            <GrupoMovimentacao
              icone="📦"
              titulo="Distribuir patrimônio"
              descricao="Transferências e entregas de materiais."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao('Transferência')
                }
              >
                <strong>Transferir</strong>
                <span>
                  P4, SVDD, FT, BTL ou outra companhia
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Pagamento de carga permanente'
                  )
                }
              >
                <strong>Pagar carga</strong>
                <span>
                  Vincular permanentemente a um policial
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Pagamento de cautela'
                  )
                }
              >
                <strong>Pagar cautela</strong>
                <span>
                  Entrega temporária com previsão de devolução
                </span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="📥"
              titulo="Receber patrimônio"
              descricao="Devoluções e retornos patrimoniais."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Recebimento de devolução'
                  )
                }
              >
                <strong>Receber devolução</strong>
                <span>
                  Encerrar carga ou cautela e receber o material
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Recebimento de manutenção'
                  )
                }
              >
                <strong>Receber manutenção</strong>
                <span>
                  Registrar o retorno do material reparado
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Recebimento de devolução do SVDD'
                  )
                }
              >
                <strong>Receber do SVDD</strong>
                <span>
                  Confirmar devolução enviada pelo SVDD ao P4
                </span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="⚙️"
              titulo="Gestão patrimonial"
              descricao="Manutenção, regularização e baixa."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Envio para manutenção'
                  )
                }
              >
                <strong>Enviar manutenção</strong>
                <span>
                  Registrar a saída do material para reparo
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Regularização patrimonial'
                  )
                }
              >
                <strong>Regularizar</strong>
                <span>
                  Corrigir localização, guardião ou situação
                </span>
              </button>

              <button
                type="button"
                className="tonfa-action-danger"
                onClick={() =>
                  iniciarMovimentacao(
                    'Baixa patrimonial'
                  )
                }
              >
                <strong>Baixar patrimônio</strong>
                <span>
                  Registrar baixa patrimonial definitiva
                </span>
              </button>
            </GrupoMovimentacao>
          </div>
        </section>

        <section className="tonfa-dashboard-section tonfa-cadastro-section">
          <div className="tonfa-section-title">
            <div>
              <span>Área administrativa</span>
              <h2>Cadastro patrimonial</h2>
            </div>
          </div>

          <div className="tonfa-cadastro-grid">
            <button
              type="button"
              onClick={abrirNovoCadastro}
            >
              <span className="tonfa-cadastro-icon">
                ＋
              </span>

              <div>
                <strong>Novo lote</strong>
                <small>
                  Cadastrar uma nova tonfa ou cassetete
                </small>
              </div>
            </button>

            <button
              type="button"
              onClick={importarPlanilha}
            >
              <span className="tonfa-cadastro-icon">
                ⇧
              </span>

              <div>
                <strong>Importar planilha</strong>
                <small>
                  Cadastrar vários materiais em lote
                </small>
              </div>
            </button>

            <button
              type="button"
              onClick={abrirHistoricoCadastros}
            >
              <span className="tonfa-cadastro-icon">
                ◷
              </span>

              <div>
                <strong>Histórico</strong>
                <small>
                  Consultar cadastros e alterações
                </small>
              </div>
            </button>
          </div>
        </section>
      </>
    )
  }

  function renderPainelSVDD() {
    return (
      <>
        <section className="tonfa-dashboard-section">
          <div className="tonfa-section-title">
            <div>
              <span>Visão operacional</span>

              <h2>
                Materiais sob responsabilidade do SVDD
              </h2>
            </div>

            {loadingResumo && (
              <small>Atualizando indicadores...</small>
            )}
          </div>

          <div className="tonfa-resumo-grid tonfa-resumo-grid-principal">
            <CardResumo
  titulo="No cofre"
  valor={
    resumo.cofreSVDD.noCofreTonfas +
    resumo.cofreSVDD.noCofreCassetetes
  }
  descricao="Disponíveis no SVDD"
  destaque="verde"
  onClick={() =>
    filtrarPorPesquisa('SVDD')
  }
/>

            <CardResumo
              titulo="Cautelas ativas"
              valor={resumo.cautelas}
              descricao="Materiais temporariamente entregues"
              destaque="azul"
              onClick={() =>
                filtrarPorPesquisa('cautela')
              }
            />

            <CardResumo
              titulo="Cautelas vencidas"
              valor={resumo.cautelasVencidas}
              descricao="Com devolução em atraso"
              destaque="vermelho"
              onClick={() =>
                filtrarPorPesquisa('cautela')
              }
            />

            <CardResumo
              titulo="Manutenção"
              valor={resumo.manutencao}
              descricao="Materiais enviados para reparo"
              destaque="amarelo"
              onClick={() =>
                filtrarPorPesquisa('manutenção')
              }
            />
          </div>
        </section>

        <section className="tonfa-dashboard-section tonfa-movements-section">
          <div className="tonfa-section-title">
            <div>
              <span>Operações permitidas</span>
              <h2>Movimentações do SVDD</h2>
            </div>
          </div>

          <div className="tonfa-movement-groups">
            <GrupoMovimentacao
              icone="📦"
              titulo="Pagar patrimônio"
              descricao="Entregas temporárias realizadas pelo SVDD."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Pagamento de cautela'
                  )
                }
              >
                <strong>Pagar cautela</strong>
                <span>
                  Entregar temporariamente a um policial
                </span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
  icone="📥"
  titulo="Receber patrimônio"
  descricao="Devoluções e retornos ao cofre."
>
  <button
    type="button"
    onClick={() =>
      iniciarMovimentacao('Recebimento do P4')
    }
  >
    <strong>Receber do P4</strong>

    <span>
      Confirmar material enviado pelo P4
    </span>
  </button>

  <button
    type="button"
    onClick={() =>
      iniciarMovimentacao('Recebimento de cautela')
    }
  >
    <strong>Receber devolução</strong>

    <span>
      Encerrar cautela e retornar ao cofre
    </span>
  </button>

  <button
    type="button"
    onClick={() =>
      iniciarMovimentacao('Retorno da manutenção')
    }
  >
    <strong>Receber manutenção</strong>

    <span>
      Registrar retorno para o cofre
    </span>
  </button>
</GrupoMovimentacao>

            <GrupoMovimentacao
              icone="⚙️"
              titulo="Gestão operacional"
              descricao="Manutenção e devolução ao gestor."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Envio para manutenção'
                  )
                }
              >
                <strong>Enviar manutenção</strong>
                <span>
                  Registrar saída operacional para reparo
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Devolução ao P4'
                  )
                }
              >
                <strong>Devolver ao P4</strong>
                <span>
                  Transferir saldo disponível ao gestor patrimonial
                </span>
              </button>
            </GrupoMovimentacao>
          </div>
        </section>
      </>
    )
  }

  function renderPainelPolicial() {
    return (
      <section className="tonfa-dashboard-section">
        <div className="tonfa-section-title">
          <div>
            <span>Minha responsabilidade</span>
            <h2>Meus materiais</h2>
          </div>

          {loadingResumo && (
            <small>Atualizando indicadores...</small>
          )}
        </div>

        <div className="tonfa-resumo-grid tonfa-resumo-grid-principal">
          <CardResumo
            titulo="Total comigo"
            valor={resumoPolicial.total}
            descricao="Tonfas e cassetetes vinculados"
            destaque="azul"
          />

          <CardResumo
            titulo="Carga permanente"
            valor={resumoPolicial.cargas}
            descricao="Sem previsão de devolução"
            destaque="verde"
          />

          <CardResumo
            titulo="Cautelas ativas"
            valor={resumoPolicial.cautelas}
            descricao="Materiais temporários"
            destaque="amarelo"
          />

          <CardResumo
            titulo="Cautelas vencidas"
            valor={resumoPolicial.vencidas}
            descricao="Pendentes de devolução"
            destaque="vermelho"
          />
        </div>
      </section>
    )
  }

  if (movimentacaoAtiva === 'PAGAR') {
    return (
      <PagarMaterial
        user={user}
        onVoltar={() => setMovimentacaoAtiva(null)}
        onConcluido={finalizarMovimentacao}
      />
    )
  }

  if (movimentacaoAtiva === 'RECEBER') {
    return (
      <ReceberMaterial
        user={user}
        onVoltar={() => setMovimentacaoAtiva(null)}
        onConcluido={finalizarMovimentacao}
      />
    )
  }

  if (
  movimentacaoAtiva === 'RECEBER_P4' ||
  movimentacaoAtiva === 'RECEBER_DEVOLUCAO_P4'
) {
  return (
    <TonfaReceberP4
      user={user}
      modo={movimentacaoAtiva}
      onVoltar={() => setMovimentacaoAtiva(null)}
      onConcluido={finalizarMovimentacao}
    />
  )
}

  return (
    <main className="tonfa-page">
      <header className="tonfa-header">
        <div>
          <span>Gestão Patrimonial</span>
          <h1>Tonfas e Cassetetes</h1>

          <p>
            {visaoPerfil === 'P4' &&
              'Painel estratégico de gestão e distribuição patrimonial.'}

            {visaoPerfil === 'SVDD' &&
              'Painel operacional de cautelas e materiais sob guarda do SVDD.'}

            {visaoPerfil === 'POLICIAL' &&
              'Consulta de cargas permanentes e cautelas vinculadas ao seu cadastro.'}
          </p>

          {perfilUsuario && (
            <small className="tonfa-perfil-identificacao">
              Perfil identificado: {perfilUsuario}
            </small>
          )}
        </div>
      </header>

      {erro && (
        <div className="tonfa-alert-error">
          {erro}
        </div>
      )}

      {mensagemSucesso && (
        <div
          className="tonfa-alert-success tonfa-page-success"
          role="status"
        >
          <div className="tonfa-alert-success-icon">
            ✓
          </div>

          <div>
            <strong>{mensagemSucesso}</strong>
            <span>
              A solicitação foi registrada no fluxo patrimonial do SIGMO.
            </span>
          </div>
        </div>
      )}

      {visaoPerfil === 'P4' && renderPainelP4()}
      {visaoPerfil === 'SVDD' && renderPainelSVDD()}
      {visaoPerfil === 'POLICIAL' &&
        renderPainelPolicial()}

      {visaoPerfil !== 'POLICIAL' && (
        <>
          {formAberto && (
            <TonfaForm
              user={user}
              tonfaEditando={editando}
              onCancel={() => {
                setFormAberto(false)
                setEditando(null)
              }}
              onSaved={async () => {
                setFormAberto(false)
                setEditando(null)

                await Promise.all([
                  carregar(),
                  carregarResumo()
                ])
              }}
            />
          )}

          <section className="tonfa-list-card">
            <div className="tonfa-list-header">
              <div>
                <span className="tonfa-list-eyebrow">
                  Consulta patrimonial
                </span>

                <h2>Registros patrimoniais</h2>
                <p>{total} encontrado(s)</p>
              </div>

              {(filtros.pesquisa ||
                filtros.tipo ||
                filtros.status_operacional ||
                filtros.unidade) && (
                <button
                  type="button"
                  className="tonfa-btn-secondary"
                  onClick={limparFiltros}
                >
                  Remover filtros
                </button>
              )}
            </div>

            <div className="tonfa-toolbar tonfa-toolbar-interna">
              <label>
                <span>Pesquisar</span>

                <input
                  name="pesquisa"
                  value={filtros.pesquisa}
                  onChange={handleFiltroChange}
                  placeholder="Tipo, unidade, local ou QR Code"
                />
              </label>

              <label>
                <span>Tipo</span>

                <select
                  name="tipo"
                  value={filtros.tipo}
                  onChange={handleFiltroChange}
                >
                  <option value="">Todos</option>

                  {TIPOS_TONFA.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Status</span>

                <select
                  name="status_operacional"
                  value={
                    filtros.status_operacional
                  }
                  onChange={handleFiltroChange}
                >
                  <option value="">Todos</option>

                  {STATUS_TONFA.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Unidade</span>

                <select
                  name="unidade"
                  value={filtros.unidade}
                  onChange={handleFiltroChange}
                >
                  <option value="">Todas</option>

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
              </label>

              <button
                type="button"
                className="tonfa-btn-secondary"
                onClick={limparFiltros}
              >
                Limpar
              </button>
            </div>

            <TonfaTable
              tonfas={tonfas}
              loading={loading}
              onView={abrirVisualizacao}
              onEdit={
                visaoPerfil === 'P4'
                  ? (item) => {
                      setEditando(item)
                      setFormAberto(true)
                    }
                  : undefined
              }
              onDelete={
                visaoPerfil === 'P4'
                  ? handleExcluir
                  : undefined
              }
            />

            <footer className="tonfa-pagination">
              <button
                type="button"
                disabled={pagina <= 1 || loading}
                onClick={() =>
                  setPagina((p) =>
                    Math.max(1, p - 1)
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
                  setPagina((p) =>
                    Math.min(
                      totalPaginas,
                      p + 1
                    )
                  )
                }
              >
                Próxima
              </button>
            </footer>
          </section>
        </>
      )}

      {visaoPerfil === 'POLICIAL' && (
        <section className="tonfa-list-card">
          <div className="tonfa-list-header">
            <div>
              <h2>
                Materiais vinculados ao meu cadastro
              </h2>

              <p>
                {tonfasDoPolicial.length}{' '}
                encontrado(s)
              </p>
            </div>
          </div>

          <TonfaTable
            tonfas={tonfasDoPolicial}
            loading={loadingResumo}
            onView={abrirVisualizacao}
          />
        </section>
      )}

      <TonfaTransferenciaModal
    aberto={transferenciaAberta}

    modo={transferenciaModo}

    estoques={tonfasResumo}

    onClose={() =>
      setTransferenciaAberta(false)
    }

    onConfirm={
      confirmarTransferencia
    }
/>

      <HistoricoPatrimonial
        aberto={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
        codigos={['TONFA-PADRAO', 'CASSETETE-PADRAO']}
        titulo="Histórico de Tonfas e Cassetetes"
      />

      {visualizando && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() =>
            setVisualizando(null)
          }
        >
          <section
            className="tonfa-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-modal-header">
              <div>
                <span>Detalhes patrimoniais</span>

                <h2>
                  {visualizando.tipo ===
                  'CASSETETE'
                    ? 'Cassetete'
                    : 'Tonfa'}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setVisualizando(null)
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-detail-grid">
              <div>
                <span>Tipo</span>
                <strong>
                  {visualizando.tipo || '—'}
                </strong>
              </div>

              <div>
                <span>Unidade</span>
                <strong>
                  {visualizando.unidade || '—'}
                </strong>
              </div>

              <div>
                <span>Status operacional</span>
                <strong>
                  {visualizando.status_operacional ||
                    '—'}
                </strong>
              </div>

              <div>
                <span>Local atual</span>
                <strong>
                  {resumirLocalAtual(visualizando.local_atual)}
                </strong>
              </div>

              <div>
                <span>Gestor patrimonial</span>
                <strong>
                  {visualizando.gestor_nome ||
                    visualizando.gestor_atual ||
                    'P4'}
                </strong>
              </div>

              <div>
                <span>Guardião atual</span>
                <strong>
                  {visualizando.guardiao_nome ||
                    visualizando.responsavel_nome ||
                    visualizando.carga_policial_nome ||
                    '—'}
                </strong>
              </div>

              <div className="tonfa-field-full">
                <span>QR Code</span>
                <strong>
                  {visualizando.qr_code || '—'}
                </strong>
              </div>
            </div>

            <div className="tonfa-modal-body">
              <div className="tonfa-modal-qr">
                <QRCodeCanvas
                  value={
                    visualizando.qr_code ||
                    `SIGMO-TONFA-${visualizando.id}`
                  }
                  size={170}
                />
              </div>

              <div className="tonfa-modal-fotos">
                {fotos.length ? (
                  fotos.map((foto) => (
                    <img
                      key={foto.id}
                      src={foto.url}
                      alt="Tonfa ou cassetete"
                    />
                  ))
                ) : (
                  <p>
                    Nenhuma foto cadastrada.
                  </p>
                )}
              </div>
            </div>

            {visualizando.observacoes && (
              <div className="tonfa-observacoes">
                <span>Observações</span>

                <p>
                  {visualizando.observacoes}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}