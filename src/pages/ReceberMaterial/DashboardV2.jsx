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

import useDashboard from '../hooks/useDashboard'
import {
  obterRotaInicial,
  podeAcessarRota
} from '../services/permissionService'
import Locais from './Locais/Locais'
import Materiais from './Materiais/Materiais'
import Armas from './Armas/Armas'
import Policiais from './Policiais'
import Municoes from './Municoes/Municoes'
import PagarMaterial from './PagarMaterial/PagarMaterial'
import ReceberMaterial from './ReceberMaterial/ReceberMaterial'
import TransferirMaterial from './TransferirMaterial/TransferirMaterial'
import BaixarMaterial from './BaixarMaterial/BaixarMaterial'
import CentralOperacional from './CentralOperacional'

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

function PainelDashboard({
  user,
  dashboard,
  onNavegar
}) {
  const {
    cards,
    movimentacoes,
    indicadores,
    totaisPorModulo,
    timeline,
    atualizadoEm,
    loading,
    erro,
    atualizar
  } = dashboard

  const modulos = useMemo(
    () => totaisPorModulo.slice(0, 8),
    [totaisPorModulo]
  )

  const nomeUsuario =
    obterNomeUsuario(user)

  if (
    loading &&
    !atualizadoEm
  ) {
    return (
      <main className="sigmo-dashboard-v2">
        <EstadoPainel>
          Carregando painel operacional...
        </EstadoPainel>
      </main>
    )
  }

  return (
    <main className="sigmo-dashboard-v2">
      <section className="sigmo-hero-panel">
        <div>
          <span className="sigmo-kicker">
            CENTRAL OPERACIONAL
          </span>

          <h1>
            Visão patrimonial do SIGMO
          </h1>

          <p>
            Olá, {nomeUsuario}. Acompanhe o
            patrimônio, as movimentações e a
            situação operacional dos módulos.
          </p>
        </div>

        <div className="sigmo-hero-side">
          <div className="sigmo-hero-status">
            <span className="sigmo-live-dot" />

            <div>
              <strong>
                Dados conectados
              </strong>

              <span>
                Atualizado em{' '}
                {dataHora(atualizadoEm)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sigmo-refresh-button"
            onClick={atualizar}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar painel'}
          </button>
        </div>
      </section>

      {erro && (
        <EstadoPainel tipo="erro">
          <span>{erro}</span>

          <button
            type="button"
            onClick={atualizar}
          >
            Tentar novamente
          </button>
        </EstadoPainel>
      )}

      <section className="sigmo-dashboard-section">
        <div className="sigmo-section-heading">
          <div>
            <span>VISÃO GERAL</span>
            <h2>Resumo patrimonial</h2>
          </div>

          <strong>
            {numero(
              indicadores.percentualOperacional
            )}
            % operacional
          </strong>
        </div>

        <div className="sigmo-summary-grid">
          <CardResumo
            titulo="Total patrimonial"
            valor={cards.total}
            detalhe="Itens registrados no núcleo central"
            sigla="PT"
          />

          <CardResumo
            titulo="Ativos"
            valor={cards.ativos}
            detalhe="Patrimônios em situação ativa"
            sigla="AT"
            tone="green"
          />

          <CardResumo
            titulo="Disponíveis"
            valor={cards.disponiveis}
            detalhe="Prontos para utilização"
            sigla="DP"
            tone="cyan"
          />

          <CardResumo
            titulo="Cautelados"
            valor={cards.cautelados}
            detalhe="Vinculados a recebedores"
            sigla="CT"
            tone="yellow"
          />

          <CardResumo
            titulo="Recolhidos"
            valor={cards.recolhidos}
            detalhe="Itens recolhidos operacionalmente"
            sigla="RC"
            tone="orange"
          />

          <CardResumo
            titulo="Baixados"
            valor={cards.baixados}
            detalhe="Patrimônios fora de operação"
            sigla="BX"
            tone="red"
          />

          <CardResumo
            titulo="Movimentações hoje"
            valor={cards.movimentacoesHoje}
            detalhe="Eventos registrados desde 00h"
            sigla="HJ"
            tone="purple"
          />
        </div>
      </section>

      <section className="sigmo-dashboard-grid">
        <article className="sigmo-panel-card">
          <div className="sigmo-panel-title">
            <div>
              <span>ATIVIDADE RECENTE</span>
              <h2>
                Últimas movimentações
              </h2>
            </div>

            <button
              type="button"
              className="sigmo-text-button"
              onClick={() =>
                onNavegar('movimentacoes')
              }
            >
              Abrir movimentações
            </button>
          </div>

          {timeline.length === 0 ? (
            <EstadoPainel>
              Nenhuma movimentação encontrada.
            </EstadoPainel>
          ) : (
            <div className="sigmo-activity-list">
              {timeline.map((item, index) => (
                <div
                  className="sigmo-activity-item"
                  key={
                    item.id ||
                    `${item.created_at}-${index}`
                  }
                >
                  <div
                    className={`sigmo-activity-icon sigmo-activity-${classeTipo(
                      item.tipo
                    )}`}
                  >
                    {obterIniciais(
                      tipoMovimentacao(item.tipo)
                    )}
                  </div>

                  <div className="sigmo-activity-content">
                    <strong>
                      {item.autor || 'SISTEMA'}
                    </strong>

                    <p>
                      {item.titulo ||
                        'Registrou uma movimentação patrimonial'}
                    </p>

                    <span>
                      {item.data_formatada ||
                        dataHora(item.created_at)}
                    </span>
                  </div>

                  <span
                    className={`sigmo-status sigmo-status-${classeTipo(
                      item.tipo
                    )}`}
                  >
                    {tipoMovimentacao(item.tipo)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <div className="sigmo-dashboard-column">
          <article className="sigmo-panel-card">
            <div className="sigmo-panel-title">
              <div>
                <span>OPERAÇÃO</span>
                <h2>
                  Movimentações registradas
                </h2>
              </div>
            </div>

            <div className="sigmo-operation-list">
              <button
                type="button"
                onClick={() =>
                  onNavegar('receber-material')
                }
              >
                <span className="sigmo-operation-icon">
                  RE
                </span>

                <div>
                  <strong>Recebimentos</strong>
                  <small>
                    Abrir recebimento de material
                  </small>
                </div>

                <b>
                  {numero(
                    movimentacoes.recebimentos
                  )}
                </b>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavegar('transferir-material')
                }
              >
                <span className="sigmo-operation-icon">
                  TR
                </span>

                <div>
                  <strong>Transferências</strong>
                  <small>
                    Transferir material
                  </small>
                </div>

                <b>
                  {numero(
                    movimentacoes.transferencias
                  )}
                </b>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavegar('baixar-material')
                }
              >
                <span className="sigmo-operation-icon">
                  BX
                </span>

                <div>
                  <strong>Baixas</strong>
                  <small>
                    Registrar baixa patrimonial
                  </small>
                </div>

                <b>
                  {numero(
                    movimentacoes.baixas
                  )}
                </b>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavegar('pagar-material')
                }
              >
                <span className="sigmo-operation-icon">
                  PG
                </span>

                <div>
                  <strong>Pagar material</strong>
                  <small>
                    Cautela e entrega ao policial
                  </small>
                </div>

                <b>→</b>
              </button>
            </div>
          </article>

          <article className="sigmo-panel-card">
            <div className="sigmo-panel-title">
              <div>
                <span>MÓDULOS</span>
                <h2>
                  Distribuição patrimonial
                </h2>
              </div>

              <strong className="sigmo-panel-total">
                {numero(cards.total)}
              </strong>
            </div>

            {modulos.length === 0 ? (
              <EstadoPainel>
                Nenhum módulo patrimonial encontrado.
              </EstadoPainel>
            ) : (
              <div className="sigmo-module-list">
                {modulos.map((item) => {
                  const percentual =
                    cards.total > 0
                      ? Math.round(
                          (
                            Number(item.total) /
                            Number(cards.total)
                          ) * 100
                        )
                      : 0

                  return (
                    <div
                      className="sigmo-module-item"
                      key={item.tipo}
                    >
                      <div className="sigmo-module-head">
                        <strong>
                          {nomeModulo(item.tipo)}
                        </strong>

                        <span>
                          {numero(item.total)}
                        </span>
                      </div>

                      <div className="sigmo-module-track">
                        <span
                          style={{
                            width: `${Math.min(
                              percentual,
                              100
                            )}%`
                          }}
                        />
                      </div>

                      <small>
                        {percentual}% do patrimônio
                      </small>
                    </div>
                  )
                })}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="sigmo-indicator-panel">
        <div>
          <span>ITENS OPERACIONAIS</span>

          <strong>
            {numero(indicadores.operacionais)}
          </strong>

          <small>
            Ativos, disponíveis, cautelados e
            recolhidos
          </small>
        </div>

        <div className="sigmo-indicator-progress">
          <div>
            <strong>
              Saúde operacional
            </strong>

            <span>
              {numero(
                indicadores.percentualOperacional
              )}
              %
            </span>
          </div>

          <div className="sigmo-indicator-track">
            <span
              style={{
                width: `${Math.min(
                  Number(
                    indicadores.percentualOperacional
                  ) || 0,
                  100
                )}%`
              }}
            />
          </div>
        </div>
      </section>
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
          onConcluido={voltarDashboard}
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
      return <Materiais user={user} />
    }

    if (route === 'armas') {
      return <Armas user={user} />
    }

    if (route === 'policiais') {
      return <Policiais user={user} />
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
