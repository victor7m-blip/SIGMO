import Diagnostico
  from './Diagnostico/Diagnostico'
import Auditoria
  from './Auditoria'
import SolicitacoesCadastro
  from './SolicitacoesCadastro/SolicitacoesCadastro'
import {
  useEffect,
  useMemo,
  useState
} from 'react'

import AppShell from '../components/AppShell/AppShell'
import brasaoPM from '../assets/unidade/brasao-pm-sp.jpg'

import useDashboard from '../hooks/useDashboard'
import useDashboardVitrine from '../hooks/useDashboardVitrine'
import {
  ehUsuario,
  obterRotaInicial,
  podeAcessarRota
} from '../services/permissionService'
import {
  listarCautelasAguardandoUsuario,
  listarDevolucoesPendentesUsuario,
  listarMateriaisEmServicoUsuario
} from '../services/cautelasUsuarioService'
import Locais from './Locais/Locais'
import Materiais from './Materiais/Materiais'
import Armas from './Armas/Armas'
import TPD from './TPD/TPD'
import Policiais from './Policiais'
import Taser from './Taser/Taser'
import Tonfas from './Tonfas/Tonfas'
import Municoes from './Municoes/Municoes'
import PagarMaterial from './PagarMaterial/PagarMaterial'
import ReceberMaterial from './ReceberMaterial/ReceberMaterial'
import CautelasUsuario from './CautelasUsuario/CautelasUsuario'
import TransferirMaterial from './TransferirMaterial/TransferirMaterial'
import BaixarMaterial from './BaixarMaterial/BaixarMaterial'
import CentralOperacional from './CentralOperacional'
import Manutencoes from './Manutencoes/Manutencoes'
import HT from './HT/HT'
import './DashboardV2.css'

const ROUTE_STORAGE_KEY =
  'sigmo_route_ativa'

const NOMES_MODULOS = {
  material: 'Materiais',
  materiais: 'Materiais',
  arma: 'Armas',
  armas: 'Armas',
  municao: 'Munições',
  municoes: 'Munições',
  policial: 'Policiais',
  policiais: 'Policiais',
  taser: 'Taser',
  tpd: 'TPD',
  colete: 'Coletes',
  coletes: 'Coletes',
  ht: 'HT',
  viatura: 'Viaturas',
  viaturas: 'Viaturas',
  epi: 'EPI',
  fardamento: 'Fardamento'
}

function numero(valor) {
  return new Intl.NumberFormat(
    'pt-BR'
  ).format(Number(valor) || 0)
}

function obterQuantidadeMaterial(item) {
  return Number(item?.quantidade || 1) || 1
}

function dataHora(valor) {
  if (!valor) {
    return 'Aguardando atualização'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(new Date(valor))
}

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.name ||
    user?.nome_completo ||
    user?.re ||
    'USUÁRIO'
  )
}

