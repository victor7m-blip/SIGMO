import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import { TIPOS_TONFA, STATUS_TONFA } from '../../constants/tonfas'
import { UNIDADES_27_BPMM } from '../../constants/unidades'
import {
  constatarNovidadeTonfa,
  excluirTonfa,
  listarTonfas,
  obterResumoBaixasTonfas
} from '../../services/tonfasService'
import {
  criarTransferenciaPendente,
  listarTransferenciasPendentes
} from '../../services/patrimonioTransferenciaService'
import {
  baixarExtravioTonfaP4,
  baixarManutencaoTonfaP4,
  regularizarExtravioTonfaP4,
  regularizarManutencaoTonfaP4,
  buscarNovidadePatrimonialDaManutencao,
  listarFotosManutencao,
  listarManutencoes
} from '../../services/manutencoesService'
import { listarFotosTonfa } from '../../services/tonfasFotosService'
import { supabase } from '../../services/supabaseClient'
import { registerAudit } from '../../services/auditoriaService'
import TonfaForm from './components/TonfaForm'
import TonfaTable from './components/TonfaTable'
import TonfaTransferenciaModal from './components/TonfaTransferenciaModal'
import HistoricoPatrimonial from '../../components/Patrimonio/HistoricoPatrimonial'
import PagarMaterial from '../PagarMaterial/PagarMaterial'
import ReceberMaterial from '../ReceberMaterial/ReceberMaterial'
import TonfaCautelasModal from './components/TonfaCautelasModal'
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
      0
  )

  return Number.isFinite(quantidade) && quantidade >= 0
    ? quantidade
    : 0
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

  const fatias = [
  {
    label: 'Tonfas no P4',
    valor: resumo.distribuicao?.depositoP4?.tonfas || 0,
    cor: '#22c55e'
  },
  {
    label: 'Cassetetes no P4',
    valor: resumo.distribuicao?.depositoP4?.cassetetes || 0,
    cor: '#3b82f6'
  },
  {
    label: 'Tonfas no SVDD',
    valor: resumo.cofreSVDD?.tonfas || 0,
    cor: '#7c3aed'
  },
  {
    label: 'Cassetetes no SVDD',
    valor: resumo.cofreSVDD?.cassetetes || 0,
    cor: '#a78bfa'
  },
  {
    label: 'Tonfas — Carga permanente',
    valor: resumo.distribuicao?.cargaPermanente?.tonfas || 0,
    cor: '#f97316'
  },
  {
    label: 'Cassetetes — Carga permanente',
    valor: resumo.distribuicao?.cargaPermanente?.cassetetes || 0,
    cor: '#fdba74'
  },
  {
    label: 'Tonfas — Cautelas ativas',
    valor: resumo.distribuicao?.cautelas?.tonfas || 0,
    cor: '#eab308'
  },
  {
    label: 'Cassetetes — Cautelas ativas',
    valor: resumo.distribuicao?.cautelas?.cassetetes || 0,
    cor: '#fde047'
  },
  {
    label: 'Tonfas — Manutenção',
    valor: resumo.distribuicao?.manutencao?.tonfas || 0,
    cor: '#2563eb'
  },
  {
    label: 'Cassetetes — Manutenção',
    valor: resumo.distribuicao?.manutencao?.cassetetes || 0,
    cor: '#93c5fd'
  },
  {
    label: 'Tonfas — Não localizadas',
    valor: resumo.distribuicaoNaoLocalizada?.tonfas || 0,
    cor: '#dc2626'
  },
  {
    label: 'Cassetetes — Não localizadas',
    valor: resumo.distribuicaoNaoLocalizada?.cassetetes || 0,
    cor: '#fca5a5'
  }
]

  let acumulado = 0

  const partes = fatias.map((item) => {
    const inicio = acumulado
    const fim =
      acumulado + percentual(item.valor, total)

    acumulado = fim

    return `${item.cor} ${inicio}% ${fim}%`
  })

  if (acumulado < 100) {
    partes.push(`#e8edf5 ${acumulado}% 100%`)
  }

  return (
    <div className="tonfa-grafico-card tonfa-grafico-card-rosca">
      <div className="tonfa-grafico-header">
        <div>
          <span>Visão consolidada</span>
          <h3>Distribuição por localização e material</h3>
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
            const valorPercentual = percentual(
              item.valor,
              total
            )

            return (
              <div key={item.label}>
                <i
  className="tonfa-legenda-cor"
  style={{
    background: item.cor,
    border:
      item.label.startsWith('Cassetetes')
        ? '1px solid #2563eb'
        : 'none'
  }}
/>

                <span>{item.label}</span>

                <strong>{item.valor}</strong>

                <small>
                  {formatarPercentual(valorPercentual)}
                </small>
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
    label: 'Cofre do P4',
    tonfas:
      resumo.distribuicao?.depositoP4?.tonfas || 0,
    cassetetes:
      resumo.distribuicao?.depositoP4?.cassetetes || 0
  },
  {
    label: 'Cofre do SVDD',
    tonfas:
      resumo.cofreSVDD?.tonfas || 0,
    cassetetes:
      resumo.cofreSVDD?.cassetetes || 0
  },
  {
    label: 'Carga permanente',
    tonfas:
      resumo.distribuicao?.cargaPermanente?.tonfas || 0,
    cassetetes:
      resumo.distribuicao?.cargaPermanente?.cassetetes || 0
  },
  {
    label: 'Cautelas',
    tonfas:
      resumo.distribuicao?.cautelas?.tonfas || 0,
    cassetetes:
      resumo.distribuicao?.cautelas?.cassetetes || 0
  },
  
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
            { label: 'Cofre do P4', valor: resumo.distribuicao?.depositoP4?.tonfas || 0, classe: 'p4' },
            { label: 'Cofre do SVDD', valor: resumo.cofreSVDD?.tonfas || 0, classe: 'svdd' },
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
            { label: 'Cofre do P4', valor: resumo.distribuicao?.depositoP4?.cassetetes || 0, classe: 'p4' },
            { label: 'Cofre do SVDD', valor: resumo.cofreSVDD?.cassetetes || 0, classe: 'svdd' },
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
  const [manutencoesParaP4, setManutencoesParaP4] = useState([])
  const [modalManutencoesP4Aberto, setModalManutencoesP4Aberto] = useState(false)
  const [carregandoManutencoesP4, setCarregandoManutencoesP4] = useState(false)
  const [encaminhandoManutencaoId, setEncaminhandoManutencaoId] = useState(null)
  const [extraviosSvdd, setExtraviosSvdd] = useState([])
  const [modalExtraviosAberto, setModalExtraviosAberto] = useState(false)
  const [carregandoExtravios, setCarregandoExtravios] = useState(false)
  const [regularizandoExtravioId, setRegularizandoExtravioId] = useState(null)
  const [modalOutrosP4Aberto, setModalOutrosP4Aberto] = useState(false)
  const [outrosP4Itens, setOutrosP4Itens] = useState([])
  const [carregandoOutrosP4, setCarregandoOutrosP4] = useState(false)
  const [modalBaixaP4Aberto, setModalBaixaP4Aberto] = useState(false)
  const [manutencoesBaixaP4, setManutencoesBaixaP4] = useState([])
  const [carregandoBaixaP4, setCarregandoBaixaP4] = useState(false)
  const [baixandoManutencaoId, setBaixandoManutencaoId] = useState(null)
  const [
    modalRegularizacaoP4Aberto,
    setModalRegularizacaoP4Aberto
  ] = useState(false)
  const [
    ocorrenciasRegularizacaoP4,
    setOcorrenciasRegularizacaoP4
  ] = useState([])
  const [
    carregandoRegularizacaoP4,
    setCarregandoRegularizacaoP4
  ] = useState(false)
  const [
    regularizandoP4Id,
    setRegularizandoP4Id
  ] = useState(null)
  const [
    formRegularizacaoP4,
    setFormRegularizacaoP4
  ] = useState({
    itemId: '',
    quantidade: '1',
    policialRe: '',
    policialNome: '',
    documento: '',
    observacoes: ''
  })
  const [
    modalEnvioManutencaoP4Aberto,
    setModalEnvioManutencaoP4Aberto
  ] = useState(false)
  const [
    enviandoManutencaoP4Id,
    setEnviandoManutencaoP4Id
  ] = useState(null)
  const [formManutencaoP4, setFormManutencaoP4] = useState({
    itemId: '',
    quantidade: '1',
    tipoNovidade: 'AVARIA',
    descricao: '',
    observacoes: ''
  })
  const [resumoBaixas, setResumoBaixas] = useState({
    total: 0,
    tonfas: 0,
    cassetetes: 0,
    porReferencia: {}
  })
  const [resumoExtraviosP4Ativos, setResumoExtraviosP4Ativos] = useState({
    tonfas: 0,
    cassetetes: 0
  })
  const [manutencaoP4Resumo, setManutencaoP4Resumo] = useState({
    tonfas: 0,
    cassetetes: 0
  })
  const [
    manutencaoP4PorReferencia,
    setManutencaoP4PorReferencia
  ] = useState({})
  const [
  cautelasModalAberto,
  setCautelasModalAberto
] = useState(false)

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

      const [
        resultado,
        respostaManutencoes,
        respostaBaixas,
        respostaExtraviosP4
      ] = await Promise.all([
        listarTonfas({
          filtros: {
            pesquisa: '',
            tipo: '',
            status_operacional: '',
            unidade: ''
          },
          pagina: 1,
          limite: LIMITE_RESUMO
        }),

        listarManutencoes({
          status: 'EM_MANUTENCAO',
          pagina: 1,
          limite: 5000
        }),

        obterResumoBaixasTonfas(),

        supabase
          .from('sigmo_tonfas_extravios')
          .select('tipo_material, quantidade')
          .eq('ativo', true)
          .eq('responsavel_setor', 'P4')
      ])

      setTonfasResumo(
        (resultado.data || []).map(
          prepararTonfaParaExibicao
        )
      )

      const resumoP4 = {
        tonfas: 0,
        cassetetes: 0
      }

      const resumoP4PorReferencia = {}

      ;(respostaManutencoes?.data || [])
        .filter(
          (item) =>
            normalizarTexto(item?.modulo) ===
            'TONFAS'
        )
        .filter(
          (item) =>
            !manutencaoTonfaPertenceAoSVDD(
              item
            )
        )
        .forEach((item) => {
          const quantidade = Math.max(
            1,
            Number(item?.quantidade || 1) || 1
          )

          const referenciaId =
            String(
              item?.referencia_id ||
              ''
            )

          if (referenciaId) {
            resumoP4PorReferencia[
              referenciaId
            ] =
              Number(
                resumoP4PorReferencia[
                  referenciaId
                ] || 0
              ) +
              quantidade
          }

          if (
            normalizarTexto(
              item?.tipo_material
            ) === 'CASSETETE'
          ) {
            resumoP4.cassetetes +=
              quantidade
          } else {
            resumoP4.tonfas +=
              quantidade
          }
        })

      setManutencaoP4Resumo(
        resumoP4
      )

      setManutencaoP4PorReferencia(
        resumoP4PorReferencia
      )

      setResumoBaixas({
        total:
          Number(
            respostaBaixas?.total ||
            0
          ),
        tonfas:
          Number(
            respostaBaixas?.tonfas ||
            0
          ),
        cassetetes:
          Number(
            respostaBaixas?.cassetetes ||
            0
          ),
        porReferencia:
          respostaBaixas?.porReferencia ||
          {}
      })

      if (respostaExtraviosP4?.error) {
        throw respostaExtraviosP4.error
      }

      const resumoExtraviosAtivos = {
        tonfas: 0,
        cassetetes: 0
      }

      ;(respostaExtraviosP4?.data || []).forEach(
        (item) => {
          const quantidade =
            Math.max(
              0,
              Number(
                item?.quantidade ||
                0
              ) || 0
            )

          if (
            normalizarTexto(
              item?.tipo_material
            ) === 'CASSETETE'
          ) {
            resumoExtraviosAtivos.cassetetes +=
              quantidade
          } else {
            resumoExtraviosAtivos.tonfas +=
              quantidade
          }
        }
      )

      setResumoExtraviosP4Ativos(
        resumoExtraviosAtivos
      )
    } catch (error) {
      console.error(
        'Erro ao carregar resumo patrimonial:',
        error
      )

      setTonfasResumo([])
      setManutencaoP4Resumo({
        tonfas: 0,
        cassetetes: 0
      })
      setManutencaoP4PorReferencia({})
      setResumoBaixas({
        total: 0,
        tonfas: 0,
        cassetetes: 0,
        porReferencia: {}
      })
      setResumoExtraviosP4Ativos({
        tonfas: 0,
        cassetetes: 0
      })
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

  function resumirSaldoPorTipo(itens, campo) {
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

  const totalOriginal =
    somarQuantidades(base)

  const totalTonfasOriginal =
    somarQuantidades(
      base.filter(
        (item) =>
          normalizarTexto(item?.tipo) ===
          'TONFA'
      )
    )

  const totalCassetetesOriginal =
    somarQuantidades(
      base.filter(
        (item) =>
          normalizarTexto(item?.tipo) ===
          'CASSETETE'
      )
    )

  const totalTonfas =
    Math.max(
      0,
      totalTonfasOriginal -
      Number(
        resumoBaixas.tonfas ||
        0
      )
    )

  const totalCassetetes =
    Math.max(
      0,
      totalCassetetesOriginal -
      Number(
        resumoBaixas.cassetetes ||
        0
      )
    )

  const totalGeral =
    totalTonfas +
    totalCassetetes

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

  const manutencaoPorTipo =
  resumirSaldoPorTipo(
    base,
    'quantidade_manutencao'
  )

  const extravioSvddPorTipo =
    resumirSaldoPorTipo(
      base,
      'quantidade_extraviada_svdd'
    )

  const extravioP4PorTipo =
    resumirSaldoPorTipo(
      base,
      'quantidade_extraviada_p4'
    )

  const totalCautelas =
    emServicoPorTipo.tonfas +
    emServicoPorTipo.cassetetes

  const itensNaoLocalizados =
    base.filter(estaNaoLocalizado)

  const itensCarga =
    base.filter(estaEmCarga)

  const itensManutencao =
    base.filter(estaEmManutencao)

  const itensOutraCia =
    base.filter(
      (item) =>
        estaEmOutraCia(item) ||
        estaNaFT(item)
    )

  const itensFT =
    base.filter(estaNaFT)

  const itensBTL =
    base.filter(estaNoBTL)

  const itensBaixados =
    base.filter(estaBaixado)

  const itensOutros =
    base
      .filter(
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
      .map((item) => {
        const quantidadeBaixada =
          Number(
            resumoBaixas?.porReferencia?.[
              String(item?.id || '')
            ] || 0
          )

        const quantidadeAtiva =
          Math.max(
            0,
            obterQuantidade(item) -
            quantidadeBaixada
          )

        return {
          ...item,
          quantidade_total:
            quantidadeAtiva,
          quantidade:
            quantidadeAtiva
        }
      })
      .filter(
        (item) =>
          obterQuantidade(item) > 0
      )

  return {
    totalGeral,
    totalTonfas,
    totalCassetetes,

    naoLocalizadas:
      somarQuantidades(
        itensNaoLocalizados
      ),

    localizadas:
      Math.max(
        0,
        totalGeral -
        somarQuantidades(
          itensNaoLocalizados
        )
      ),

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

    cargas:
      somarQuantidades(
        itensCarga
      ),

    cautelas:
      totalCautelas,

    cautelasVencidas: 0,

    manutencao:
  manutencaoPorTipo.tonfas +
  manutencaoPorTipo.cassetetes,

    outraCia:
      somarQuantidades(
        itensOutraCia
      ),

    ft:
      somarQuantidades(
        itensFT
      ),

    btl:
      somarQuantidades(
        itensBTL
      ),

    baixados:
      Number(
        resumoBaixas.total ||
        0
      ),

    outros:
      somarQuantidades(
        itensOutros
      ),

    distribuicaoNaoLocalizada:
      resumirPorTipo(
        itensNaoLocalizados
      ),

    distribuicao: {
      depositoP4:
        depositoP4PorTipo,

      cargaPermanente: {
        tonfas: 0,
        cassetetes: 0
      },

      cautelas: {
        tonfas:
          emServicoPorTipo.tonfas,

        cassetetes:
          emServicoPorTipo.cassetetes
      },

      manutencao: {
  tonfas:
    manutencaoPorTipo.tonfas,

  cassetetes:
    manutencaoPorTipo.cassetetes
},

      extravioSvdd: {
        tonfas:
          extravioSvddPorTipo.tonfas,

        cassetetes:
          extravioSvddPorTipo.cassetetes
      },

      extravioP4: {
        tonfas:
          extravioP4PorTipo.tonfas,

        cassetetes:
          extravioP4PorTipo.cassetetes
      },

      outraCia:
        resumirPorTipo(
          itensOutraCia
        ),

      forcaTatica:
        resumirPorTipo(
          itensFT
        ),

      batalhao:
        resumirPorTipo(
          itensBTL
        ),

      baixados: {
        tonfas:
          Number(
            resumoBaixas.tonfas ||
            0
          ),

        cassetetes:
          Number(
            resumoBaixas.cassetetes ||
            0
          )
      },

      outros:
        resumirPorTipo(
          itensOutros
        )
    }
  }
}, [
  tonfasResumo,
  resumoBaixas
])


  const resumoSVDD = useMemo(() => {
    const tonfasNoCofre = Number(resumo.cofreSVDD?.noCofreTonfas || 0)
    const cassetetesNoCofre = Number(resumo.cofreSVDD?.noCofreCassetetes || 0)
    const tonfasEmServico = Number(resumo.cofreSVDD?.emServicoTonfas || 0)
    const cassetetesEmServico = Number(resumo.cofreSVDD?.emServicoCassetetes || 0)
    const tonfasManutencao =
      Math.max(
        0,
        Number(
          resumo.distribuicao?.manutencao?.tonfas ||
          0
        ) -
        Number(
          manutencaoP4Resumo.tonfas ||
          0
        )
      )

    const cassetetesManutencao =
      Math.max(
        0,
        Number(
          resumo.distribuicao?.manutencao?.cassetetes ||
          0
        ) -
        Number(
          manutencaoP4Resumo.cassetetes ||
          0
        )
      )
    const tonfasExtraviadas = Number(resumo.distribuicao?.extravioSvdd?.tonfas || 0)
    const cassetetesExtraviados = Number(resumo.distribuicao?.extravioSvdd?.cassetetes || 0)

    const totalTonfas =
      tonfasNoCofre +
      tonfasEmServico +
      tonfasManutencao +
      tonfasExtraviadas

    const totalCassetetes =
      cassetetesNoCofre +
      cassetetesEmServico +
      cassetetesManutencao +
      cassetetesExtraviados

    return {
      totalGeral: totalTonfas + totalCassetetes,
      totalTonfas,
      totalCassetetes,
      noCofre: {
        tonfas: tonfasNoCofre,
        cassetetes: cassetetesNoCofre
      },
      emServico: {
        tonfas: tonfasEmServico,
        cassetetes: cassetetesEmServico
      },
      manutencao: {
        tonfas: tonfasManutencao,
        cassetetes: cassetetesManutencao
      },
      extravio: {
        tonfas: tonfasExtraviadas,
        cassetetes: cassetetesExtraviados
      }
    }
  }, [
    resumo,
    manutencaoP4Resumo
  ])

  const resumoResponsabilidadeSVDDP4 = useMemo(() => {
    const tonfasNoCofre =
      Number(
        resumo.cofreSVDD?.noCofreTonfas ||
        0
      )

    const cassetetesNoCofre =
      Number(
        resumo.cofreSVDD?.noCofreCassetetes ||
        0
      )

    const tonfasEmServico =
      Number(
        resumo.cofreSVDD?.emServicoTonfas ||
        0
      )

    const cassetetesEmServico =
      Number(
        resumo.cofreSVDD?.emServicoCassetetes ||
        0
      )

    /*
     * quantidade_manutencao é global.
     * Para a visão do P4, o que ainda não pertence ao P4
     * continua sob responsabilidade do SVDD.
     */
    const tonfasManutencaoSvdd =
      Math.max(
        0,
        Number(
          resumo.distribuicao?.manutencao?.tonfas ||
          0
        ) -
        Number(
          manutencaoP4Resumo.tonfas ||
          0
        )
      )

    const cassetetesManutencaoSvdd =
      Math.max(
        0,
        Number(
          resumo.distribuicao?.manutencao?.cassetetes ||
          0
        ) -
        Number(
          manutencaoP4Resumo.cassetetes ||
          0
        )
      )

    const tonfasExtraviadasSvdd =
      Number(
        resumo.distribuicao?.extravioSvdd?.tonfas ||
        0
      )

    const cassetetesExtraviadosSvdd =
      Number(
        resumo.distribuicao?.extravioSvdd?.cassetetes ||
        0
      )

    return {
      tonfas:
        tonfasNoCofre +
        tonfasEmServico +
        tonfasManutencaoSvdd +
        tonfasExtraviadasSvdd,

      cassetetes:
        cassetetesNoCofre +
        cassetetesEmServico +
        cassetetesManutencaoSvdd +
        cassetetesExtraviadosSvdd,

      manutencao: {
        tonfas:
          tonfasManutencaoSvdd,

        cassetetes:
          cassetetesManutencaoSvdd
      },

      extravio: {
        tonfas:
          tonfasExtraviadasSvdd,

        cassetetes:
          cassetetesExtraviadosSvdd
      }
    }
  }, [
    resumo,
    manutencaoP4Resumo
  ])


  const resumoP4Visual = useMemo(() => ({
    ...resumo,

    cofreSVDD: {
      ...(resumo.cofreSVDD || {}),

      tonfas:
        resumoResponsabilidadeSVDDP4.tonfas,

      cassetetes:
        resumoResponsabilidadeSVDDP4.cassetetes
    }
  }), [
    resumo,
    resumoResponsabilidadeSVDDP4
  ])


  const tonfasTabela = useMemo(() => {
    if (visaoPerfil !== 'SVDD') return tonfas

    return tonfas
      .filter((item) => {
        const quantidadeSVDD = Number(item?.quantidade_svdd || 0)
        const quantidadeEmServico = Number(item?.quantidade_em_servico || 0)
        const quantidadeManutencaoGlobal =
          Number(
            item?.quantidade_manutencao ||
            0
          )

        const quantidadeManutencaoP4 =
          Number(
            manutencaoP4PorReferencia[
              String(item?.id || '')
            ] || 0
          )

        const quantidadeManutencao =
          Math.max(
            0,
            quantidadeManutencaoGlobal -
            quantidadeManutencaoP4
          )

        const quantidadeExtraviadaSvdd =
          Number(item?.quantidade_extraviada_svdd || 0)

        return (
          quantidadeSVDD > 0 ||
          quantidadeEmServico > 0 ||
          quantidadeManutencao > 0 ||
          quantidadeExtraviadaSvdd > 0
        )
      })
      .map((item) => {
        const quantidadeSVDD = Number(item?.quantidade_svdd || 0)
        const quantidadeEmServico = Number(item?.quantidade_em_servico || 0)
        const quantidadeManutencaoGlobal =
          Number(
            item?.quantidade_manutencao ||
            0
          )

        const quantidadeManutencaoP4 =
          Number(
            manutencaoP4PorReferencia[
              String(item?.id || '')
            ] || 0
          )

        const quantidadeManutencao =
          Math.max(
            0,
            quantidadeManutencaoGlobal -
            quantidadeManutencaoP4
          )

        const quantidadeExtraviadaSvdd =
          Number(item?.quantidade_extraviada_svdd || 0)

        const quantidadeTotalSVDD =
          quantidadeSVDD +
          quantidadeEmServico +
          quantidadeManutencao +
          quantidadeExtraviadaSvdd

        return {
          ...item,
          quantidade_manutencao:
            quantidadeManutencao,
          quantidade_total:
            quantidadeTotalSVDD,
          quantidade:
            quantidadeTotalSVDD,
          local_atual:
            'SVDD'
        }
      })
  }, [
    tonfas,
    visaoPerfil,
    manutencaoP4PorReferencia
  ])

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

  function manutencaoTonfaPertenceAoSVDD(item) {
    const modulo = normalizarTexto(item?.modulo)

    if (modulo !== 'TONFAS') {
      return false
    }

    const destino = normalizarTexto(
      item?.destino ||
      item?.local_destino ||
      ''
    )

    if (
      destino === 'P4' ||
      destino.includes('COFRE DO P4') ||
      destino.includes('GUARDA DO P4') ||
      destino.includes('P4_MANUTENCAO')
    ) {
      return false
    }

    /*
     * Para Tonfa/Cassetete, a origem gravada na própria manutenção
     * representa quem detinha a responsabilidade no momento em que
     * o material entrou em manutenção.
     *
     * origem_institucional é um campo derivado pelo service a partir
     * do histórico patrimonial e pode refletir uma cautela antiga.
     * Por isso, a origem explícita da manutenção precisa ter
     * prioridade.
     */
    const origemGravada = normalizarTexto(
      item?.origem ||
      item?.local_origem ||
      ''
    )

    if (
      origemGravada === 'P4' ||
      origemGravada.includes('COFRE DO P4') ||
      origemGravada.includes('GUARDA DO P4') ||
      origemGravada.includes('DEPOSITO DO P4')
    ) {
      return false
    }

    if (
      origemGravada === 'SVDD' ||
      origemGravada.includes('COFRE DO SVDD') ||
      origemGravada.includes('SERVICO DE DIA') ||
      origemGravada.includes('POLICIAL')
    ) {
      return true
    }

    const origemInstitucional = normalizarTexto(
      item?.origem_institucional ||
      ''
    )

    return (
      origemInstitucional === 'SVDD' ||
      origemInstitucional.includes('COFRE DO SVDD') ||
      origemInstitucional.includes('SERVICO DE DIA') ||
      origemInstitucional.includes('POLICIAL')
    )
  }

  async function abrirOutrosP4() {
    if (carregandoOutrosP4) {
      return
    }

    try {
      setCarregandoOutrosP4(true)
      setErro('')
      setMensagemSucesso('')

      const itensOutrosDestino =
        tonfasResumo
          .filter(
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
          .map(
            (item) => ({
              id:
                `OUTRO-${item.id}`,
              _tipo_outros:
                'DESTINO',
              tipo_material:
                normalizarTexto(item?.tipo) ===
                'CASSETETE'
                  ? 'CASSETETE'
                  : 'TONFA',
              quantidade:
                Math.max(
                  0,
                  obterQuantidade(item) -
                  Number(
                    resumoBaixas?.porReferencia?.[
                      String(item?.id || '')
                    ] || 0
                  )
                ),
              destino:
                item?.local_atual ||
                item?.unidade ||
                'OUTRO DESTINO',
              unidade:
                item?.unidade ||
                null,
              observacoes:
                item?.observacoes ||
                null,
              referencia_id:
                item?.id ||
                null
            })
          )
          .filter(
            (item) =>
              item.quantidade > 0
          )

      const {
        data: extravios,
        error: extraviosError
      } = await supabase
        .from('sigmo_tonfas_extravios')
        .select(
          'id, tonfa_id, tipo_material, quantidade, status, responsavel_setor, policial_re, policial_nome, descricao, documento_tipo, documento_numero, documento_data, observacoes, extravio_constatado_em, avocacao_p4_em, avocacao_p4_por_nome, avocacao_p4_documento, avocacao_p4_observacoes, ativo'
        )
        .eq('ativo', true)
        .eq('responsavel_setor', 'P4')
        .order(
          'avocacao_p4_em',
          { ascending: false }
        )

      if (extraviosError) {
        throw extraviosError
      }

      const itensExtravio =
        (extravios || []).map(
          (item) => ({
            ...item,
            _tipo_outros:
              'EXTRAVIO'
          })
        )

      setOutrosP4Itens([
        ...itensExtravio,
        ...itensOutrosDestino
      ])

      setModalOutrosP4Aberto(true)
    } catch (error) {
      console.error(
        'Erro ao carregar Outros do P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar os materiais classificados em Outros.'
      )
    } finally {
      setCarregandoOutrosP4(false)
    }
  }


  async function abrirExtraviosSvdd() {
    if (carregandoExtravios) return

    try {
      setCarregandoExtravios(true)
      setErro('')
      setMensagemSucesso('')

      const { data, error } = await supabase
        .from('sigmo_tonfas_extravios')
        .select(
          'id, tonfa_id, tipo_material, quantidade, status, responsavel_setor, policial_re, policial_nome, retirado_em, devolucao_prevista, devolucao_solicitada_em, extravio_constatado_em, registrado_por_nome, descricao, documento_tipo, documento_numero, documento_data, observacoes, avocacao_p4_em, avocacao_p4_por_nome, avocacao_p4_documento, avocacao_p4_observacoes, regularizado_em, regularizado_por_nome, regularizacao_tipo, regularizacao_documento, regularizacao_observacoes, ativo, criado_em, atualizado_em'
        )
        .eq('ativo', true)
        .eq('responsavel_setor', 'SVDD')
        .order('extravio_constatado_em', { ascending: false })

      if (error) throw error

      setExtraviosSvdd(data || [])
      setModalExtraviosAberto(true)
    } catch (error) {
      console.error(
        'Erro ao carregar extravios de Tonfa/Cassetete:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar os extravios de Tonfa/Cassetete.'
      )
    } finally {
      setCarregandoExtravios(false)
    }
  }


  async function regularizarExtravioLocalizado(extravio) {
    if (
      !extravio?.id ||
      !extravio?.tonfa_id ||
      regularizandoExtravioId
    ) {
      return
    }

    const quantidade = Math.max(
      1,
      Number(extravio?.quantidade || 1) || 1
    )

    const tipo =
      normalizarTexto(
        extravio?.tipo_material
      ) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const confirmou = window.confirm(
      `Confirmar que ${quantidade} ${tipo.toLowerCase()}(s) extraviado(s) foi(ram) localizado(s) e retornou(aram) fisicamente ao Cofre do SVDD?\n\n` +
      'O extravio será encerrado e a quantidade voltará para o saldo disponível do SVDD.'
    )

    if (!confirmou) return

    try {
      setRegularizandoExtravioId(extravio.id)
      setErro('')
      setMensagemSucesso('')

      const { data: estoque, error: erroEstoque } =
        await supabase
          .from('sigmo_tonfas')
          .select(
            'id, tipo, quantidade_svdd, quantidade_extraviada_svdd, quantidade_extraviada_p4'
          )
          .eq('id', extravio.tonfa_id)
          .single()

      if (erroEstoque) throw erroEstoque

      const extraviadaSvddAtual =
        Number(estoque?.quantidade_extraviada_svdd || 0)
      const saldoSvddAtual =
        Number(estoque?.quantidade_svdd || 0)

      if (extraviadaSvddAtual < quantidade) {
        throw new Error(
          `Saldo inconsistente: existem apenas ${extraviadaSvddAtual} unidade(s) extraviada(s) no SVDD.`
        )
      }

      const novoSaldoSvdd =
        saldoSvddAtual + quantidade
      const novoExtravioSvdd =
        extraviadaSvddAtual - quantidade

      const { error: erroAtualizarEstoque } =
        await supabase
          .from('sigmo_tonfas')
          .update({
            quantidade_svdd: novoSaldoSvdd,
            quantidade_extraviada_svdd: novoExtravioSvdd,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', estoque.id)

      if (erroAtualizarEstoque) {
        throw erroAtualizarEstoque
      }

      const nomeUsuario =
        user?.nome_guerra ||
        user?.nome ||
        user?.nome_completo ||
        user?.email ||
        'Usuário'

      const agora = new Date().toISOString()

      const { error: erroAtualizarExtravio } =
        await supabase
          .from('sigmo_tonfas_extravios')
          .update({
            status: 'ENCERRADO',
            regularizado_em: agora,
            regularizado_por_id: user?.id || null,
            regularizado_por_nome: nomeUsuario,
            regularizacao_tipo: 'LOCALIZACAO',
            regularizacao_observacoes:
              'MATERIAL LOCALIZADO E RETORNADO FISICAMENTE AO COFRE DO SVDD.',
            ativo: false,
            atualizado_em: agora
          })
          .eq('id', extravio.id)

      if (erroAtualizarExtravio) {
        const { error: erroRollback } =
          await supabase
            .from('sigmo_tonfas')
            .update({
              quantidade_svdd: saldoSvddAtual,
              quantidade_extraviada_svdd:
                extraviadaSvddAtual,
              atualizado_em:
                new Date().toISOString()
            })
            .eq('id', estoque.id)

        if (erroRollback) {
          console.error(
            'Erro ao desfazer a regularização do extravio:',
            erroRollback
          )
        }

        throw erroAtualizarExtravio
      }

      try {
        await registerAudit({
          user,
          action: 'EXTRAVIO_REGULARIZADO',
          tableName: 'sigmo_tonfas_extravios',
          recordId: extravio.id,
          description:
            `${nomeUsuario} regularizou extravio de ${tipo.toUpperCase()}, ` +
            `quantidade ${quantidade}, por LOCALIZAÇÃO. ` +
            `O material retornou fisicamente ao COFRE DO SVDD. ` +
            `Policial relacionado: ${extravio?.policial_nome || 'não informado'}` +
            `${extravio?.policial_re ? `, RE ${extravio.policial_re}` : ''}.`
        })
      } catch (auditError) {
        console.error(
          'Extravio regularizado, mas não foi possível registrar auditoria:',
          auditError
        )
      }

      setExtraviosSvdd((lista) =>
        lista.filter(
          (item) =>
            String(item?.id) !==
            String(extravio.id)
        )
      )

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `${tipo} localizado(a) e retornado(a) ao Cofre do SVDD. O extravio foi encerrado.`
      )

      setModalExtraviosAberto(false)
    } catch (error) {
      console.error(
        'Erro ao regularizar extravio localizado:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível regularizar o extravio.'
      )
    } finally {
      setRegularizandoExtravioId(null)
    }
  }


  async function abrirOcorrenciasParaP4() {
    if (carregandoManutencoesP4) {
      return
    }

    try {
      setCarregandoManutencoesP4(true)
      setMensagemSucesso('')
      setErro('')

      const [
        resposta,
        transferenciasPendentesP4,
        respostaExtravios
      ] = await Promise.all([
        listarManutencoes({
          status: 'EM_MANUTENCAO',
          pagina: 1,
          limite: 5000
        }),
        listarTransferenciasPendentes({
          destinoCodigo: 'P4',
          limite: 500
        }),
        supabase
          .from('sigmo_tonfas_extravios')
          .select(
            'id, tonfa_id, tipo_material, quantidade, status, responsavel_setor, policial_re, policial_nome, descricao, documento_tipo, documento_numero, documento_data, observacoes, extravio_constatado_em, ativo'
          )
          .eq('ativo', true)
          .eq('responsavel_setor', 'SVDD')
          .order(
            'extravio_constatado_em',
            { ascending: false }
          )
      ])

      if (respostaExtravios?.error) {
        throw respostaExtravios.error
      }

      const manutencoesJaEnviadas = new Set(
        (transferenciasPendentesP4 || [])
          .filter(
            (transferencia) =>
              normalizarTexto(
                transferencia?.metadata?.tipo_fluxo
              ) === 'MANUTENCAO_SVDD_P4'
          )
          .map(
            (transferencia) =>
              String(
                transferencia?.metadata?.manutencao_id ||
                ''
              )
          )
          .filter(Boolean)
      )

      const extraviosJaEnviados = new Set(
        (transferenciasPendentesP4 || [])
          .filter(
            (transferencia) =>
              normalizarTexto(
                transferencia?.metadata?.tipo_fluxo
              ) === 'EXTRAVIO_SVDD_P4'
          )
          .map(
            (transferencia) =>
              String(
                transferencia?.metadata?.extravio_id ||
                ''
              )
          )
          .filter(Boolean)
      )

      const registrosBase = (resposta?.data || [])
        .filter(manutencaoTonfaPertenceAoSVDD)
        .filter(
          (item) =>
            !manutencoesJaEnviadas.has(
              String(item?.id || '')
            )
        )
        .sort((a, b) => {
          const dataA = new Date(
            a?.registrada_em ||
            a?.created_at ||
            0
          ).getTime()

          const dataB = new Date(
            b?.registrada_em ||
            b?.created_at ||
            0
          ).getTime()

          return dataB - dataA
        })

      const manutencoes = await Promise.all(
        registrosBase.map(async (item) => {
          let fotoSelecionada = null

          try {
            const fotosManutencao =
              await listarFotosManutencao(item.id)

            fotoSelecionada =
              (fotosManutencao || []).find(
                (foto) =>
                  foto?.principal === true ||
                  foto?.is_principal === true
              ) ||
              (fotosManutencao || [])[0] ||
              null
          } catch (error) {
            console.warn(
              'Não foi possível carregar foto da manutenção:',
              error
            )
          }

          if (!fotoSelecionada) {
            try {
              const resultadoNovidade =
                await buscarNovidadePatrimonialDaManutencao(item)

              const fotosNovidade =
                resultadoNovidade?.fotos || []

              fotoSelecionada =
                fotosNovidade.find(
                  (foto) =>
                    foto?.principal === true ||
                    foto?.is_principal === true
                ) ||
                fotosNovidade[0] ||
                null
            } catch (error) {
              console.warn(
                'Não foi possível carregar foto da novidade vinculada:',
                error
              )
            }
          }

          if (!fotoSelecionada && item?.referencia_id) {
            try {
              const fotosItem =
                await listarFotosTonfa(item.referencia_id)

              fotoSelecionada =
                (fotosItem || []).find(
                  (foto) =>
                    foto?.principal === true ||
                    foto?.is_principal === true
                ) ||
                (fotosItem || [])[0] ||
                null
            } catch (error) {
              console.warn(
                'Não foi possível carregar foto cadastral da Tonfa/Cassetete:',
                error
              )
            }
          }

          return {
            ...item,
            _tipo_encaminhamento:
              'MANUTENCAO',
            foto_manutencao_url:
              fotoSelecionada?.foto_url ||
              fotoSelecionada?.url ||
              null
          }
        })
      )

      const extravios =
        (respostaExtravios?.data || [])
          .filter(
            (item) =>
              !extraviosJaEnviados.has(
                String(item?.id || '')
              )
          )
          .map(
            (item) => ({
              ...item,
              _tipo_encaminhamento:
                'EXTRAVIO',
              referencia_id:
                item?.tonfa_id ||
                null,
              tipo_novidade:
                'EXTRAVIO',
              origem:
                'SVDD',
              destino:
                'P4'
            })
          )

      const registros = [
        ...manutencoes,
        ...extravios
      ]

      if (registros.length === 0) {
        setMensagemSucesso(
          'Não há manutenção ou extravio sob responsabilidade do SVDD disponível para encaminhamento ao P4.'
        )
        return
      }

      setManutencoesParaP4(registros)
      setModalManutencoesP4Aberto(true)
    } catch (error) {
      console.error(
        'Erro ao carregar manutenções de Tonfa/Cassetete:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar as manutenções de Tonfa/Cassetete.'
      )
    } finally {
      setCarregandoManutencoesP4(false)
    }
  }

  async function encaminharRegistroExtravioAoP4(extravio) {
    if (
      !extravio?.id ||
      !extravio?.tonfa_id ||
      encaminhandoManutencaoId
    ) {
      return
    }

    const tipo =
      normalizarTexto(
        extravio?.tipo_material
      ) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const quantidade =
      Math.max(
        1,
        Number(
          extravio?.quantidade ||
          1
        ) || 1
      )

    const documento =
      window.prompt(
        'Informe o documento / referência do procedimento de extravio:'
      )

    if (documento === null) {
      return
    }

    const documentoNormalizado =
      String(
        documento || ''
      )
        .trim()
        .toUpperCase()

    if (!documentoNormalizado) {
      setErro(
        'Informe o documento / referência do procedimento.'
      )
      return
    }

    const observacoes =
      window.prompt(
        'Informe a descrição / observações do encaminhamento ao P4:'
      )

    if (observacoes === null) {
      return
    }

    const observacoesNormalizadas =
      String(
        observacoes || ''
      )
        .trim()
        .toUpperCase()

    const confirmou =
      window.confirm(
        `Encaminhar o procedimento de extravio de ${quantidade} ${tipo.toLowerCase()}(s) ao P4?\n\n` +
        `Documento: ${documentoNormalizado}\n\n` +
        'A responsabilidade permanecerá no SVDD até o P4 aceitar.'
      )

    if (!confirmou) {
      return
    }

    try {
      setEncaminhandoManutencaoId(
        extravio.id
      )
      setErro('')

      const estoqueRelacionado =
        tonfasResumo.find(
          (item) =>
            String(item?.id || '') ===
            String(
              extravio?.tonfa_id ||
              ''
            )
        ) || null

      const transferencia =
        await criarTransferenciaPendente({
          tonfaId:
            extravio.tonfa_id,
          categoria:
            normalizarTexto(
              extravio?.tipo_material
            ) === 'CASSETETE'
              ? 'CASSETETE'
              : 'TONFA',
          patrimonioId:
            estoqueRelacionado?.patrimonio_id ||
            null,
          itemId:
            estoqueRelacionado?.item_id ||
            null,
          quantidade,
          origemCodigo:
            'SVDD',
          origemNome:
            'EXTRAVIO / SVDD',
          destinoCodigo:
            'P4',
          destinoNome:
            'EXTRAVIO / P4',
          motivo:
            'ENCAMINHAMENTO_P4_EXTRAVIO',
          observacoes:
            observacoesNormalizadas ||
            'ENCAMINHAMENTO DE PROCEDIMENTO DE EXTRAVIO AO P4.',
          metadata: {
            tipo_fluxo:
              'EXTRAVIO_SVDD_P4',
            extravio_id:
              extravio.id,
            referencia_id:
              extravio.tonfa_id,
            documento_avocacao:
              documentoNormalizado,
            observacoes_avocacao:
              observacoesNormalizadas ||
              null,
            preservar_quantidade_extravio:
              true
          },
          user
        })

      setManutencoesParaP4(
        (lista) =>
          lista.filter(
            (item) =>
              String(
                item?.id
              ) !==
              String(
                extravio.id
              )
          )
      )

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `${tipo} extraviado(a) encaminhado(a) ao P4 e aguardando aceite.`
      )

      setModalManutencoesP4Aberto(false)

      return transferencia
    } catch (error) {
      console.error(
        'Erro ao encaminhar extravio ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível encaminhar o extravio ao P4.'
      )
    } finally {
      setEncaminhandoManutencaoId(
        null
      )
    }
  }


  async function encaminharRegistroManutencaoAoP4(manutencao) {
    if (
      manutencao?._tipo_encaminhamento ===
      'EXTRAVIO'
    ) {
      return encaminharRegistroExtravioAoP4(
        manutencao
      )
    }

    if (!manutencao?.id || encaminhandoManutencaoId) {
      return
    }

    const tipo =
      normalizarTexto(manutencao?.tipo_material) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const quantidade = Math.max(
      1,
      Number(manutencao?.quantidade || 1)
    )

    const confirmou = window.confirm(
      `Encaminhar ${quantidade} ${tipo.toLowerCase()}(s) desta manutenção ao P4?\n\n` +
      'Será criada uma pendência de recebimento. A custódia continuará no SVDD até o P4 aceitar.'
    )

    if (!confirmou) {
      return
    }

    try {
      setEncaminhandoManutencaoId(manutencao.id)
      setErro('')

      const estoqueRelacionado =
        tonfasResumo.find(
          (item) =>
            String(item?.id || '') ===
            String(manutencao?.referencia_id || '')
        ) || null

      const transferencia =
        await criarTransferenciaPendente({
          tonfaId:
            manutencao?.referencia_id ||
            estoqueRelacionado?.id,
          categoria:
            normalizarTexto(manutencao?.tipo_material) ===
            'CASSETETE'
              ? 'CASSETETE'
              : 'TONFA',
          patrimonioId:
            manutencao?.patrimonio_id ||
            estoqueRelacionado?.patrimonio_id ||
            null,
          itemId:
            estoqueRelacionado?.item_id ||
            null,
          quantidade,
          origemCodigo: 'SVDD',
          origemNome: 'MANUTENÇÃO / SVDD',
          destinoCodigo: 'P4',
          destinoNome: 'MANUTENÇÃO / P4',
          motivo: 'ENCAMINHAMENTO_P4_MANUTENCAO',
          observacoes:
            'ENCAMINHAMENTO AO P4 PELO MÓDULO DE TONFAS/CASSETETES.',
          metadata: {
            tipo_fluxo: 'MANUTENCAO_SVDD_P4',
            manutencao_id: manutencao.id,
            referencia_id:
              manutencao?.referencia_id ||
              estoqueRelacionado?.id ||
              null,
            preservar_quantidade_manutencao: true
          },
          user
        })

      setManutencoesParaP4((lista) =>
        lista.filter(
          (item) =>
            String(item?.id) !==
            String(manutencao.id)
        )
      )

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `${tipo} em manutenção enviado(a) ao P4 e aguardando recebimento.`
      )

      setModalManutencoesP4Aberto(false)

      return transferencia
    } catch (error) {
      console.error(
        'Erro ao encaminhar manutenção ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível encaminhar a manutenção ao P4.'
      )
    } finally {
      setEncaminhandoManutencaoId(null)
    }
  }


  async function abrirBaixaPatrimonialP4() {
    if (
      visaoPerfil !== 'P4' ||
      carregandoBaixaP4
    ) {
      return
    }

    try {
      setCarregandoBaixaP4(true)
      setErro('')
      setMensagemSucesso('')

      const [
        respostaManutencoes,
        respostaExtravios
      ] = await Promise.all([
        listarManutencoes({
          modulo: 'TONFAS',
          status: 'EM_MANUTENCAO',
          pagina: 1,
          limite: 5000
        }),

        supabase
          .from('sigmo_tonfas_extravios')
          .select(
            'id, tonfa_id, tipo_material, quantidade, status, responsavel_setor, policial_re, policial_nome, descricao, documento_numero, observacoes, avocacao_p4_documento, avocacao_p4_observacoes, ativo'
          )
          .eq('ativo', true)
          .eq(
            'responsavel_setor',
            'P4'
          )
      ])

      if (
        respostaExtravios?.error
      ) {
        throw respostaExtravios.error
      }

      const manutencoes =
        (respostaManutencoes?.data || [])
          .filter(
            (item) =>
              normalizarTexto(
                item?.modulo
              ) === 'TONFAS'
          )
          .filter(
            (item) =>
              !manutencaoTonfaPertenceAoSVDD(
                item
              )
          )
          .map(
            (item) => ({
              ...item,
              _tipo_baixa:
                'MANUTENCAO'
            })
          )

      const extravios =
        (respostaExtravios?.data || [])
          .map(
            (item) => ({
              ...item,
              _tipo_baixa:
                'EXTRAVIO',
              referencia_id:
                item?.tonfa_id ||
                null
            })
          )

      const registros = [
        ...manutencoes,
        ...extravios
      ]

      if (
        registros.length === 0
      ) {
        setMensagemSucesso(
          'Não há Tonfas ou Cassetetes em manutenção ou extravio sob responsabilidade do P4 disponíveis para baixa.'
        )
        return
      }

      setManutencoesBaixaP4(
        registros
      )
      setModalBaixaP4Aberto(
        true
      )
    } catch (error) {
      console.error(
        'Erro ao carregar materiais disponíveis para baixa:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar os materiais disponíveis para baixa.'
      )
    } finally {
      setCarregandoBaixaP4(
        false
      )
    }
  }

  async function baixarManutencaoP4(
    manutencao
  ) {
    if (
      !manutencao?.id ||
      baixandoManutencaoId
    ) {
      return
    }

    const tipo =
      normalizarTexto(
        manutencao?.tipo_material
      ) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const quantidade =
      Math.max(
        1,
        Number(
          manutencao?.quantidade ||
          1
        ) || 1
      )

    const respostaQuantidade = window.prompt(
      `Quantas unidades deseja baixar? (1 a ${quantidade})`,
      String(quantidade)
    )
    if (respostaQuantidade === null) return
    const quantidadeEscolhida = Number(respostaQuantidade)
    if (!Number.isInteger(quantidadeEscolhida) || quantidadeEscolhida < 1 || quantidadeEscolhida > quantidade) {
      setErro(`Informe uma quantidade entre 1 e ${quantidade}.`)
      return
    }

    const motivo =
      window.prompt(
        `Informe o motivo da baixa definitiva de ${quantidade} ${tipo.toLowerCase()}(s):`
      )

    if (
      motivo === null
    ) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (
      !motivoNormalizado
    ) {
      setErro(
        'Informe o motivo da baixa patrimonial.'
      )
      return
    }

    const documento =
      window.prompt(
        'Informe o documento / referência da baixa (opcional):'
      )

    if (
      documento === null
    ) {
      return
    }

    const observacoes =
      window.prompt(
        'Informe observações adicionais da baixa (opcional):'
      )

    if (
      observacoes === null
    ) {
      return
    }

    const confirmou =
      window.confirm(
        `CONFIRMAR BAIXA DEFINITIVA?\n\n` +
        `${tipo}: ${quantidadeEscolhida} unidade(s)\n` +
        `Motivo: ${motivoNormalizado}\n\n` +
        'Esta operação retirará definitivamente essa quantidade do saldo em manutenção. O material não retornará ao P4 nem ao SVDD.'
      )

    if (
      !confirmou
    ) {
      return
    }

    try {
      setBaixandoManutencaoId(
        manutencao.id
      )
      setErro('')
      setMensagemSucesso('')

      await baixarManutencaoTonfaP4({
        manutencaoId:
          manutencao.id,
        quantidadeSolicitada: quantidadeEscolhida,
        motivo:
          motivoNormalizado,
        documento:
          String(
            documento || ''
          )
            .trim()
            .toUpperCase() ||
          null,
        observacoes:
          String(
            observacoes || ''
          )
            .trim()
            .toUpperCase() ||
          null,
        user
      })

      const restantes = manutencoesBaixaP4.flatMap(registro => {
        if (String(registro?.id) !== String(manutencao.id)) return [registro]
        const restante = quantidade - quantidadeEscolhida
        return restante > 0 ? [{ ...registro, quantidade: restante }] : []
      })

      setManutencoesBaixaP4(
        restantes
      )

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `Baixa definitiva registrada: ${quantidade} ${tipo.toLowerCase()}(s) retirado(s) da manutenção.`
      )

      if (
        restantes.length === 0
      ) {
        setModalBaixaP4Aberto(
          false
        )
      }
    } catch (error) {
      console.error(
        'Erro ao realizar baixa patrimonial de Tonfa/Cassetete:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível realizar a baixa patrimonial.'
      )
    } finally {
      setBaixandoManutencaoId(
        null
      )
    }
  }


  async function baixarExtravioP4(
    extravio
  ) {
    if (
      !extravio?.id ||
      baixandoManutencaoId
    ) {
      return
    }

    const tipo =
      normalizarTexto(
        extravio?.tipo_material
      ) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const quantidade =
      Math.max(
        1,
        Number(
          extravio?.quantidade ||
          1
        ) || 1
      )

    const respostaQuantidade = window.prompt(
      `Quantas unidades deseja baixar? (1 a ${quantidade})`,
      String(quantidade)
    )
    if (respostaQuantidade === null) return
    const quantidadeEscolhida = Number(respostaQuantidade)
    if (!Number.isInteger(quantidadeEscolhida) || quantidadeEscolhida < 1 || quantidadeEscolhida > quantidade) {
      setErro(`Informe uma quantidade entre 1 e ${quantidade}.`)
      return
    }

    const motivo =
      window.prompt(
        `Informe o motivo da baixa definitiva do extravio de ${quantidade} ${tipo.toLowerCase()}(s):`
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      setErro(
        'Informe o motivo da baixa patrimonial.'
      )
      return
    }

    const documento =
      window.prompt(
        'Informe o documento / referência da baixa (opcional):',
        extravio?.avocacao_p4_documento ||
        extravio?.documento_numero ||
        ''
      )

    if (documento === null) {
      return
    }

    const observacoes =
      window.prompt(
        'Informe observações adicionais da baixa (opcional):',
        extravio?.avocacao_p4_observacoes ||
        extravio?.descricao ||
        ''
      )

    if (observacoes === null) {
      return
    }

    const confirmou =
      window.confirm(
        `CONFIRMAR BAIXA DEFINITIVA DO EXTRAVIO?\n\n` +
        `${tipo}: ${quantidadeEscolhida} unidade(s)\n` +
        `Motivo: ${motivoNormalizado}\n\n` +
        'O extravio será encerrado definitivamente e sairá da responsabilidade do P4.'
      )

    if (!confirmou) {
      return
    }

    try {
      setBaixandoManutencaoId(
        extravio.id
      )
      setErro('')
      setMensagemSucesso('')

      await baixarExtravioTonfaP4({
        extravioId:
          extravio.id,
        quantidadeSolicitada: quantidadeEscolhida,
        motivo:
          motivoNormalizado,
        documento:
          String(
            documento || ''
          )
            .trim()
            .toUpperCase() ||
          null,
        observacoes:
          String(
            observacoes || ''
          )
            .trim()
            .toUpperCase() ||
          null,
        user
      })

      const restantes = manutencoesBaixaP4.flatMap(registro => {
        if (String(registro?.id) !== String(extravio.id)) return [registro]
        const restante = quantidade - quantidadeEscolhida
        return restante > 0 ? [{ ...registro, quantidade: restante }] : []
      })

      setManutencoesBaixaP4(
        restantes
      )

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `Baixa definitiva do extravio registrada: ${quantidade} ${tipo.toLowerCase()}(s).`
      )

      if (
        restantes.length === 0
      ) {
        setModalBaixaP4Aberto(
          false
        )
      }
    } catch (error) {
      console.error(
        'Erro ao realizar baixa patrimonial do extravio:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível realizar a baixa patrimonial do extravio.'
      )
    } finally {
      setBaixandoManutencaoId(
        null
      )
    }
  }


  async function abrirRegularizacaoPatrimonialP4() {
    if (
      visaoPerfil !== 'P4' ||
      carregandoRegularizacaoP4
    ) {
      return
    }

    try {
      setCarregandoRegularizacaoP4(true)
      setErro('')
      setMensagemSucesso('')

      const [
        respostaManutencoes,
        respostaExtravios
      ] = await Promise.all([
        listarManutencoes({
          modulo: 'TONFAS',
          status: 'EM_MANUTENCAO',
          pagina: 1,
          limite: 5000
        }),

        supabase
          .from('sigmo_tonfas_extravios')
          .select(
            'id, tonfa_id, tipo_material, quantidade, status, responsavel_setor, policial_re, policial_nome, descricao, documento_numero, observacoes, avocacao_p4_documento, avocacao_p4_observacoes, ativo'
          )
          .eq('ativo', true)
          .eq(
            'responsavel_setor',
            'P4'
          )
      ])

      if (
        respostaExtravios?.error
      ) {
        throw respostaExtravios.error
      }

      const manutencoes =
        (respostaManutencoes?.data || [])
          .filter(
            (item) =>
              normalizarTexto(
                item?.modulo
              ) === 'TONFAS'
          )
          .filter(
            (item) =>
              !manutencaoTonfaPertenceAoSVDD(
                item
              )
          )
          .map(
            (item) => ({
              ...item,
              _tipo_regularizacao:
                'MANUTENCAO'
            })
          )

      const extravios =
        (respostaExtravios?.data || [])
          .map(
            (item) => ({
              ...item,
              _tipo_regularizacao:
                'EXTRAVIO',
              referencia_id:
                item?.tonfa_id ||
                null
            })
          )

      const registros = [
        ...manutencoes,
        ...extravios
      ]

      if (
        registros.length === 0
      ) {
        setMensagemSucesso(
          'Não há Tonfas ou Cassetetes em manutenção ou extravio sob responsabilidade do P4 disponíveis para regularização.'
        )
        return
      }

      setOcorrenciasRegularizacaoP4(
        registros
      )

      setFormRegularizacaoP4({
        itemId: '',
        policialRe: '',
        policialNome: '',
        documento: '',
        observacoes: ''
      })

      setModalRegularizacaoP4Aberto(
        true
      )
    } catch (error) {
      console.error(
        'Erro ao carregar ocorrências disponíveis para regularização:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar as ocorrências disponíveis para regularização.'
      )
    } finally {
      setCarregandoRegularizacaoP4(
        false
      )
    }
  }


  function selecionarOcorrenciaRegularizacaoP4(
    item
  ) {
    setErro('')

    setFormRegularizacaoP4({
      itemId:
        String(
          item?.id ||
          ''
        ),
      quantidade: String(Math.max(1, Number(item?.quantidade || 1))),
      policialRe:
        item?.policial_re ||
        '',
      policialNome:
        item?.policial_nome ||
        '',
      documento:
        item?.avocacao_p4_documento ||
        item?.documento_numero ||
        '',
      observacoes:
        ''
    })
  }


  async function confirmarRegularizacaoP4(
    item
  ) {
    if (
      !item?.id ||
      regularizandoP4Id
    ) {
      return
    }

    const ehExtravio =
      item?._tipo_regularizacao ===
      'EXTRAVIO'

    const tipo =
      normalizarTexto(
        item?.tipo_material
      ) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const quantidadeMaxima = Math.max(1, Number(item?.quantidade || 1))
    const quantidadeEscolhida = Number(formRegularizacaoP4.quantidade)
    if (!Number.isInteger(quantidadeEscolhida) || quantidadeEscolhida < 1 || quantidadeEscolhida > quantidadeMaxima) {
      setErro(`Informe uma quantidade entre 1 e ${quantidadeMaxima}.`)
      return
    }

    const policialRe =
      String(
        formRegularizacaoP4.policialRe ||
        ''
      )
        .trim()
        .toUpperCase()

    const policialNome =
      String(
        formRegularizacaoP4.policialNome ||
        ''
      )
        .trim()
        .toUpperCase()

    if (
      !policialRe &&
      !policialNome
    ) {
      setErro(
        'Informe o RE ou o nome do policial responsável pela reposição.'
      )
      return
    }

    const documento =
      String(
        formRegularizacaoP4.documento ||
        ''
      )
        .trim()
        .toUpperCase() ||
      null

    const observacoes =
      String(
        formRegularizacaoP4.observacoes ||
        ''
      )
        .trim()
        .toUpperCase() ||
      null

    try {
      setRegularizandoP4Id(
        item.id
      )
      setErro('')
      setMensagemSucesso('')

      if (ehExtravio) {
        await regularizarExtravioTonfaP4({
          quantidadeSolicitada: quantidadeEscolhida,
          extravioId:
            item.id,
          policialRe,
          policialNome,
          documento,
          observacoes,
          user
        })
      } else {
        await regularizarManutencaoTonfaP4({
          quantidadeSolicitada: quantidadeEscolhida,
          manutencaoId:
            item.id,
          policialRe,
          policialNome,
          documento,
          observacoes,
          user
        })
      }

      const restantes = ocorrenciasRegularizacaoP4.flatMap(registro => {
        if (String(registro?.id) !== String(item.id)) return [registro]
        const restante = quantidadeMaxima - quantidadeEscolhida
        return restante > 0 ? [{ ...registro, quantidade: restante }] : []
      })

      setOcorrenciasRegularizacaoP4(
        restantes
      )

      setFormRegularizacaoP4({
        itemId: '',
        policialRe: '',
        policialNome: '',
        documento: '',
        observacoes: ''
      })

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `${tipo} regularizado(a) por reposição do responsável e recolhido(a) ao Cofre do P4.`
      )

      if (
        restantes.length === 0
      ) {
        setModalRegularizacaoP4Aberto(
          false
        )
      }
    } catch (error) {
      console.error(
        'Erro ao regularizar Tonfa/Cassetete por reposição:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível registrar a reposição patrimonial.'
      )
    } finally {
      setRegularizandoP4Id(
        null
      )
    }
  }


  function abrirConstatacaoNovidade() {
    const campoSaldo =
      visaoPerfil === 'P4'
        ? 'quantidade_p4'
        : 'quantidade_svdd'

    const setor =
      visaoPerfil === 'P4'
        ? 'P4'
        : 'SVDD'

    const disponiveis =
      tonfasResumo.filter(
        (item) =>
          Number(
            item?.[campoSaldo] ||
            0
          ) > 0
      )

    if (
      disponiveis.length === 0
    ) {
      setMensagemSucesso(
        `Não há Tonfa ou Cassetete disponível no Cofre do ${setor} para constatar novidade.`
      )
      return
    }

    setErro('')
    setMensagemSucesso('')
    setFormManutencaoP4({
      itemId: '',
      quantidade: '1',
      tipoNovidade: 'AVARIA',
      descricao: '',
      observacoes: ''
    })

    setModalEnvioManutencaoP4Aberto(
      true
    )
  }


  async function constatarNovidadeNoEstoque(
    item
  ) {
    if (
      !item?.id ||
      enviandoManutencaoP4Id
    ) {
      return
    }

    const setor =
      visaoPerfil === 'P4'
        ? 'P4'
        : 'SVDD'

    const tipo =
      normalizarTexto(
        item?.tipo
      ) === 'CASSETETE'
        ? 'Cassetete'
        : 'Tonfa'

    const saldo =
      Math.max(
        0,
        Number(
          setor === 'P4'
            ? item?.quantidade_p4
            : item?.quantidade_svdd
        ) || 0
      )

    const quantidade =
      Math.trunc(
        Number(
          String(
            formManutencaoP4.quantidade ||
            ''
          )
            .replace(',', '.')
        )
      )

    if (
      !Number.isFinite(
        quantidade
      ) ||
      quantidade <= 0 ||
      quantidade > saldo
    ) {
      setErro(
        `Informe uma quantidade entre 1 e ${saldo}.`
      )
      return
    }

    const tipoNovidade =
      normalizarTexto(
        formManutencaoP4.tipoNovidade
      )

    if (
      ![
        'AVARIA',
        'EXTRAVIO'
      ].includes(
        tipoNovidade
      )
    ) {
      setErro(
        'Selecione AVARIA ou EXTRAVIO.'
      )
      return
    }

    const descricaoNormalizada =
      String(
        formManutencaoP4.descricao ||
        ''
      )
        .trim()
        .toUpperCase()

    if (
      !descricaoNormalizada
    ) {
      setErro(
        'Informe a descrição da novidade constatada.'
      )
      return
    }

    const observacoesNormalizadas =
      String(
        formManutencaoP4.observacoes ||
        ''
      )
        .trim()
        .toUpperCase()

    try {
      setEnviandoManutencaoP4Id(
        item.id
      )
      setErro('')
      setMensagemSucesso('')

      await constatarNovidadeTonfa({
        tonfaId:
          item.id,
        quantidade,
        setor,
        tipoNovidade,
        descricao:
          descricaoNormalizada,
        observacoes:
          observacoesNormalizadas ||
          null,
        user
      })

      await Promise.all([
        carregar(),
        carregarResumo()
      ])

      setMensagemSucesso(
        `${tipoNovidade} constatado(a): ${quantidade} ${tipo.toLowerCase()}(s) sob responsabilidade do ${setor}.`
      )

      setFormManutencaoP4({
        itemId: '',
        quantidade: '1',
        tipoNovidade: 'AVARIA',
        descricao: '',
        observacoes: ''
      })

      setModalEnvioManutencaoP4Aberto(
        false
      )
    } catch (error) {
      console.error(
        'Erro ao constatar novidade em Tonfa/Cassetete:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível registrar a novidade constatada.'
      )
    } finally {
      setEnviandoManutencaoP4Id(
        null
      )
    }
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

    if (
      tipo === 'Recebimento de manutenção do SVDD' &&
      visaoPerfil === 'P4'
    ) {
      setMovimentacaoAtiva('RECEBER_MANUTENCAO_P4')
      return
    }

    if (
      tipo === 'Encaminhamento ao P4' &&
      visaoPerfil === 'SVDD'
    ) {
      abrirOcorrenciasParaP4()
      return
    }

    if (
      tipo === 'Baixa patrimonial' &&
      visaoPerfil === 'P4'
    ) {
      abrirBaixaPatrimonialP4()
      return
    }

    if (
      tipo === 'Constatar novidade' &&
      (
        visaoPerfil === 'P4' ||
        visaoPerfil === 'SVDD'
      )
    ) {
      abrirConstatacaoNovidade()
      return
    }

    if (
      tipo === 'Regularização patrimonial' &&
      visaoPerfil === 'P4'
    ) {
      abrirRegularizacaoPatrimonialP4()
      return
    }

    const operacoesPendentes = {
      'Recebimento de manutenção':
        'O fluxo específico de retorno da manutenção ainda não possui formulário no projeto.',
      'Retorno da manutenção':
        'O fluxo específico de retorno da manutenção ainda não possui formulário no projeto.',
      
    }

    setMensagemSucesso(
      operacoesPendentes[tipo] ||
        `${tipo} ainda não possui formulário conectado.`
    )
  }

 async function confirmarTransferencia({
  modo,
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
    descricao="Tonfas e cassetetes ativos"
    destaque="azul"
    onClick={limparFiltros}
  />

  <CardResumo
    titulo="Tonfas"
    valor={resumo.totalTonfas}
    descricao="Quantidade ativa de tonfas"
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
    descricao="Quantidade ativa de cassetetes"
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
              titulo="Total"
              valor={resumo.totalGeral}
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumo.totalTonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumo.totalCassetetes
                }
              ]}
              descricao="Total ativo; baixas definitivas são exibidas separadamente"
              destaque="azul"
              onClick={limparFiltros}
            />

            <CardResumo
              titulo="Cofre do P4"
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
              titulo="SVDD"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor:
                    resumoResponsabilidadeSVDDP4.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor:
                    resumoResponsabilidadeSVDDP4.cassetetes
                }
              ]}
              descricao="Inclui cofre, em serviço, manutenção e extravio sob responsabilidade do SVDD"
              destaque="verde"
              onClick={() => filtrarPorPesquisa('SVDD')}
            />

            <CardResumo
              titulo="Outras Cias"
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
              descricao="Inclui Força Tática"
              onClick={() => filtrarPorPesquisa('CIA')}
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
              onClick={() => setCautelasModalAberto(true)}
            />

            <CardResumo
              titulo="Manutenção"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor:
                    manutencaoP4Resumo.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor:
                    manutencaoP4Resumo.cassetetes
                }
              ]}
              onClick={() => filtrarPorPesquisa('manutenção')}
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
              titulo="Descarregados"
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
                  valor:
                    Number(
                      resumo.distribuicao.outros.tonfas ||
                      0
                    ) +
                    Number(
                      resumoExtraviosP4Ativos.tonfas ||
                      0
                    )
                },
                {
                  titulo: 'Cassetetes',
                  valor:
                    Number(
                      resumo.distribuicao.outros.cassetetes ||
                      0
                    ) +
                    Number(
                      resumoExtraviosP4Ativos.cassetetes ||
                      0
                    )
                }
              ]}
              descricao="Inclui outras unidades/destinos e somente extravios ativos sob responsabilidade do P4"
              onClick={abrirOutrosP4}
            />
          </div>
        </section>

        <PainelGraficosTonfas resumo={resumoP4Visual} />

        <section className="tonfa-dashboard-section tonfa-movements-section">
          <div className="tonfa-section-title">
            <div>
              <span>Operações permitidas</span>
              <h2>Movimentações patrimoniais</h2>
            </div>
          </div>

          <div className="tonfa-movement-groups">
            <GrupoMovimentacao
              icone="↔️"
              titulo="Movimentação interna"
              descricao="Transferências entre os cofres e demais destinos patrimoniais."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao('Transferência')
                }
              >
                <strong>Transferir</strong>
                <span>
                  Enviar para SVDD, Outras Cias ou Batalhão
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
                  Confirmar devolução enviada pelo SVDD ao Cofre do P4
                </span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="📤"
              titulo="Entregas e cautelas"
              descricao="Vínculo permanente ou entrega temporária a policial."
            >
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
                  Vincular permanentemente o material a um policial
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
                  Entregar temporariamente com previsão de devolução
                </span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="📥"
              titulo="Entradas e recebimentos"
              descricao="Devoluções, retornos e recolhimentos ao Cofre do P4."
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
                  Encerrar carga ou cautela e recolher o material
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Recebimento de manutenção do SVDD'
                  )
                }
              >
                <strong>Receber manutenção do SVDD</strong>
                <span>
                  Analisar e aceitar manutenção encaminhada pelo SVDD
                </span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="🛠️"
              titulo="Condição do material"
              descricao="Manutenção, regularização e baixa patrimonial."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Constatar novidade'
                  )
                }
              >
                <strong>Constatar novidade</strong>
                <span>
                  Registrar AVARIA ou EXTRAVIO constatado no Cofre do P4
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
                  Registrar reposição física feita pelo policial responsável
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
                  Baixar definitivamente material em manutenção sob responsabilidade do P4
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
              <h2>Carga patrimonial do SVDD</h2>
            </div>

            {loadingResumo && (
              <small>Atualizando indicadores...</small>
            )}
          </div>

          <div className="tonfa-resumo-grid tonfa-resumo-grid-carga">
            <CardResumo
              titulo="Carga total"
              valor={resumoSVDD.totalGeral}
              descricao="Somente materiais sob responsabilidade do SVDD"
              destaque="azul"
              onClick={() => filtrarPorPesquisa('SVDD')}
            />

            <CardResumo
              titulo="Tonfas"
              valor={resumoSVDD.totalTonfas}
              descricao="Tonfas no cofre, em serviço, manutenção ou extravio"
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
              valor={resumoSVDD.totalCassetetes}
              descricao="Cassetetes no cofre, em serviço, manutenção ou extravio"
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
              titulo="Manutenção"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumoSVDD.manutencao.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumoSVDD.manutencao.cassetetes
                }
              ]}
              destaque="vermelho"
              onClick={() => filtrarPorPesquisa('manutenção')}
            />
          </div>
        </section>

        <section className="tonfa-dashboard-section">
          <div className="tonfa-section-title">
            <div>
              <span>Distribuição atual</span>
              <h2>Onde estão os materiais do SVDD</h2>
            </div>
          </div>

          <div className="tonfa-resumo-grid">
            <CardResumo
              titulo="No cofre do SVDD"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumoSVDD.noCofre.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumoSVDD.noCofre.cassetetes
                }
              ]}
              destaque="verde"
              onClick={() => filtrarPorPesquisa('SVDD')}
            />

            <CardResumo
              titulo="Cautelas ativas"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumoSVDD.emServico.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumoSVDD.emServico.cassetetes
                }
              ]}
              destaque="azul"
              onClick={() => setCautelasModalAberto(true)}
            />

            <CardResumo
              titulo="Manutenção"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumoSVDD.manutencao.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumoSVDD.manutencao.cassetetes
                }
              ]}
              destaque="vermelho"
              onClick={() => filtrarPorPesquisa('manutenção')}
            />

            <CardResumo
              titulo="Extravio"
              detalhes={[
                {
                  titulo: 'Tonfas',
                  valor: resumoSVDD.extravio.tonfas
                },
                {
                  titulo: 'Cassetetes',
                  valor: resumoSVDD.extravio.cassetetes
                }
              ]}
              destaque="vermelho"
              onClick={abrirExtraviosSvdd}
            />
          </div>
        </section>

        <section className="tonfa-dashboard-section tonfa-movements-section">
          <div className="tonfa-section-title">
            <div>
              <span>Operações permitidas</span>
              <h2>Movimentações patrimoniais</h2>
            </div>
          </div>

          <div className="tonfa-movement-groups">
            <GrupoMovimentacao
              icone="↔️"
              titulo="Movimentação interna"
              descricao="Transferências entre o Cofre do P4 e o Cofre do SVDD."
            >
              <button
                type="button"
                onClick={() => iniciarMovimentacao('Recebimento do P4')}
              >
                <strong>Receber do P4</strong>
                <span>Confirmar material enviado pelo P4</span>
              </button>

              <button
                type="button"
                onClick={() => iniciarMovimentacao('Devolução ao P4')}
              >
                <strong>Devolver ao P4</strong>
                <span>Encaminhar saldo disponível ao Cofre do P4</span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="📤"
              titulo="Cautelas"
              descricao="Entrega temporária e recebimento de devoluções."
            >
              <button
                type="button"
                onClick={() => iniciarMovimentacao('Pagamento de cautela')}
              >
                <strong>Pagar cautela</strong>
                <span>Entregar temporariamente a um policial</span>
              </button>

              <button
                type="button"
                onClick={() => iniciarMovimentacao('Recebimento de cautela')}
              >
                <strong>Receber devolução</strong>
                <span>Encerrar cautela e retornar ao Cofre do SVDD</span>
              </button>
            </GrupoMovimentacao>

            <GrupoMovimentacao
              icone="🛠️"
              titulo="Condição do material"
              descricao="Constatação de novidade, regularização e encaminhamento ao P4."
            >
              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Constatar novidade'
                  )
                }
              >
                <strong>Constatar novidade</strong>
                <span>
                  Registrar AVARIA ou EXTRAVIO constatado no Cofre do SVDD
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  iniciarMovimentacao(
                    'Encaminhamento ao P4'
                  )
                }
              >
                <strong>Encaminhar ao P4</strong>
                <span>
                  Enviar manutenção ou procedimento de extravio para análise do P4
                </span>
              </button>

              <button
                type="button"
                onClick={() => iniciarMovimentacao('Retorno da manutenção')}
              >
                <strong>Receber manutenção</strong>
                <span>Registrar retorno do material para o Cofre do SVDD</span>
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
  movimentacaoAtiva === 'RECEBER_DEVOLUCAO_P4' ||
  movimentacaoAtiva === 'RECEBER_MANUTENCAO_P4'
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
                <p>{visaoPerfil === 'SVDD' ? tonfasTabela.length : total} encontrado(s)</p>
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
              tonfas={tonfasTabela}
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

      {modalManutencoesP4Aberto && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() => {
            if (!encaminhandoManutencaoId) {
              setModalManutencoesP4Aberto(false)
            }
          }}
        >
          <section
            className="tonfa-modal tonfa-manutencao-p4-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-manutencao-p4-header">
              <div>
                <span className="tonfa-manutencao-p4-eyebrow">
                  OCORRÊNCIAS / SVDD
                </span>

                <h2>Encaminhar ao P4</h2>

                <p>
                  Selecione a manutenção ou o procedimento de extravio
                  que será encaminhado para avaliação do P4.
                </p>
              </div>

              <button
                type="button"
                className="tonfa-manutencao-p4-fechar"
                aria-label="Fechar"
                disabled={Boolean(encaminhandoManutencaoId)}
                onClick={() =>
                  setModalManutencoesP4Aberto(false)
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-manutencao-p4-info">
              <strong>
                {manutencoesParaP4.length}
              </strong>
              <span>
                ocorrência(s) disponível(is) para encaminhamento
              </span>
            </div>

            <div className="tonfa-manutencao-p4-lista">
              {manutencoesParaP4.map((item) => {
                const ehExtravio =
                  item?._tipo_encaminhamento ===
                  'EXTRAVIO'

                const tipo =
                  normalizarTexto(item?.tipo_material) === 'CASSETETE'
                    ? 'Cassetete'
                    : 'Tonfa'

                const quantidade = Math.max(
                  1,
                  Number(item?.quantidade || 1)
                )

                const enviando =
                  String(encaminhandoManutencaoId || '') ===
                  String(item?.id || '')

                const origem =
                  item?.policial_nome
                    ? `${item.policial_nome}${
                        item?.policial_re
                          ? ` — RE ${item.policial_re}`
                          : ''
                      }`
                    : (
                        item?.origem ||
                        item?.origem_institucional ||
                        'SVDD'
                      )

                const descricao =
                  item?.descricao ||
                  item?.tipo_novidade ||
                  'Manutenção sem descrição.'

                return (
                  <article
                    key={item.id}
                    className="tonfa-manutencao-p4-card"
                  >
                    <div className="tonfa-manutencao-p4-foto">
                      {item?.foto_manutencao_url ? (
                        <img
                          src={item.foto_manutencao_url}
                          alt={`${tipo} em manutenção`}
                        />
                      ) : (
                        <div className="tonfa-manutencao-p4-sem-foto">
                          <span>🛠️</span>
                          <small>Sem foto</small>
                        </div>
                      )}
                    </div>

                    <div className="tonfa-manutencao-p4-conteudo">
                      <div className="tonfa-manutencao-p4-topo">
                        <div>
                          <span className="tonfa-manutencao-p4-tipo">
                            {tipo}
                          </span>

                          <h3>
                            {ehExtravio
                              ? `${tipo} extraviado`
                              : `${tipo} em manutenção`}
                          </h3>
                        </div>

                        <span className="tonfa-manutencao-p4-status">
                          {ehExtravio
                            ? 'EXTRAVIO'
                            : 'EM MANUTENÇÃO'}
                        </span>
                      </div>

                      <div className="tonfa-manutencao-p4-dados">
                        <div>
                          <span>Quantidade</span>
                          <strong>{quantidade}</strong>
                        </div>

                        <div>
                          <span>Origem</span>
                          <strong>{origem}</strong>
                        </div>

                        <div>
                          <span>Destino</span>
                          <strong>P4</strong>
                        </div>

                        <div>
                          <span>Referência</span>
                          <strong>
                            {item?.referencia_id
                              ? String(item.referencia_id).slice(0, 8)
                              : '—'}
                          </strong>
                        </div>
                      </div>

                      <div className="tonfa-manutencao-p4-descricao">
                        <span>Ocorrência / observação</span>
                        <p>{descricao}</p>
                      </div>

                      <div className="tonfa-manutencao-p4-acoes">
                        <button
                          type="button"
                          className="tonfa-manutencao-p4-enviar"
                          disabled={Boolean(encaminhandoManutencaoId)}
                          onClick={() =>
                            encaminharRegistroManutencaoAoP4(item)
                          }
                        >
                          {enviando
                            ? 'Encaminhando...'
                            : ehExtravio
                              ? 'Encaminhar extravio ao P4'
                              : 'Enviar manutenção ao P4'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}



      {modalRegularizacaoP4Aberto && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() => {
            if (!regularizandoP4Id) {
              setModalRegularizacaoP4Aberto(false)
            }
          }}
        >
          <section
            className="tonfa-modal tonfa-manutencao-p4-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-manutencao-p4-header">
              <div>
                <span className="tonfa-manutencao-p4-eyebrow">
                  REGULARIZAÇÃO / P4
                </span>

                <h2>
                  Reposição pelo responsável
                </h2>

                <p>
                  Selecione uma manutenção ou extravio e registre a reposição física feita pelo policial responsável.
                </p>
              </div>

              <button
                type="button"
                className="tonfa-manutencao-p4-fechar"
                aria-label="Fechar"
                disabled={Boolean(
                  regularizandoP4Id
                )}
                onClick={() =>
                  setModalRegularizacaoP4Aberto(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-manutencao-p4-info">
              <strong>
                {ocorrenciasRegularizacaoP4.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      1,
                      Number(
                        item?.quantidade ||
                        1
                      ) || 1
                    ),
                  0
                )}
              </strong>

              <span>
                unidade(s) disponível(is) para regularização por reposição
              </span>
            </div>

            <div className="tonfa-manutencao-p4-lista">
              {ocorrenciasRegularizacaoP4.map(
                (item) => {
                  const ehExtravio =
                    item?._tipo_regularizacao ===
                    'EXTRAVIO'

                  const tipo =
                    normalizarTexto(
                      item?.tipo_material
                    ) === 'CASSETETE'
                      ? 'Cassetete'
                      : 'Tonfa'

                  const quantidade =
                    Math.max(
                      1,
                      Number(
                        item?.quantidade ||
                        1
                      ) || 1
                    )

                  const selecionado =
                    String(
                      formRegularizacaoP4.itemId ||
                      ''
                    ) ===
                    String(
                      item?.id ||
                      ''
                    )

                  const processando =
                    String(
                      regularizandoP4Id ||
                      ''
                    ) ===
                    String(
                      item?.id ||
                      ''
                    )

                  return (
                    <article
                      key={item.id}
                      className="tonfa-manutencao-p4-card"
                    >
                      <div className="tonfa-manutencao-p4-conteudo">
                        <div className="tonfa-manutencao-p4-topo">
                          <div>
                            <span className="tonfa-manutencao-p4-tipo">
                              {tipo}
                            </span>

                            <h3>
                              {ehExtravio
                                ? `${tipo} extraviado`
                                : `${tipo} em manutenção`}
                            </h3>
                          </div>

                          <span className="tonfa-manutencao-p4-status">
                            {ehExtravio
                              ? 'EXTRAVIO • P4'
                              : 'MANUTENÇÃO • P4'}
                          </span>
                        </div>

                        <div className="tonfa-manutencao-p4-dados">
                          <div>
                            <span>Quantidade</span>
                            <strong>
                              {quantidade}
                            </strong>
                          </div>

                          <div>
                            <span>Policial relacionado</span>
                            <strong>
                              {item?.policial_nome ||
                                'Não informado'}
                              {item?.policial_re
                                ? ` — RE ${item.policial_re}`
                                : ''}
                            </strong>
                          </div>

                          <div>
                            <span>Origem</span>
                            <strong>
                              {ehExtravio
                                ? 'EXTRAVIO / P4'
                                : (
                                    item?.origem ||
                                    item?.local_origem ||
                                    item?.origem_institucional ||
                                    'P4'
                                  )}
                            </strong>
                          </div>

                          <div>
                            <span>Situação</span>
                            <strong>
                              {ehExtravio
                                ? String(
                                    item?.status ||
                                    'AVOCADO_P4'
                                  ).replaceAll(
                                    '_',
                                    ' '
                                  )
                                : 'EM MANUTENÇÃO'}
                            </strong>
                          </div>
                        </div>

                        <div className="tonfa-manutencao-p4-descricao">
                          <span>
                            Motivo / ocorrência
                          </span>
                          <p>
                            {item?.descricao ||
                              item?.tipo_novidade ||
                              item?.avocacao_p4_observacoes ||
                              item?.observacoes ||
                              'Não informado.'}
                          </p>
                        </div>

                        {!selecionado ? (
                          <div className="tonfa-manutencao-p4-acoes">
                            <button
                              type="button"
                              className="tonfa-manutencao-p4-enviar"
                              disabled={Boolean(
                                regularizandoP4Id
                              )}
                              onClick={() =>
                                selecionarOcorrenciaRegularizacaoP4(
                                  item
                                )
                              }
                            >
                              Regularizar por reposição
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'grid',
                              gap: 12,
                              marginTop: 14,
                              paddingTop: 14,
                              borderTop: '1px solid #dbe3ee'
                            }}
                          >
                             <label style={{ display: 'grid', gap: 6 }}>
                               <span>Quantidade a regularizar (máximo {quantidade})</span>
                               <input type="number" min="1" max={quantidade} step="1"
                                 value={formRegularizacaoP4.quantidade}
                                 onChange={(event) => setFormRegularizacaoP4(atual => ({ ...atual, quantidade: event.target.value }))}
                               />
                             </label>

                            <label
                              style={{
                                display: 'grid',
                                gap: 6
                              }}
                            >
                              <span>
                                RE do policial responsável
                              </span>

                              <input
                                type="text"
                                value={
                                  formRegularizacaoP4.policialRe
                                }
                                onChange={(event) =>
                                  setFormRegularizacaoP4(
                                    (atual) => ({
                                      ...atual,
                                      policialRe:
                                        event.target.value
                                    })
                                  )
                                }
                                placeholder="RE"
                              />
                            </label>

                            <label
                              style={{
                                display: 'grid',
                                gap: 6
                              }}
                            >
                              <span>
                                Nome do policial responsável
                              </span>

                              <input
                                type="text"
                                value={
                                  formRegularizacaoP4.policialNome
                                }
                                onChange={(event) =>
                                  setFormRegularizacaoP4(
                                    (atual) => ({
                                      ...atual,
                                      policialNome:
                                        event.target.value
                                    })
                                  )
                                }
                                placeholder="Nome / nome de guerra"
                              />
                            </label>

                            <label
                              style={{
                                display: 'grid',
                                gap: 6
                              }}
                            >
                              <span>
                                Documento / referência
                              </span>

                              <input
                                type="text"
                                value={
                                  formRegularizacaoP4.documento
                                }
                                onChange={(event) =>
                                  setFormRegularizacaoP4(
                                    (atual) => ({
                                      ...atual,
                                      documento:
                                        event.target.value
                                    })
                                  )
                                }
                                placeholder="Opcional"
                              />
                            </label>

                            <label
                              style={{
                                display: 'grid',
                                gap: 6
                              }}
                            >
                              <span>
                                Observações
                              </span>

                              <textarea
                                rows="3"
                                value={
                                  formRegularizacaoP4.observacoes
                                }
                                onChange={(event) =>
                                  setFormRegularizacaoP4(
                                    (atual) => ({
                                      ...atual,
                                      observacoes:
                                        event.target.value
                                    })
                                  )
                                }
                                placeholder="Opcional"
                              />
                            </label>

                            <div className="tonfa-manutencao-p4-acoes">
                              <button
                                type="button"
                                className="tonfa-manutencao-p4-enviar"
                                disabled={Boolean(
                                  regularizandoP4Id
                                )}
                                onClick={() =>
                                  confirmarRegularizacaoP4(
                                    item
                                  )
                                }
                              >
                                {processando
                                  ? 'Regularizando...'
                                  : `Confirmar reposição de ${formRegularizacaoP4.quantidade || 0} unidade(s)`}
                              </button>

                              <button
                                type="button"
                                className="tonfa-btn-secondary"
                                disabled={Boolean(
                                  regularizandoP4Id
                                )}
                                onClick={() =>
                                  setFormRegularizacaoP4({
                                    itemId: '',
                                    policialRe: '',
                                    policialNome: '',
                                    documento: '',
                                    observacoes: ''
                                  })
                                }
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                }
              )}
            </div>
          </section>
        </div>
      )}

      {modalEnvioManutencaoP4Aberto && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() => {
            if (!enviandoManutencaoP4Id) {
              setModalEnvioManutencaoP4Aberto(false)
            }
          }}
        >
          <section
            className="tonfa-modal tonfa-manutencao-p4-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-manutencao-p4-header">
              <div>
                <span className="tonfa-manutencao-p4-eyebrow">
                  NOVIDADE PATRIMONIAL / {visaoPerfil}
                </span>

                <h2>
                  Constatar novidade
                </h2>

                <p>
                  Selecione o material disponível no cofre e informe se foi constatada AVARIA ou EXTRAVIO.
                </p>
              </div>

              <button
                type="button"
                className="tonfa-manutencao-p4-fechar"
                aria-label="Fechar"
                disabled={Boolean(
                  enviandoManutencaoP4Id
                )}
                onClick={() =>
                  setModalEnvioManutencaoP4Aberto(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-manutencao-p4-info">
              <strong>
                {tonfasResumo.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      0,
                      Number(
                        visaoPerfil === 'P4'
                          ? item?.quantidade_p4
                          : item?.quantidade_svdd
                      ) || 0
                    ),
                  0
                )}
              </strong>

              <span>
                unidade(s) disponível(is) no Cofre do {visaoPerfil}
              </span>
            </div>

            <div className="tonfa-manutencao-p4-lista">
              {tonfasResumo
                .filter(
                  (item) =>
                    Number(
                      visaoPerfil === 'P4'
                        ? item?.quantidade_p4
                        : item?.quantidade_svdd
                    ) > 0
                )
                .map(
                  (item) => {
                    const tipo =
                      normalizarTexto(
                        item?.tipo
                      ) === 'CASSETETE'
                        ? 'Cassetete'
                        : 'Tonfa'

                    const saldo =
                      Number(
                        visaoPerfil === 'P4'
                          ? item?.quantidade_p4
                          : item?.quantidade_svdd
                      )

                    const processando =
                      String(
                        enviandoManutencaoP4Id ||
                        ''
                      ) ===
                      String(
                        item?.id ||
                        ''
                      )

                    return (
                      <article
                        key={item.id}
                        className="tonfa-manutencao-p4-card"
                      >
                        <div className="tonfa-manutencao-p4-conteudo">
                          <div className="tonfa-manutencao-p4-topo">
                            <div>
                              <span className="tonfa-manutencao-p4-tipo">
                                {tipo}
                              </span>

                              <h3>
                                {tipo} no Cofre do {visaoPerfil}
                              </h3>
                            </div>

                            <span className="tonfa-manutencao-p4-status">
                              DISPONÍVEL
                            </span>
                          </div>

                          <div className="tonfa-manutencao-p4-dados">
                            <div>
                              <span>
                                Disponível
                              </span>

                              <strong>
                                {saldo}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Origem
                              </span>

                              <strong>
                                COFRE DO {visaoPerfil}
                              </strong>
                            </div>
                          </div>

                          {String(
                            formManutencaoP4.itemId ||
                            ''
                          ) !==
                          String(
                            item?.id ||
                            ''
                          ) ? (
                            <div className="tonfa-manutencao-p4-acoes">
                              <button
                                type="button"
                                className="tonfa-manutencao-p4-enviar"
                                disabled={Boolean(
                                  enviandoManutencaoP4Id
                                )}
                                onClick={() => {
                                  setErro('')
                                  setFormManutencaoP4({
                                    itemId:
                                      item.id,
                                    quantidade:
                                      '1',
                                    tipoNovidade:
                                      'AVARIA',
                                    descricao:
                                      '',
                                    observacoes:
                                      ''
                                  })
                                }}
                              >
                                Constatar novidade
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'grid',
                                gap: 12,
                                marginTop: 14,
                                paddingTop: 14,
                                borderTop: '1px solid #dbe3ee'
                              }}
                            >
                              <label
                                style={{
                                  display: 'grid',
                                  gap: 6
                                }}
                              >
                                <span>
                                  Quantidade
                                </span>
                                <input
                                  type="number"
                                  min="1"
                                  max={saldo}
                                  value={
                                    formManutencaoP4.quantidade
                                  }
                                  onChange={(event) =>
                                    setFormManutencaoP4(
                                      (atual) => ({
                                        ...atual,
                                        quantidade:
                                          event.target.value
                                      })
                                    )
                                  }
                                />
                              </label>

                              <label
                                style={{
                                  display: 'grid',
                                  gap: 6
                                }}
                              >
                                <span>
                                  Tipo da novidade
                                </span>

                                <select
                                  value={
                                    formManutencaoP4.tipoNovidade
                                  }
                                  onChange={(event) =>
                                    setFormManutencaoP4(
                                      (atual) => ({
                                        ...atual,
                                        tipoNovidade:
                                          event.target.value
                                      })
                                    )
                                  }
                                >
                                  <option value="AVARIA">
                                    AVARIA
                                  </option>
                                  <option value="EXTRAVIO">
                                    EXTRAVIO
                                  </option>
                                </select>
                              </label>

                              <label
                                style={{
                                  display: 'grid',
                                  gap: 6
                                }}
                              >
                                <span>
                                  Descrição da novidade
                                </span>
                                <textarea
                                  rows="3"
                                  value={
                                    formManutencaoP4.descricao
                                  }
                                  onChange={(event) =>
                                    setFormManutencaoP4(
                                      (atual) => ({
                                        ...atual,
                                        descricao:
                                          event.target.value
                                      })
                                    )
                                  }
                                  placeholder="Descreva o motivo da manutenção"
                                />
                              </label>

                              <label
                                style={{
                                  display: 'grid',
                                  gap: 6
                                }}
                              >
                                <span>
                                  Observações
                                </span>
                                <textarea
                                  rows="2"
                                  value={
                                    formManutencaoP4.observacoes
                                  }
                                  onChange={(event) =>
                                    setFormManutencaoP4(
                                      (atual) => ({
                                        ...atual,
                                        observacoes:
                                          event.target.value
                                      })
                                    )
                                  }
                                  placeholder="Opcional"
                                />
                              </label>

                              <div className="tonfa-manutencao-p4-acoes">
                                <button
                                  type="button"
                                  className="tonfa-manutencao-p4-enviar"
                                  disabled={Boolean(
                                    enviandoManutencaoP4Id
                                  )}
                                  onClick={() =>
                                    constatarNovidadeNoEstoque(
                                      item
                                    )
                                  }
                                >
                                  {processando
                                    ? 'Registrando...'
                                    : 'Confirmar novidade'}
                                </button>

                                <button
                                  type="button"
                                  className="tonfa-btn-secondary"
                                  disabled={Boolean(
                                    enviandoManutencaoP4Id
                                  )}
                                  onClick={() =>
                                    setFormManutencaoP4({
                                      itemId: '',
                                      quantidade: '1',
                                      tipoNovidade: 'AVARIA',
                                      descricao: '',
                                      observacoes: ''
                                    })
                                  }
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  }
                )}
            </div>
          </section>
        </div>
      )}

      {modalBaixaP4Aberto && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() => {
            if (!baixandoManutencaoId) {
              setModalBaixaP4Aberto(false)
            }
          }}
        >
          <section
            className="tonfa-modal tonfa-manutencao-p4-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-manutencao-p4-header">
              <div>
                <span className="tonfa-manutencao-p4-eyebrow">
                  BAIXA PATRIMONIAL / P4
                </span>

                <h2>
                  Baixar patrimônio definitivamente
                </h2>

                <p>
                  Selecione a manutenção ou o extravio sob responsabilidade do P4 que terá baixa patrimonial definitiva.
                </p>
              </div>

              <button
                type="button"
                className="tonfa-manutencao-p4-fechar"
                aria-label="Fechar"
                disabled={Boolean(
                  baixandoManutencaoId
                )}
                onClick={() =>
                  setModalBaixaP4Aberto(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-manutencao-p4-info">
              <strong>
                {manutencoesBaixaP4.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      1,
                      Number(
                        item?.quantidade ||
                        1
                      ) || 1
                    ),
                  0
                )}
              </strong>

              <span>
                unidade(s) disponíveis para baixa definitiva
              </span>
            </div>

            <div className="tonfa-manutencao-p4-lista">
              {manutencoesBaixaP4.map(
                (item) => {
                  const ehExtravio =
                    item?._tipo_baixa ===
                    'EXTRAVIO'

                  const tipo =
                    normalizarTexto(
                      item?.tipo_material
                    ) === 'CASSETETE'
                      ? 'Cassetete'
                      : 'Tonfa'

                  const quantidade =
                    Math.max(
                      1,
                      Number(
                        item?.quantidade ||
                        1
                      ) || 1
                    )

                  const processando =
                    String(
                      baixandoManutencaoId ||
                      ''
                    ) ===
                    String(
                      item?.id ||
                      ''
                    )

                  return (
                    <article
                      key={item.id}
                      className="tonfa-manutencao-p4-card"
                    >
                      <div className="tonfa-manutencao-p4-conteudo">
                        <div className="tonfa-manutencao-p4-topo">
                          <div>
                            <span className="tonfa-manutencao-p4-tipo">
                              {tipo}
                            </span>

                            <h3>
                              {ehExtravio
                                ? `${tipo} extraviado`
                                : `${tipo} em manutenção`}
                            </h3>
                          </div>

                          <span className="tonfa-manutencao-p4-status">
                            {ehExtravio
                              ? 'EXTRAVIO • P4'
                              : 'EM MANUTENÇÃO • P4'}
                          </span>
                        </div>

                        <div className="tonfa-manutencao-p4-dados">
                          <div>
                            <span>Quantidade</span>
                            <strong>{quantidade}</strong>
                          </div>

                          <div>
                            <span>Origem</span>
                            <strong>
                              {item?.origem ||
                                item?.local_origem ||
                                item?.origem_institucional ||
                                'P4'}
                            </strong>
                          </div>

                          <div>
                            <span>Responsabilidade atual</span>
                            <strong>P4</strong>
                          </div>

                          <div>
                            <span>Manutenção</span>
                            <strong>
                              {String(
                                item?.id ||
                                ''
                              ).slice(
                                0,
                                8
                              ) || '—'}
                            </strong>
                          </div>
                        </div>

                        {!ehExtravio && (
                          <>
                            <div className="tonfa-manutencao-p4-descricao">
                              <span>Tipo da ocorrência</span>
                              <p>
                                {item?.tipo_novidade ||
                                  item?.tipo_ocorrencia ||
                                  'MANUTENÇÃO'}
                              </p>
                            </div>

                            <div className="tonfa-manutencao-p4-descricao">
                              <span>Motivo / defeito / avaria</span>
                              <p>
                                {item?.descricao ||
                                  item?.motivo ||
                                  'Não informado.'}
                              </p>
                            </div>

                            <div className="tonfa-manutencao-p4-descricao">
                              <span>Observações</span>
                              <p>
                                {item?.observacoes ||
                                  'Sem observações.'}
                              </p>
                            </div>

                            <div className="tonfa-manutencao-p4-descricao">
                              <span>Registrado em</span>
                              <p>
                                {item?.registrada_em ||
                                item?.created_at
                                  ? new Date(
                                      item?.registrada_em ||
                                      item?.created_at
                                    ).toLocaleString(
                                      'pt-BR'
                                    )
                                  : 'Não informado.'}
                              </p>
                            </div>
                          </>
                        )}

                        {ehExtravio && (
                          <div className="tonfa-manutencao-p4-descricao">
                            <span>Descrição / observações do extravio</span>
                            <p>
                              {item?.avocacao_p4_observacoes ||
                                item?.descricao ||
                                item?.observacoes ||
                                'Sem descrição.'}
                            </p>
                          </div>
                        )}

                        <div className="tonfa-manutencao-p4-acoes">
                          <button
                            type="button"
                            className="tonfa-action-danger"
                            disabled={Boolean(
                              baixandoManutencaoId
                            )}
                            onClick={() =>
                              ehExtravio
                                ? baixarExtravioP4(
                                    item
                                  )
                                : baixarManutencaoP4(
                                    item
                                  )
                            }
                          >
                            {processando
                              ? 'Baixando...'
                              : ehExtravio
                                ? 'Baixar extravio definitivamente'
                                : 'Baixar manutenção definitivamente'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                }
              )}
            </div>
          </section>
        </div>
      )}

      {modalOutrosP4Aberto && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() => {
            if (!carregandoOutrosP4) {
              setModalOutrosP4Aberto(false)
            }
          }}
        >
          <section
            className="tonfa-modal tonfa-manutencao-p4-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-manutencao-p4-header">
              <div>
                <span className="tonfa-manutencao-p4-eyebrow">
                  OUTROS / P4
                </span>

                <h2>Outros destinos e extravios</h2>

                <p>
                  Materiais fora dos grupos principais, incluindo outras unidades/destinos e extravios sob responsabilidade do P4.
                </p>
              </div>

              <button
                type="button"
                className="tonfa-manutencao-p4-fechar"
                aria-label="Fechar"
                onClick={() =>
                  setModalOutrosP4Aberto(false)
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-manutencao-p4-info">
              <strong>
                {outrosP4Itens.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      0,
                      Number(item?.quantidade || 0) || 0
                    ),
                  0
                )}
              </strong>

              <span>
                unidade(s) classificada(s) em Outros
              </span>
            </div>

            <div className="tonfa-manutencao-p4-lista">
              {outrosP4Itens.length === 0 ? (
                <div className="tonfa-alert-success tonfa-page-success">
                  <div>
                    <strong>Nenhum material em Outros.</strong>
                    <span>
                      Não há outras unidades/destinos nem extravios sob responsabilidade do P4.
                    </span>
                  </div>
                </div>
              ) : (
                outrosP4Itens.map((item) => {
                  const ehExtravio =
                    item?._tipo_outros ===
                    'EXTRAVIO'

                  const tipo =
                    normalizarTexto(
                      item?.tipo_material
                    ) === 'CASSETETE'
                      ? 'Cassetete'
                      : 'Tonfa'

                  const quantidade =
                    Math.max(
                      1,
                      Number(
                        item?.quantidade ||
                        1
                      ) || 1
                    )

                  return (
                    <article
                      key={item.id}
                      className="tonfa-manutencao-p4-card"
                    >
                      <div className="tonfa-manutencao-p4-conteudo">
                        <div className="tonfa-manutencao-p4-topo">
                          <div>
                            <span className="tonfa-manutencao-p4-tipo">
                              {tipo}
                            </span>

                            <h3>
                              {ehExtravio
                                ? `${tipo} extraviado`
                                : `${tipo} em outro destino`}
                            </h3>
                          </div>

                          <span className="tonfa-manutencao-p4-status">
                            {ehExtravio
                              ? String(
                                  item?.status ||
                                  'AVOCADO_P4'
                                ).replaceAll(
                                  '_',
                                  ' '
                                )
                              : 'OUTRO DESTINO'}
                          </span>
                        </div>

                        <div className="tonfa-manutencao-p4-dados">
                          <div>
                            <span>Quantidade</span>
                            <strong>
                              {quantidade}
                            </strong>
                          </div>

                          <div>
                            <span>
                              {ehExtravio
                                ? 'Responsabilidade'
                                : 'Destino / localização'}
                            </span>
                            <strong>
                              {ehExtravio
                                ? item?.responsavel_setor ||
                                  'P4'
                                : item?.destino ||
                                  'Não informado'}
                            </strong>
                          </div>

                          {ehExtravio && (
                            <>
                              <div>
                                <span>Policial</span>
                                <strong>
                                  {item?.policial_nome ||
                                    'Não informado'}
                                  {item?.policial_re
                                    ? ` — RE ${item.policial_re}`
                                    : ''}
                                </strong>
                              </div>

                              <div>
                                <span>Documento</span>
                                <strong>
                                  {item?.avocacao_p4_documento ||
                                    item?.documento_numero ||
                                    'Não informado'}
                                </strong>
                              </div>
                            </>
                          )}

                          {!ehExtravio &&
                            item?.unidade && (
                              <div>
                                <span>Unidade</span>
                                <strong>
                                  {item.unidade}
                                </strong>
                              </div>
                            )}
                        </div>

                        <div className="tonfa-manutencao-p4-descricao">
                          <span>
                            {ehExtravio
                              ? 'Descrição / observações'
                              : 'Observações'}
                          </span>

                          <p>
                            {ehExtravio
                              ? item?.avocacao_p4_observacoes ||
                                item?.descricao ||
                                item?.observacoes ||
                                'Sem observações.'
                              : item?.observacoes ||
                                'Sem observações.'}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        </div>
      )}

      {modalExtraviosAberto && (
        <div
          className="tonfa-modal-backdrop"
          onMouseDown={() => {
            if (!carregandoExtravios) {
              setModalExtraviosAberto(false)
            }
          }}
        >
          <section
            className="tonfa-modal tonfa-manutencao-p4-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tonfa-manutencao-p4-header">
              <div>
                <span className="tonfa-manutencao-p4-eyebrow">
                  EXTRAVIO / SVDD
                </span>
                <h2>Materiais extraviados</h2>
                <p>
                  Tonfas e Cassetetes extraviados sob responsabilidade do SVDD.
                </p>
              </div>

              <button
                type="button"
                className="tonfa-manutencao-p4-fechar"
                aria-label="Fechar"
                onClick={() =>
                  setModalExtraviosAberto(false)
                }
              >
                ×
              </button>
            </div>

            <div className="tonfa-manutencao-p4-info">
              <strong>
                {extraviosSvdd.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      1,
                      Number(item?.quantidade || 1) || 1
                    ),
                  0
                )}
              </strong>
              <span>
                unidade(s) extraviada(s) sob responsabilidade do SVDD
              </span>
            </div>

            <div className="tonfa-manutencao-p4-lista">
              {extraviosSvdd.length === 0 ? (
                <div className="tonfa-alert-success tonfa-page-success">
                  <div>
                    <strong>Nenhum extravio ativo.</strong>
                    <span>
                      Não há Tonfas ou Cassetetes extraviados sob responsabilidade do SVDD.
                    </span>
                  </div>
                </div>
              ) : (
                extraviosSvdd.map((item) => {
                  const tipo =
                    normalizarTexto(item?.tipo_material) === 'CASSETETE'
                      ? 'Cassetete'
                      : 'Tonfa'

                  const quantidade =
                    Math.max(
                      1,
                      Number(item?.quantidade || 1) || 1
                    )

                  const status =
                    String(
                      item?.status ||
                      'EM_APURACAO'
                    ).replaceAll('_', ' ')

                  const formatarDataExtravio = (valor) => {
                    if (!valor) return 'Não informada'
                    const data = new Date(valor)
                    return Number.isNaN(data.getTime())
                      ? 'Não informada'
                      : data.toLocaleString('pt-BR')
                  }

                  const documento =
                    [
                      item?.documento_tipo,
                      item?.documento_numero,
                      item?.documento_data
                    ]
                      .filter(Boolean)
                      .join(' • ') ||
                    'Não informado'

                  return (
                    <article
                      key={item.id}
                      className="tonfa-manutencao-p4-card"
                    >
                      <div className="tonfa-manutencao-p4-conteudo">
                        <div className="tonfa-manutencao-p4-topo">
                          <div>
                            <span className="tonfa-manutencao-p4-tipo">
                              {tipo}
                            </span>
                            <h3>{tipo} extraviado</h3>
                          </div>

                          <span className="tonfa-manutencao-p4-status">
                            {status}
                          </span>
                        </div>

                        <div className="tonfa-manutencao-p4-dados">
                          <div>
                            <span>Quantidade</span>
                            <strong>{quantidade}</strong>
                          </div>

                          <div>
                            <span>Policial</span>
                            <strong>
                              {item?.policial_nome || 'Não informado'}
                              {item?.policial_re
                                ? ` — RE ${item.policial_re}`
                                : ''}
                            </strong>
                          </div>

                          <div>
                            <span>Cautela / retirada</span>
                            <strong>
                              {formatarDataExtravio(item?.retirado_em)}
                            </strong>
                          </div>

                          <div>
                            <span>Constatado em</span>
                            <strong>
                              {formatarDataExtravio(
                                item?.extravio_constatado_em
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Responsabilidade</span>
                            <strong>
                              {item?.responsavel_setor || 'SVDD'}
                            </strong>
                          </div>

                          <div>
                            <span>Registrado por</span>
                            <strong>
                              {item?.registrado_por_nome ||
                                'Não informado'}
                            </strong>
                          </div>
                        </div>

                        <div className="tonfa-manutencao-p4-descricao">
                          <span>Descrição / circunstâncias</span>
                          <p>
                            {item?.descricao ||
                              'Sem descrição.'}
                          </p>
                        </div>

                        <div className="tonfa-manutencao-p4-descricao">
                          <span>Documento</span>
                          <p>{documento}</p>
                        </div>

                        {item?.observacoes && (
                          <div className="tonfa-manutencao-p4-descricao">
                            <span>Observações</span>
                            <p>{item.observacoes}</p>
                          </div>
                        )}

                        <div className="tonfa-manutencao-p4-acoes">
                          <button
                            type="button"
                            className="tonfa-manutencao-p4-enviar"
                            disabled={Boolean(
                              regularizandoExtravioId
                            )}
                            onClick={() =>
                              regularizarExtravioLocalizado(item)
                            }
                          >
                            {String(
                              regularizandoExtravioId || ''
                            ) === String(item?.id || '')
                              ? 'Regularizando...'
                              : 'Material localizado • retornar ao SVDD'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        </div>
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

<TonfaCautelasModal
  aberto={cautelasModalAberto}
  onClose={() =>
    setCautelasModalAberto(false)
  }
  onVerHistorico={() => {
    setCautelasModalAberto(false)
    setHistoricoAberto(true)
  }}
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