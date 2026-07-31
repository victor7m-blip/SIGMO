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
  obterRotaInicial,
  podeAcessarRota
} from '../services/permissionService'
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

function PainelDashboard({
  user,
  dashboard,
  onNavegar
}) {
  const {
    cards,
    movimentacoes,
    timeline,
    atualizadoEm,
    loading,
    erro,
    atualizar
  } = dashboard

  const vitrine =
    useDashboardVitrine()

  const [agora, setAgora] =
    useState(() => new Date())

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
    Number(vitrine.armas.carga || 0) +
    Number(
      vitrine.armas.cautelas ||
        0
    ) +
    Number(
      vitrine.tonfas.emServico ||
        0
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

          <div className="sigmo-command-movements">
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

  const dashboard = useDashboard()

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
    <AppShell
      user={user}
      route={route}
      setRoute={setRoute}
      onLogout={onLogout}
    >
      {renderPage()}
    </AppShell>
  )
}
