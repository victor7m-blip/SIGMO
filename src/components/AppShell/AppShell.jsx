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

  const perfilTemporario =
    possuiPerfilTemporarioAtivo(
      user
    )

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
    <div className="app-shell">
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
                    {item.label}
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
                <small>
                  Perfil temporário ativo
                </small>
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