import {
  useEffect,
  useMemo,
  useState
} from 'react'

import brasaoUnidade from '../../assets/unidade/brasao-27-bpmm.jpg'

import {
  obterPerfilEfetivo,
  podeAcessarRota,
  possuiPerfilTemporarioAtivo
} from '../../services/permissionService'

import './AppShell.css'

const UNIDADE = {
  nome: '27º BPM/M',
  companhia: '5ª CIA',
  brasao: brasaoUnidade
}

const menuItems = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '⌂'
  },
  {
    key: 'central-operacional',
    label: 'Central Operacional',
    icon: '▦'
  },
  {
    key: 'manutencoes',
    label: 'Manutenções',
    icon: '🔧'
  },
  {
    key: 'pagar-material',
    label: 'Pagar Material',
    icon: '⬇'
  },
  {
    key: 'receber-material',
    label: 'Receber Material',
    icon: '⬆'
  },

{
  key: 'devolver-material',
  label: 'Devolver Material',
  icon: '↩'
},

  {
    key: 'materiais',
    label: 'Materiais',
    icon: '▰'
  },
  {
    key: 'policiais',
    label: 'Policiais',
    icon: '●'
  },
  {
    key: 'carga-pessoal',
    label: 'Carga Pessoal',
    icon: '▣'
  },
  {
  key: 'solicitacoes-cadastrais',
  label: 'Solicitações Cadastrais',
  icon: '☷'
},
  {
    key: 'viaturas',
    label: 'Viaturas',
    icon: '▱'
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    icon: '▥'
  },
  {
    key: 'alertas',
    label: 'Alertas',
    icon: '●'
  },
  {
    key: 'auditoria',
    label: 'Auditoria',
    icon: '▤'
  },
 {
  key: 'diagnostico',
  label: 'Diagnóstico',
  icon: '◇'
},
  {
    key: 'exportacao-backup',
    label: 'Exportação / Backup',
    icon: '⬇'
  },
  {
    key: 'configuracoes',
    label: 'Configurações',
    icon: '⚙'
  }
]

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.email ||
    user?.re ||
    'Usuário SIGMO'
  )
}

export default function AppShell({
  user,
  route,
  setRoute,
  onLogout,
  children
}) {
  const [
    mobileMenuOpen,
    setMobileMenuOpen
  ] = useState(false)

  const [
    agora,
    setAgora
  ] = useState(() => Date.now())

  const menuPermitido = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          podeAcessarRota(
            user,
            item.key
          )
      ),
    [user]
  )

  const perfilEfetivo =
    obterPerfilEfetivo(user)

    console.log('Perfil efetivo:', perfilEfetivo)
    console.log('User:', user)

    