function obterIniciais(texto) {
  const partes = String(texto ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!partes.length) {
    return 'S'
  }

  if (partes.length === 1) {
    return partes[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return (
    partes[0][0] +
    partes[partes.length - 1][0]
  ).toUpperCase()
}

function nomeModulo(tipo) {
  const chave = String(tipo ?? '')
    .trim()
    .toLowerCase()

  return (
    NOMES_MODULOS[chave] ||
    chave.replace(/_/g, ' ') ||
    'Sem módulo'
  )
}

function tipoMovimentacao(tipo) {
  const nomes = {
    RECEBIMENTO: 'Recebimento',
    TRANSFERENCIA: 'Transferência',
    BAIXA: 'Baixa',
    CAUTELA: 'Cautela',
    DEVOLUCAO: 'Devolução',
    RECOLHIMENTO: 'Recolhimento',
    CADASTRO: 'Cadastro',
    EDICAO: 'Edição',
    FOTO_ADICIONADA: 'Foto',
    FOTO_REMOVIDA: 'Foto',
    QR_CODE_GERADO: 'QR Code',
    ETIQUETA_IMPRESSA: 'Etiqueta',
    EXCLUSAO: 'Exclusão'
  }

  return nomes[tipo] || tipo || 'Movimentação'
}

function classeTipo(tipo) {
  const classes = {
    RECEBIMENTO: 'recebimento',
    TRANSFERENCIA: 'transferencia',
    BAIXA: 'baixa',
    CAUTELA: 'cautela',
    DEVOLUCAO: 'devolucao',
    CADASTRO: 'cadastro'
  }

  return classes[tipo] || 'padrao'
}

function carregarRotaInicial() {
  try {
    return (
      sessionStorage.getItem(
        ROUTE_STORAGE_KEY
      ) || 'dashboard'
    )
  } catch {
    return 'dashboard'
  }
}

function salvarRota(rota) {
  try {
    sessionStorage.setItem(
      ROUTE_STORAGE_KEY,
      rota
    )
  } catch {
    // Mantém a navegação funcionando
    // mesmo se o storage estiver indisponível.
  }
}

function CardResumo({
  titulo,
  valor,
  detalhe,
  sigla,
  tone = 'blue'
}) {
  return (
    <article
      className={`sigmo-summary-card sigmo-summary-${tone}`}
    >
      <div className="sigmo-summary-head">
        <span className="sigmo-summary-icon">
          {sigla}
        </span>

        <strong>{titulo}</strong>
      </div>

      <div className="sigmo-summary-value">
        {numero(valor)}
      </div>

      <p>{detalhe}</p>
    </article>
  )
}

function EstadoPainel({
  children,
  tipo = 'normal'
}) {
  return (
    <div
      className={`sigmo-dashboard-state sigmo-dashboard-state-${tipo}`}
    >
      {children}
    </div>
  )
}


function pct(valor, total) {
  if (!Number(total)) return 0
  return Math.max(
    0,
    Math.min(
      100,
      (Number(valor || 0) /
        Number(total)) *
        100
    )
  )
}

function DashboardIcon({
  children,
  tone = 'blue'
}) {
  return (
    <span
      className={`sigmo-command-icon sigmo-command-icon-${tone}`}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function KpiStrip({
  icon,
  tone,
  label,
  value,
  detail
}) {
  return (
    <article className="sigmo-command-kpi">
      <DashboardIcon tone={tone}>
        {icon}
      </DashboardIcon>

      <div>
        <span>{label}</span>
        <strong>{numero(value)}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function ArmaMiniCard({
  label,
  value,
  tone = 'blue',
  icon = '•'
}) {
  return (
    <div className="sigmo-command-arma-mini">
      <DashboardIcon tone={tone}>
        {icon}
      </DashboardIcon>

      <div>
        <span>{label}</span>
        <strong>{numero(value)}</strong>
      </div>
    </div>
  )
}

function LegendaLinha({
  label,
  value,
  total,
  tone
}) {
  const percentual = pct(value, total)

  return (
    <div className="sigmo-command-legend-row">
      <span
        className={`sigmo-command-dot sigmo-command-dot-${tone}`}
      />
      <span>{label}</span>
      <b>{numero(value)}</b>
      <small>
        {percentual.toLocaleString(
          'pt-BR',
          {
            maximumFractionDigits: 1
          }
        )}%
      </small>
    </div>
  )
}

function Donut({
  total,
  values,
  label = 'TOTAL'
}) {
  const segmentos = values.map(
    (item) => ({
      ...item,
      percentual: pct(
        item.value,
        total
      )
    })
  )

  let acumulado = 0

  const stops = segmentos.map(
    (item) => {
      const inicio = acumulado
      acumulado +=
        item.percentual

      return `var(--dash-${item.tone}) ${inicio}% ${acumulado}%`
    }
  )

  if (acumulado < 100) {
    stops.push(
      `#143052 ${acumulado}% 100%`
    )
  }

  return (
    <div
      className="sigmo-command-donut"
      style={{
        background:
          `conic-gradient(${stops.join(
            ', '
          )})`
      }}
    >
      <div>
        <strong>
          {numero(total)}
        </strong>
        <small>{label}</small>
      </div>
    </div>
  )
}

function BarraHorizontal({
  label,
  value,
  total,
  tone = 'blue'
}) {
  return (
    <div className="sigmo-command-bar-row">
      <span>{label}</span>

      <div className="sigmo-command-bar-track">
        <i
          className={`sigmo-command-bar-fill sigmo-command-bar-fill-${tone}`}
          style={{
            width: `${pct(
              value,
              total
            )}%`
          }}
        />
      </div>

      <b>{numero(value)}</b>
    </div>
  )
}

function MovimentoLinha({
  item
}) {
  return (
    <div className="sigmo-command-movement">
      <DashboardIcon
        tone={
          classeTipo(item.tipo) ===
          'baixa'
            ? 'red'
            : classeTipo(item.tipo) ===
              'cautela'
            ? 'yellow'
            : classeTipo(item.tipo) ===
              'transferencia'
            ? 'blue'
            : 'green'
        }
      >
        {obterIniciais(
          tipoMovimentacao(item.tipo)
        )}
      </DashboardIcon>

      <div className="sigmo-command-movement-copy">
        <strong>
          {item.titulo ||
            tipoMovimentacao(
              item.tipo
            )}
        </strong>
        <span>
          {item.autor
            ? `${item.autor} · `
            : ''}
          {item.data_formatada ||
            dataHora(
              item.created_at
            )}
        </span>
      </div>

      <em
        className={`sigmo-command-badge sigmo-command-badge-${classeTipo(
          item.tipo
        )}`}
      >
        {tipoMovimentacao(
          item.tipo
        )}
      </em>
    </div>
  )
}

function classeGravidade(gravidade) {
  const valor = String(gravidade || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()

  if (
    valor.includes('CRIT') ||
    valor.includes('ALTA') ||
    valor.includes('URGENT')
  ) {
    return 'red'
  }

  if (
    valor.includes('MEDIA') ||
    valor.includes('MODERAD')
  ) {
    return 'yellow'
  }

  if (valor.includes('BAIXA')) {
    return 'blue'
  }

  return 'purple'
}

function NovidadeLinha({ item, onClick }) {
  const tipo =
    item?.tipo_patrimonio ||
    item?.tipo ||
    'Patrimônio'

  const titulo =
    item?.titulo ||
    'Novidade patrimonial'

  const descricao =
    item?.descricao ||
    item?.providencia ||
    item?.observacao ||
    ''

  const gravidade =
    item?.gravidade ||
    item?.prioridade ||
    ''

  const status =
    item?.status ||
    'Registrada'

  const autor =
    item?.registrado_por_nome ||
    item?.autor_nome ||
    item?.registrado_por ||
    ''

  const tone =
    classeGravidade(gravidade)

  return (
    <div
      className="sigmo-command-movement"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
      style={{ cursor: 'pointer' }}
      title="Clique para ver os detalhes"
    >
      <DashboardIcon tone={tone}>
        {obterIniciais(tipo)}
      </DashboardIcon>

      <div className="sigmo-command-movement-copy">
        <strong>
          {tipo} · {titulo}
        </strong>

        {descricao && (
          <span>{descricao}</span>
        )}

        <span>
          {autor
            ? `${autor} · `
            : ''}
          {dataHora(item?.created_at)}
        </span>
      </div>

      <em
        className={`sigmo-command-badge sigmo-command-badge-${
          tone === 'red'
            ? 'baixa'
            : tone === 'yellow'
            ? 'cautela'
            : tone === 'blue'
            ? 'transferencia'
            : 'padrao'
        }`}
      >
        {gravidade || status}
      </em>
    </div>
  )
}

function PainelDashboard({
  user,
  dashboard,
  onNavegar
}) {
  const {
    cards,
    movimentacoes,
    timeline,
    novidades,
    atualizadoEm,
    loading,
    erro,
    atualizar
  } = dashboard

  const vitrine =
    useDashboardVitrine(user)

  const [agora, setAgora] =
    useState(() => new Date())

  const [
    novidadeSelecionada,
    setNovidadeSelecionada
  ] = useState(null)

  useEffect(() => {
    const timer = window.setInterval(
      () => setAgora(new Date()),
      30000
    )

    return () =>
      window.clearInterval(timer)
  }, [])

  const nomeUsuario =
    obterNomeUsuario(user)

  const totalIntegrado =
    Number(
      vitrine.armas.total || 0
    ) +
    Number(
      vitrine.tonfas.total || 0
    )

  const p4Integrado =
    Number(vitrine.armas.p4 || 0) +
    Number(vitrine.tonfas.p4 || 0)

  const svddIntegrado =
    Number(vitrine.armas.svdd || 0) +
    Number(vitrine.tonfas.svdd || 0)

  const emUsoIntegrado =
  Number(
    vitrine.armas.cautelas || 0
  ) +
  Number(
    vitrine.tonfas.emServico || 0
  )

  const manutencaoIntegrada =
    Number(
      vitrine.armas.manutencao ||
        0
    ) +
    Number(
      vitrine.tonfas.manutencao ||
        0
    )

  const armasGrafico = [
    {
      label: 'P4',
      value: vitrine.armas.p4,
      tone: 'blue'
    },
    {
      label: 'SVDD',
      value: vitrine.armas.svdd,
      tone: 'purple'
    },
    {
      label: 'Carga permanente',
      value: vitrine.armas.carga,
      tone: 'green'
    },
    {
      label: 'Cautelas ativas',
      value: vitrine.armas.cautelas,
      tone: 'yellow'
    },
    {
      label: 'Particulares',
      value:
        vitrine.armas.particulares,
      tone: 'cyan'
    },
    {
      label: 'Manutenção',
      value:
        vitrine.armas.manutencao,
      tone: 'orange'
    },
    {
      label: 'Não localizadas',
      value:
        vitrine.armas.naoLocalizadas,
      tone: 'red'
    }
  ]

  const tonfaGrafico = [
    {
      label: 'P4',
      value:
        vitrine.tonfasDetalhe?.p4 ||
        0,
      tone: 'blue'
    },
    {
      label: 'SVDD',
      value:
        vitrine.tonfasDetalhe
          ?.svdd || 0,
      tone: 'purple'
    },
    {
      label: 'Em serviço',
      value:
        vitrine.tonfasDetalhe
          ?.emServico || 0,
      tone: 'yellow'
    },
    {
      label: 'Manutenção',
      value:
        vitrine.tonfasDetalhe
          ?.manutencao || 0,
      tone: 'red'
    }
  ]

  const casseteteGrafico = [
    {
      label: 'P4',
      value:
        vitrine.cassetetesDetalhe
          ?.p4 || 0,
      tone: 'blue'
    },
    {
      label: 'SVDD',
      value:
        vitrine.cassetetesDetalhe
          ?.svdd || 0,
      tone: 'purple'
    },
    {
      label: 'Em serviço',
      value:
        vitrine.cassetetesDetalhe
          ?.emServico || 0,
      tone: 'yellow'
    },
    {
      label: 'Manutenção',
      value:
        vitrine.cassetetesDetalhe
          ?.manutencao || 0,
      tone: 'red'
    }
  ]

  if (
    loading &&
    !atualizadoEm
  ) {
    return (
      <main className="sigmo-command-dashboard">
        <div className="sigmo-command-loading">
          Carregando painel operacional...
        </div>
      </main>
    )
  }

  return (
    <main className="sigmo-command-dashboard">
      <header className="sigmo-command-header">
        <div>
          <h1>
            Bem-vindo ao SIGMO
          </h1>
          <p>
            Sistema Integrado de Gestão
            de Materiais e Operações
          </p>
        </div>

        <div className="sigmo-command-header-meta">
          <div className="sigmo-command-live">
            <span className="sigmo-command-live-dot" />
            <div>
              <strong>
                Sistema operacional
              </strong>
              <small>
                Todos os serviços ativos
              </small>
            </div>
          </div>

          <div className="sigmo-command-clock">
            <DashboardIcon tone="blue">
              ▣
            </DashboardIcon>

            <div>
              <strong>
                {new Intl.DateTimeFormat(
                  'pt-BR'
                ).format(agora)}
              </strong>
              <small>
                {new Intl.DateTimeFormat(
                  'pt-BR',
                  {
                    weekday:
                      'long'
                  }
                ).format(agora)}
              </small>
            </div>

            <b>
              {new Intl.DateTimeFormat(
                'pt-BR',
                {
                  hour: '2-digit',
                  minute:
                    '2-digit'
                }
              ).format(agora)}
            </b>
          </div>

          <div className="sigmo-command-unit">
            <img
              src={brasaoPM}
              alt="Polícia Militar do Estado de São Paulo"
            />
          </div>
        </div>
      </header>

      {(erro || vitrine.erro) && (
        <div className="sigmo-command-error">
          {erro || vitrine.erro}
        </div>
      )}

      <section className="sigmo-command-kpi-strip">
        <KpiStrip
          icon="◇"
          tone="blue"
          label="Patrimônio integrado"
          value={totalIntegrado}
          detail="itens sob gestão"
        />
        <KpiStrip
          icon="▣"
          tone="cyan"
          label="Depósito P4"
          value={p4Integrado}
          detail="itens disponíveis"
        />
        <KpiStrip
          icon="▦"
          tone="purple"
          label="Cofre SVDD"
          value={svddIntegrado}
          detail="itens no cofre"
        />
        <KpiStrip
          icon="●"
          tone="yellow"
          label="Em serviço"
          value={emUsoIntegrado}
          detail="itens em uso"
        />
        <KpiStrip
          icon="◆"
          tone="red"
          label="Em manutenção"
          value={manutencaoIntegrada}
          detail="itens em manutenção"
        />
      </section>

      <section className="sigmo-command-main-grid">
        <article className="sigmo-command-panel sigmo-command-arms">
          <div className="sigmo-command-panel-title">
            <div className="sigmo-command-title-icon">
              ▰
            </div>

            <div>
              <span>ARMAS</span>
              <small>Total de armas</small>
              <strong>
                {numero(
                  vitrine.armas.total
                )}
              </strong>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavegar('armas')
              }
            >
              Abrir módulo
            </button>
          </div>

          <div className="sigmo-command-arm-summary">
            <ArmaMiniCard
              label="P4"
              value={vitrine.armas.p4}
              tone="blue"
              icon="⌂"
            />
            <ArmaMiniCard
              label="SVDD"
              value={vitrine.armas.svdd}
              tone="purple"
              icon="▦"
            />
            <ArmaMiniCard
              label="Carga permanente"
              value={vitrine.armas.carga}
              tone="green"
              icon="♟"
            />
            <ArmaMiniCard
              label="Cautelas ativas"
              value={
                vitrine.armas.cautelas
              }
              tone="yellow"
              icon="●"
            />
            <ArmaMiniCard
              label="Particulares"
              value={
                vitrine.armas
                  .particulares
              }
              tone="cyan"
              icon="◇"
            />
            <ArmaMiniCard
              label="Manutenção"
              value={
                vitrine.armas
                  .manutencao
              }
              tone="orange"
              icon="◆"
            />
            <ArmaMiniCard
              label="Não localizadas"
              value={
                vitrine.armas
                  .naoLocalizadas
              }
              tone="red"
              icon="●"
            />
          </div>

          <div className="sigmo-command-arms-charts">
            <div>
              <h3>
                Distribuição das armas
              </h3>

              <div className="sigmo-command-donut-block">
                <Donut
                  total={
                    vitrine.armas.total
                  }
                  values={armasGrafico}
                />

                <div className="sigmo-command-legend">
                  {armasGrafico.map(
                    (item) => (
                      <LegendaLinha
                        key={
                          item.label
                        }
                        label={
                          item.label
                        }
                        value={
                          item.value
                        }
                        total={
                          vitrine.armas
                            .total
                        }
                        tone={
                          item.tone
                        }
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3>
                Armas por local
              </h3>

              <div className="sigmo-command-bars">
                <BarraHorizontal
                  label="P4"
                  value={vitrine.armas.p4}
                  total={vitrine.armas.total}
                  tone="blue"
                />
                <BarraHorizontal
                  label="SVDD"
                  value={vitrine.armas.svdd}
                  total={vitrine.armas.total}
                  tone="purple"
                />
                <BarraHorizontal
                  label="Carga permanente"
                  value={vitrine.armas.carga}
                  total={vitrine.armas.total}
                  tone="green"
                />
                <BarraHorizontal
                  label="Cautelas ativas"
                  value={vitrine.armas.cautelas}
                  total={vitrine.armas.total}
                  tone="yellow"
                />
                <BarraHorizontal
                  label="Particulares"
                  value={vitrine.armas.particulares}
                  total={vitrine.armas.total}
                  tone="cyan"
                />
                <BarraHorizontal
                  label="Manutenção"
                  value={vitrine.armas.manutencao}
                  total={vitrine.armas.total}
                  tone="orange"
                />
                <BarraHorizontal
                  label="Não localizadas"
                  value={vitrine.armas.naoLocalizadas}
                  total={vitrine.armas.total}
                  tone="red"
                />
              </div>
            </div>
          </div>
        </article>

        <article className="sigmo-command-panel sigmo-command-tonfas">
          <div className="sigmo-command-panel-title">
            <div className="sigmo-command-title-icon sigmo-command-title-icon-purple">
              ╱
            </div>

            <div>
              <span>
                TONFAS / CASSETETES
              </span>
              <small>
                Controle operacional
              </small>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavegar('tonfas')
              }
            >
              Abrir módulo
            </button>
          </div>

          <div className="sigmo-command-tonfa-totals">
            <div>
              <span>TONFAS</span>
              <strong>
                {numero(
                  vitrine.tonfas.tonfas
                )}
              </strong>

              <div className="sigmo-command-four-values">
                <small>
                  P4
                  <b>
                    {numero(
                      vitrine
                        .tonfasDetalhe
                        ?.p4
                    )}
                  </b>
                </small>
                <small>
                  SVDD
                  <b>
                    {numero(
                      vitrine
                        .tonfasDetalhe
                        ?.svdd
                    )}
                  </b>
                </small>
                <small>
                  Em serviço
                  <b>
                    {numero(
                      vitrine
                        .tonfasDetalhe
                        ?.emServico
                    )}
                  </b>
                </small>
                <small>
                  Manutenção
                  <b>
                    {numero(
                      vitrine
                        .tonfasDetalhe
                        ?.manutencao
                    )}
                  </b>
                </small>
              </div>
            </div>

            <div>
              <span>CASSETETES</span>
              <strong>
                {numero(
                  vitrine.tonfas
                    .cassetetes
                )}
              </strong>

              <div className="sigmo-command-four-values">
                <small>
                  P4
                  <b>
                    {numero(
                      vitrine
                        .cassetetesDetalhe
                        ?.p4
                    )}
                  </b>
                </small>
                <small>
                  SVDD
                  <b>
                    {numero(
                      vitrine
                        .cassetetesDetalhe
                        ?.svdd
                    )}
                  </b>
                </small>
                <small>
                  Em serviço
                  <b>
                    {numero(
                      vitrine
                        .cassetetesDetalhe
                        ?.emServico
                    )}
                  </b>
                </small>
                <small>
                  Manutenção
                  <b>
                    {numero(
                      vitrine
                        .cassetetesDetalhe
                        ?.manutencao
                    )}
                  </b>
                </small>
              </div>
            </div>
          </div>

          <div className="sigmo-command-tonfa-charts">
            <div>
              <h3>
                Distribuição Tonfas
              </h3>

              <div className="sigmo-command-small-donut">
                <Donut
                  total={
                    vitrine.tonfas
                      .tonfas
                  }
                  values={
                    tonfaGrafico
                  }
                />

                <div className="sigmo-command-legend">
                  {tonfaGrafico.map(
                    (item) => (
                      <LegendaLinha
                        key={
                          item.label
                        }
                        label={
                          item.label
                        }
                        value={
                          item.value
                        }
                        total={
                          vitrine.tonfas
                            .tonfas
                        }
                        tone={
                          item.tone
                        }
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3>
                Distribuição Cassetetes
              </h3>

              <div className="sigmo-command-small-donut">
                <Donut
                  total={
                    vitrine.tonfas
                      .cassetetes
                  }
                  values={
                    casseteteGrafico
                  }
                />

                <div className="sigmo-command-legend">
                  {casseteteGrafico.map(
                    (item) => (
                      <LegendaLinha
                        key={
                          item.label
                        }
                        label={
                          item.label
                        }
                        value={
                          item.value
                        }
                        total={
                          vitrine.tonfas
                            .cassetetes
                        }
                        tone={
                          item.tone
                        }
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="sigmo-command-bottom-grid">
        <article className="sigmo-command-panel">
          <div className="sigmo-command-section-title">
            <h2>
              Novidades patrimoniais
            </h2>

            <button
              type="button"
              onClick={() =>
                onNavegar(
                  'central-operacional'
                )
              }
            >
              Ver todas
            </button>
          </div>

          <div className="sigmo-command-movements sigmo-command-scroll">
            {novidades?.length ? (
              novidades
                .slice(0, 5)
                .map(
                  (
                    item,
                    index
                  ) => (
                    <NovidadeLinha
                      key={
                        item.id ||
                        index
                      }
                      item={item}
                      onClick={() =>
                        setNovidadeSelecionada(
                          item
                        )
                      }
                    />
                  )
                )
            ) : (
              <div className="sigmo-command-empty">
                Nenhuma novidade
                patrimonial recente.
              </div>
            )}
          </div>
        </article>

        <article className="sigmo-command-panel">
          <div className="sigmo-command-section-title">
            <h2>
              Últimas movimentações
            </h2>

            <button
              type="button"
              onClick={() =>
                onNavegar(
                  'central-operacional'
                )
              }
            >
              Ver todas
            </button>
          </div>

          <div className="sigmo-command-movements sigmo-command-scroll">
            {timeline.length ? (
              timeline
                .slice(0, 5)
                .map(
                  (
                    item,
                    index
                  ) => (
                    <MovimentoLinha
                      key={
                        item.id ||
                        index
                      }
                      item={item}
                    />
                  )
                )
            ) : (
              <div className="sigmo-command-empty">
                Nenhuma movimentação
                recente.
              </div>
            )}
          </div>
        </article>

        <article className="sigmo-command-panel">
          <div className="sigmo-command-section-title">
            <h2>
              Alertas importantes
            </h2>

            <button
              type="button"
              onClick={() =>
                onNavegar('alertas')
              }
            >
              Ver todos
            </button>
          </div>

          <div className="sigmo-command-alert-list">
            <div>
              <DashboardIcon tone="red">
                !
              </DashboardIcon>
              <span>
                <strong>
                  {numero(
                    manutencaoIntegrada
                  )}{' '}
                  itens em manutenção
                </strong>
                <small>
                  Acompanhe o retorno ao
                  serviço
                </small>
              </span>
            </div>

            <div>
              <DashboardIcon tone="yellow">
                ◷
              </DashboardIcon>
              <span>
                <strong>
                  {numero(
                    vitrine.armas
                      .cautelas
                  )}{' '}
                  cautelas de armas
                </strong>
                <small>
                  Controle operacional
                  ativo
                </small>
              </span>
            </div>

            <div>
              <DashboardIcon tone="blue">
                ↔
              </DashboardIcon>
              <span>
                <strong>
                  {numero(
                    cards
                      .movimentacoesHoje
                  )}{' '}
                  movimentações hoje
                </strong>
                <small>
                  Atividade patrimonial
                  registrada
                </small>
              </span>
            </div>

            <div>
              <DashboardIcon tone="purple">
                ▦
              </DashboardIcon>
              <span>
                <strong>
                  {numero(
                    movimentacoes
                      .transferencias
                  )}{' '}
                  transferências
                </strong>
                <small>
                  Fluxos contabilizados
                  no período
                </small>
              </span>
            </div>
          </div>
        </article>

        <article className="sigmo-command-panel">
          <div className="sigmo-command-section-title">
            <h2>
              Atalhos operacionais
            </h2>
          </div>

          <div className="sigmo-command-shortcuts">
            <button
              type="button"
              onClick={() =>
                onNavegar(
                  'pagar-material'
                )
              }
            >
              <DashboardIcon tone="green">
                ↓
              </DashboardIcon>
              <span>
                Pagar Material
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar(
                  'receber-material'
                )
              }
            >
              <DashboardIcon tone="purple">
                ↑
              </DashboardIcon>
              <span>
                Receber Material
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar(
                  'transferir-material'
                )
              }
            >
              <DashboardIcon tone="blue">
                ↔
              </DashboardIcon>
              <span>
                Transferir Material
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar(
                  'central-operacional'
                )
              }
            >
              <DashboardIcon tone="yellow">
                ◉
              </DashboardIcon>
              <span>
                Central Operacional
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar('armas')
              }
            >
              <DashboardIcon tone="blue">
                ▰
              </DashboardIcon>
              <span>Armas</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar('tonfas')
              }
            >
              <DashboardIcon tone="purple">
                ╱
              </DashboardIcon>
              <span>
                Tonfas/Cassetetes
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar('locais')
              }
            >
              <DashboardIcon tone="cyan">
                ●
              </DashboardIcon>
              <span>Locais</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavegar('relatorios')
              }
            >
              <DashboardIcon tone="green">
                ▤
              </DashboardIcon>
              <span>Relatórios</span>
            </button>
          </div>
        </article>
      </section>

      {novidadeSelecionada && (
        <div
          role="presentation"
          onClick={() =>
            setNovidadeSelecionada(null)
          }
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: 'rgba(3, 15, 32, .72)'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da novidade patrimonial"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: 'min(620px, 100%)',
              border: '1px solid rgba(77, 163, 255, .35)',
              borderRadius: 22,
              padding: 26,
              color: '#fff',
              background: 'linear-gradient(135deg, #071d39 0%, #0b315a 100%)',
              boxShadow: '0 28px 70px rgba(0,0,0,.4)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16
            }}>
              <div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '.12em',
                  opacity: .75
                }}>
                  NOVIDADE PATRIMONIAL
                </span>
                <h2 style={{ margin: '8px 0 0' }}>
                  {novidadeSelecionada.tipo_patrimonio || 'Patrimônio'} · {novidadeSelecionada.titulo || 'Novidade'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNovidadeSelecionada(null)
                }
                style={{
                  border: '1px solid rgba(255,255,255,.25)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  color: '#fff',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>

            <div style={{
              display: 'grid',
              gap: 14,
              marginTop: 22
            }}>
              <div>
                <small style={{ opacity: .65 }}>Descrição</small>
                <div style={{ marginTop: 4, lineHeight: 1.5 }}>
                  {novidadeSelecionada.descricao || 'Sem descrição.'}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 12
              }}>
                <div>
                  <small style={{ opacity: .65 }}>Gravidade</small>
                  <div>{novidadeSelecionada.gravidade || 'Não informada'}</div>
                </div>
                <div>
                  <small style={{ opacity: .65 }}>Status</small>
                  <div>{novidadeSelecionada.status || 'Registrada'}</div>
                </div>
                <div>
                  <small style={{ opacity: .65 }}>Registrado por</small>
                  <div>{novidadeSelecionada.registrado_por_nome || 'Não informado'}</div>
                </div>
                <div>
                  <small style={{ opacity: .65 }}>Data / hora</small>
                  <div>{dataHora(novidadeSelecionada.created_at)}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="sigmo-command-roadmap">
        <div className="sigmo-command-section-title">
          <h2>
            Módulos em desenvolvimento /
            integrações futuras
          </h2>
        </div>

        <div className="sigmo-command-roadmap-grid">
          {[
            ['▥', 'HT'],
            ['▦', 'TPD'],
            ['ϟ', 'Tasers'],
            ['▰', 'Munições'],
            ['◇', 'Coletes'],
            ['▱', 'Viaturas']
          ].map(
            ([icon, label]) => (
              <div key={label}>
                <DashboardIcon tone="muted">
                  {icon}
                </DashboardIcon>

                <span>
                  <strong>{label}</strong>
                  <small>Em breve</small>
                </span>
              </div>
            )
          )}
        </div>
      </section>

      <footer className="sigmo-command-footer">
        <span>
          Administrador: {nomeUsuario}
        </span>

        <span>
          Última atualização:{' '}
          {dataHora(atualizadoEm)}
        </span>

        <button
          type="button"
          onClick={() => {
            atualizar()
            vitrine.atualizar()
          }}
          disabled={
            loading ||
            vitrine.loading
          }
        >
          {loading ||
          vitrine.loading
            ? 'Atualizando...'
            : '↻ Atualizar agora'}
        </button>
      </footer>
    </main>
  )
}


function PainelUsuario({ user, onNavegar }) {
  const [dados, setDados] = useState({
    aguardando: [],
    materiais: [],
    devolucoes: []
  })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [materialSelecionado, setMaterialSelecionado] = useState(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setLoading(true)
        setErro('')
        const [aguardando, materiais, devolucoes] = await Promise.all([
          listarCautelasAguardandoUsuario(user),
          listarMateriaisEmServicoUsuario(user),
          listarDevolucoesPendentesUsuario(user)
        ])

        if (ativo) {
          setDados({
            aguardando: aguardando || [],
            materiais: materiais || [],
            devolucoes: devolucoes || []
          })
        }
      } catch (error) {
        if (ativo) {
          setErro(error?.message || 'Não foi possível carregar seu painel.')
        }
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregar()
    return () => { ativo = false }
  }, [user])

  const totalMateriais = dados.materiais.reduce(
  (total, item) =>
    total + obterQuantidadeMaterial(item),
  0
)

  return (
    <main className="sigmo-command-dashboard">
      <header className="sigmo-command-header">
        <div>
          <h1>Painel Operacional</h1>
          <p>Suas cautelas, cargas e movimentações patrimoniais.</p>
        </div>
      </header>

      {erro && <div className="sigmo-command-error">{erro}</div>}

      <section className="sigmo-command-kpi-strip">
        <KpiStrip
          icon="⬆"
          tone="blue"
          label="Aguardando recebimento"
          value={dados.aguardando.length}
          detail="carrinhos pendentes"
        />
        <KpiStrip
          icon="▰"
          tone="yellow"
          label="Cautelas ativas"
          value={totalMateriais}
          detail="materiais sob sua responsabilidade"
        />
        <KpiStrip
          icon="↩"
          tone="purple"
          label="Devoluções pendentes"
          value={dados.devolucoes.length}
          detail="aguardando aceite do SVDD"
        />
      </section>

      <section className="sigmo-command-bottom-grid">
        <article className="sigmo-command-panel">
          <div className="sigmo-command-section-title">
            <h2>Minhas operações</h2>
          </div>
          <div className="sigmo-command-shortcuts">
            <button type="button" onClick={() => onNavegar('receber-material')}>
              <DashboardIcon tone="blue">⬆</DashboardIcon>
              <span>Receber Material</span>
            </button>
            <button type="button" onClick={() => onNavegar('devolver-material')}>
              <DashboardIcon tone="purple">↩</DashboardIcon>
              <span>Devolver Materiais</span>
            </button>
            <button type="button" onClick={() => onNavegar('policiais')}>
              <DashboardIcon tone="cyan">●</DashboardIcon>
              <span>Cadastro</span>
            </button>
          </div>
        </article>

        <article className="sigmo-command-panel">
          <div className="sigmo-command-section-title">
            <h2>Materiais sob sua responsabilidade</h2>
          </div>
          {loading ? (
            <div className="sigmo-command-empty">Carregando...</div>
          ) : dados.materiais.length === 0 ? (
            <div className="sigmo-command-empty">
              Nenhum material cautelado no momento.
            </div>
          ) : (
            <div className="sigmo-command-movements">
              {dados.materiais.map((item, index) => {
                const identificacao =
                  item.numero_patrimonio ||
                  item.patrimonio ||
                  item.numero_serie ||
                  item.modelo ||
                  ''

                return (
                  <button
                    type="button"
                    className="sigmo-command-movement"
                    key={item.id || index}
                    onClick={() => setMaterialSelecionado(item)}
                    style={{
                      width: '100%',
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <DashboardIcon tone="yellow">▰</DashboardIcon>
                    <div className="sigmo-command-movement-copy">
                      <strong>
                        {item.descricao || item.tipo || 'Material'}

                        {String(item?.tipo || '')
                          .trim()
                          .toLowerCase() === 'tonfa'
                          ? ` — Qtd. ${obterQuantidadeMaterial(item)}`
                          : ''}
                      </strong>

                      {identificacao && (
                        <span>{identificacao}</span>
                      )}
                    </div>
                    <em className="sigmo-command-badge sigmo-command-badge-cautela">
                      Cautela ativa
                    </em>
                  </button>
                )
              })}
            </div>
          )}
        </article>
      </section>

      {materialSelecionado && (
        <div
          onClick={() => setMaterialSelecionado(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: 'rgba(3, 15, 32, .72)'
          }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(620px, 100%)',
              border: '1px solid #2a6fb3',
              borderRadius: 22,
              padding: 26,
              color: '#fff',
              background: 'linear-gradient(135deg, #071d39 0%, #0b3f73 100%)',
              boxShadow: '0 28px 70px rgba(0,0,0,.35)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'flex-start'
            }}>
              <div>
                <span style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '.12em',
                  opacity: .78
                }}>
                  MATERIAL SOB RESPONSABILIDADE
                </span>
                <h2 style={{ margin: '8px 0 0' }}>
                  {materialSelecionado.descricao ||
                    materialSelecionado.tipo ||
                    'Material'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMaterialSelecionado(null)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.35)',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 18,
              marginTop: 24
            }}>
              <div>
                <small style={{ opacity: .72 }}>Tipo</small>
                <strong style={{ display: 'block', marginTop: 4 }}>
                  {materialSelecionado.tipo || 'Material'}
                </strong>
              </div>

              <div>
                <small style={{ opacity: .72 }}>Situação</small>
                <strong style={{ display: 'block', marginTop: 4 }}>
                  Cautela ativa
                </strong>
              </div>

              <div>
                <small style={{ opacity: .72 }}>Patrimônio / identificação</small>
                <strong style={{ display: 'block', marginTop: 4 }}>
                  {materialSelecionado.numero_patrimonio ||
                    materialSelecionado.patrimonio ||
                    materialSelecionado.numero_serie ||
                    'Não informado'}
                </strong>
              </div>

              <div>
                <small style={{ opacity: .72 }}>Quantidade</small>
                <strong style={{ display: 'block', marginTop: 4 }}>
                  {obterQuantidadeMaterial(materialSelecionado)}
                </strong>
              </div>

              {(materialSelecionado.modelo || materialSelecionado.descricao) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <small style={{ opacity: .72 }}>Descrição / modelo</small>
                  <strong style={{ display: 'block', marginTop: 4 }}>
                    {materialSelecionado.modelo ||
                      materialSelecionado.descricao}
                  </strong>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default function DashboardV2({
  user,
  onLogout
}) {
  const [
  route,
  setRouteState
] = useState(() => {
  const rota =
    carregarRotaInicial()

  if (
    podeAcessarRota(
      user,
      rota
    )
  ) {
    return rota
  }

  return obterRotaInicial(user)
})

  const [policialAbrirRe, setPolicialAbrirRe] = useState('')
  const [avisoRecebimento, setAvisoRecebimento] = useState(0)
  const [avisoVerificado, setAvisoVerificado] = useState(false)

  const dashboard = useDashboard()

  useEffect(() => {
    if (!ehUsuario(user) || avisoVerificado) return

    let ativo = true
    listarCautelasAguardandoUsuario(user)
      .then((lista) => {
        if (ativo && Array.isArray(lista) && lista.length > 0) {
          setAvisoRecebimento(lista.length)
        }
      })
      .catch((error) => {
        console.warn('Não foi possível verificar materiais pendentes:', error)
      })
      .finally(() => {
        if (ativo) setAvisoVerificado(true)
      })

    return () => { ativo = false }
  }, [user, avisoVerificado])

  function setRoute(novaRota) {
  const rotaSolicitada =
    novaRota ||
    obterRotaInicial(user)

  const rotaPermitida =
    podeAcessarRota(
      user,
      rotaSolicitada
    )
      ? rotaSolicitada
      : obterRotaInicial(user)

  salvarRota(
    rotaPermitida
  )

  setRouteState(
    rotaPermitida
  )
}
useEffect(() => {
  if (
    !podeAcessarRota(
      user,
      route
    )
  ) {
    const rota =
      obterRotaInicial(user)

    salvarRota(rota)

    setRouteState(rota)
  }
}, [
  user,
  route
])
  function voltarDashboard() {
  const rotaInicial =
    obterRotaInicial(user)

  setRoute(
    rotaInicial
  )

  if (
    podeAcessarRota(
      user,
      'dashboard'
    )
  ) {
    dashboard.atualizar()
  }
}

  function abrirCadastroPolicial(re) {
  const valorRe = String(re || '').trim()

  if (!valorRe) return

  setPolicialAbrirRe(valorRe)

  salvarRota('policiais')
  setRouteState('policiais')
}

  function renderPage() {
    if (route === 'dashboard') {
      if (ehUsuario(user)) {
        return (
          <PainelUsuario
            user={user}
            onNavegar={setRoute}
          />
        )
      }

      return (
        <PainelDashboard
          user={user}
          dashboard={dashboard}
          onNavegar={setRoute}
        />
      )
    }

    if (route === 'central-operacional') {
      return (
        <CentralOperacional
          user={user}
          onVoltar={voltarDashboard}
        />
      )
    }

    if (route === 'manutencoes') {
      return (
        <Manutencoes
          user={user}
          onVoltar={voltarDashboard}
        />
      )
    }

    if (route === 'pagar-material') {
      return (
        <PagarMaterial
          user={user}
          onVoltar={voltarDashboard}
          onConcluido={voltarDashboard}
        />
      )
    }

   if (route === 'receber-material') {
  if (ehUsuario(user)) {
    return (
      <CautelasUsuario
        user={user}
        modo="receber"
        onConcluido={() => {
          setAvisoRecebimento(0)
          dashboard.atualizar()
        }}
      />
    )
  }

  return (
    <ReceberMaterial
      user={user}
      onVoltar={voltarDashboard}
      onConcluido={() => {
        dashboard.atualizar()
      }}
    />
  )
}

    if (route === 'devolver-material') {
      return (
        <CautelasUsuario
          user={user}
          modo="devolver"
          onConcluido={() => {
            dashboard.atualizar()
          }}
        />
      )
    }

    if (route === 'transferir-material') {
      return (
        <TransferirMaterial
          user={user}
          onVoltar={voltarDashboard}
          onConcluido={voltarDashboard}
        />
      )
    }

    if (route === 'baixar-material') {
      return (
        <BaixarMaterial
          user={user}
          onVoltar={voltarDashboard}
          onConcluido={voltarDashboard}
        />
      )
    }

    if (route === 'locais') {
      return <Locais user={user} />
    }

    if (route === 'materiais') {
  return (
    <Materiais
      user={user}
      onNavegar={setRoute}
    />
  )
}

    if (route === 'armas') {
      return (
        <Armas
          user={user}
          onAbrirPolicial={abrirCadastroPolicial}
        />
      )
    }

    if (route === 'tpd') {
  return <TPD user={user} />
}

if (route === 'ht') {
  return <HT user={user} />
}


if (route === 'tasers') {
  return <Taser user={user} />
}

if (route === 'tonfas') {
  return <Tonfas user={user} />
}


    if (route === 'policiais') {
      return (
        <Policiais
          user={user}
          abrirPolicialRe={policialAbrirRe}
          onPolicialAberto={() => setPolicialAbrirRe('')}
        />
      )
    }

    if (route === 'municoes') {
      return <Municoes user={user} />
    }

    if (
      route ===
      'solicitacoes-cadastrais'
    ) {
      return (
        <SolicitacoesCadastro
          user={user}
        />
      )
    }

    if (route === 'auditoria') {
      return (
        <Auditoria
          user={user}
        />
      )
    }

    if (route === 'diagnostico') {
      return (
        <Diagnostico
          user={user}
        />
      )
    }

    return (
      <PainelDashboard
        user={user}
        dashboard={dashboard}
        onNavegar={setRoute}
      />
    )
  }

  return (
    <>
      <AppShell
        user={user}
        route={route}
        setRoute={setRoute}
        onLogout={onLogout}
      >
        {renderPage()}
      </AppShell>

      {avisoRecebimento > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'rgba(3, 15, 32, .72)'
        }}>
          <section style={{
            width: 'min(460px, 100%)',
            borderRadius: 22,
            padding: 28,
            color: '#fff',
            background: 'linear-gradient(135deg, #071d39 0%, #0b3f73 100%)',
            boxShadow: '0 28px 70px rgba(0,0,0,.35)'
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>
              MATERIAL AGUARDANDO RECEBIMENTO
            </span>
            <h2 style={{ margin: '10px 0 8px' }}>
              Você possui {avisoRecebimento} carrinho(s) para receber
            </h2>
            <p style={{ opacity: .86, lineHeight: 1.5 }}>
              Confira os materiais pagos pelo SVDD e confirme o recebimento do carrinho completo.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                type="button"
                onClick={() => setAvisoRecebimento(0)}
                style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: '#fff' }}
              >
                Depois
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvisoRecebimento(0)
                  setRoute('receber-material')
                }}
                style={{ padding: '11px 16px', borderRadius: 10, border: 0, background: '#fff', color: '#0b315a', fontWeight: 800 }}
              >
                Receber agora
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