const perfilNormalizado =
  String(perfilEfetivo || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const ehUsuarioComum =
  perfilNormalizado === 'USUARIO'

const perfilTemporario =
  possuiPerfilTemporarioAtivo(
    user
  )

const tempoRestanteTemporario =
  useMemo(() => {
    if (
      !perfilTemporario ||
      !user?.perfil_temporario_fim
    ) {
      return null
    }

    const fim =
      new Date(
        user.perfil_temporario_fim
      ).getTime()

    if (
      !Number.isFinite(fim)
    ) {
      return null
    }

    const restante =
      Math.max(
        0,
        fim - agora
      )

    const totalMinutos =
      Math.ceil(
        restante / 60000
      )

    const horas =
      Math.floor(
        totalMinutos / 60
      )

    const minutos =
      totalMinutos % 60

    return `${horas}h ${String(
      minutos
    ).padStart(2, '0')}min`
  }, [
    agora,
    perfilTemporario,
    user?.perfil_temporario_fim
  ])

  useEffect(() => {
    if (
      !perfilTemporario ||
      !user?.perfil_temporario_fim
    ) {
      return undefined
    }

    setAgora(Date.now())

    const intervalo =
      window.setInterval(
        () => {
          setAgora(
            Date.now()
          )
        },
        30000
      )

    return () => {
      window.clearInterval(
        intervalo
      )
    }
  }, [
    perfilTemporario,
    user?.perfil_temporario_fim
  ])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [route])

  useEffect(() => {
    function handleEscape(event) {
      if (
        event.key ===
        'Escape'
      ) {
        setMobileMenuOpen(
          false
        )
      }
    }

    window.addEventListener(
      'keydown',
      handleEscape
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape
      )
    }
  }, [])

  function navegar(itemKey) {
    if (
      !podeAcessarRota(
        user,
        itemKey
      )
    ) {
      return
    }

    setRoute(itemKey)

    setMobileMenuOpen(false)
  }

  return (
    <div className={`app-shell app-shell-${route}`}>
      <button
        type="button"
        className="menu-toggle"
        aria-label="Abrir menu principal"
        aria-expanded={
          mobileMenuOpen
        }
        onClick={() =>
          setMobileMenuOpen(
            true
          )
        }
      >
        <span />
        <span />
        <span />
      </button>

      {mobileMenuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() =>
            setMobileMenuOpen(
              false
            )
          }
        />
      )}

      <aside
        className={[
          'app-sidebar',
          mobileMenuOpen
            ? 'sidebar-open'
            : ''
        ].join(' ')}
      >
        <div className="app-sidebar-top">
          <button
            type="button"
            className="sidebar-close"
            aria-label="Fechar menu"
            onClick={() =>
              setMobileMenuOpen(
                false
              )
            }
          >
            ×
          </button>

          <div className="app-brand">
            <div className="app-brand-emblem">
              <img
                src={
                  UNIDADE.brasao
                }
                alt={
                  `Brasão do ${UNIDADE.nome}`
                }
                className="app-brand-emblem-image"
              />
            </div>

            <div className="app-brand-name">
              <strong>
                SIGMO
              </strong>

              <span>
                Gestão Operacional
              </span>
            </div>

            <div className="app-brand-unit">
              <strong>
                {UNIDADE.nome}
              </strong>

              <span>
                {UNIDADE.companhia}
              </span>
            </div>
          </div>
        </div>

        <nav
          className="app-menu"
          aria-label="Navegação principal"
        >
          {menuPermitido.map(
            (item) => {
              const ativo =
                route ===
                item.key

              const labelExibido =
              item.key === 'policiais' &&
              ehUsuarioComum
              ? 'Cadastro'
              : item.label

              return (
                <button
                  type="button"
                  key={item.key}
                  className={
                    ativo
                      ? 'app-menu-item active'
                      : 'app-menu-item'
                  }
                  aria-current={
                    ativo
                      ? 'page'
                      : undefined
                  }
                  onClick={() =>
                    navegar(
                      item.key
                    )
                  }
                >
                  <span
                    className="app-menu-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  <span className="app-menu-label">
                  {labelExibido}
                 </span>
                </button>
              )
            }
          )}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user">
            <div className="app-user-avatar">
              {obterNomeUsuario(
                user
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="app-user-info">
              <strong>
                {obterNomeUsuario(
                  user
                )}
              </strong>

              <span>
                {perfilEfetivo}
              </span>

              {perfilTemporario && (
                <>
                  <small>
                    Perfil temporário ativo
                  </small>

                  {tempoRestanteTemporario && (
                    <small>
                      Restam {tempoRestanteTemporario}
                    </small>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="app-logout"
            onClick={
              onLogout
            }
          >
            <span
              className="app-logout-icon"
              aria-hidden="true"
            >
              ⇥
            </span>

            <span>
              Sair do sistema
            </span>
          </button>

          <div className="app-version">
            SIGMO • {UNIDADE.nome} •{' '}
            {UNIDADE.companhia}
          </div>
        </div>
      </aside>

      <section className="app-content">
        {children}
      </section>
    </div>
  )
}