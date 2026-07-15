import {
  useEffect,
  useState
} from 'react'

import {
  supabase
} from '../services/supabaseClient'

import {
  saveSession
} from '../services/authService'

import {
  registerAudit
} from '../services/auditoriaService'

import {
  buscarUltimaRelease
} from '../services/releasesService'

import backgroundDesktop from '../assets/SIGMO_01_Login.png'
import backgroundMobile from '../assets/SIGMO_01_Login_Mobile.png'

function formatarDataHora(valor) {
  if (!valor) {
    return 'Data não informada'
  }

  try {
    return new Intl.DateTimeFormat(
      'pt-BR',
      {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    ).format(
      new Date(valor)
    )
  } catch {
    return String(valor)
  }
}

export default function Login({
  onLogin
}) {
  const [
    re,
    setRe
  ] = useState('')

  const [
    pin,
    setPin
  ] = useState('')

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    error,
    setError
  ] = useState('')

  const [
    background,
    setBackground
  ] = useState(
    backgroundDesktop
  )

  const [
    release,
    setRelease
  ] = useState(null)

  const [
    releaseAberta,
    setReleaseAberta
  ] = useState(false)

  useEffect(() => {
    function updateBackground() {
      setBackground(
        window.innerWidth <= 768
          ? backgroundMobile
          : backgroundDesktop
      )
    }

    updateBackground()

    window.addEventListener(
      'resize',
      updateBackground
    )

    return () =>
      window.removeEventListener(
        'resize',
        updateBackground
      )
  }, [])

  useEffect(() => {
    async function carregarRelease() {
      try {
        const resultado =
          await buscarUltimaRelease()

        setRelease(resultado)
      } catch (releaseError) {
        console.error(
          'Erro ao carregar release:',
          releaseError
        )
      }
    }

    carregarRelease()
  }, [])

  function limparNumero(
    value,
    max = 6
  ) {
    return String(
      value || ''
    )
      .replace(/\D/g, '')
      .slice(0, max)
  }

  function handleChangeRE(event) {
    setRe(
      limparNumero(
        event.target.value,
        6
      )
    )
  }

  function handleChangePIN(event) {
    setPin(
      limparNumero(
        event.target.value,
        6
      )
    )
  }

  async function handleLogin(event) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const reLimpo =
      limparNumero(re, 6)

    const pinLimpo =
      limparNumero(pin, 6)

    if (
      !reLimpo ||
      !pinLimpo
    ) {
      setError(
        'Informe o RE e o PIN.'
      )

      setLoading(false)

      return
    }

    try {
      const {
        data: policial,
        error: policialError
      } = await supabase
        .from('policiais')
        .select('*')
        .ilike(
          're',
          `${reLimpo}-%`
        )
        .maybeSingle()

      if (policialError) {
        console.error(
          policialError
        )

        setError(
          'Erro ao consultar policial.'
        )

        return
      }

      if (!policial) {
        setError(
          'RE não encontrado.'
        )

        return
      }

      const {
        data: usuario,
        error: usuarioError
      } = await supabase
        .from('sigmo_users')
        .select('*')
        .eq(
          'policial_id',
          policial.id
        )
        .eq(
          'pin',
          Number(pinLimpo)
        )
        .eq(
          'ativo',
          true
        )
        .maybeSingle()

      if (usuarioError) {
        console.error(
          usuarioError
        )

        setError(
          'Erro ao validar usuário.'
        )

        return
      }

      if (!usuario) {
        setError(
          'PIN incorreto ou usuário inativo.'
        )

        return
      }

      const sessionUser = {
        id:
          policial.id,

        re:
          policial.re,

        nome:
          policial.nome,

        nome_guerra:
          policial.nome_guerra,

        posto_graduacao:
          policial.posto_graduacao,

        companhia:
          policial.companhia,

        pelotao:
          policial.pelotao,

        perfil:
          usuario.perfil,

        ativo:
          usuario.ativo,

        user_id:
          usuario.id
      }

      try {
        await registerAudit(
          'LOGIN',
          'Usuário acessou o SIGMO.',
          sessionUser,
          'Login'
        )
      } catch (auditError) {
        console.error(
          'Erro ao registrar auditoria:',
          auditError
        )
      }

      saveSession(
        sessionUser
      )

      onLogin(
        sessionUser
      )
    } catch (err) {
      console.error(err)

      setError(
        'Erro inesperado ao acessar o SIGMO.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="login-page"
      style={{
        backgroundImage:
          `url(${background})`,

        backgroundSize:
          'contain',

        backgroundPosition:
          'center center',

        backgroundRepeat:
          'no-repeat',

        backgroundColor:
          '#030913'
      }}
    >
      <section className="login-card">
        <form
          onSubmit={handleLogin}
          autoComplete="off"
        >
          <label>
            RE
          </label>

          <input
            name="sigmo_re"
            type="text"
            value={re}
            onChange={handleChangeRE}
            placeholder="Digite o RE"
            maxLength={6}
            inputMode="numeric"
            autoComplete="off"
          />

          <label>
            PIN
          </label>

          <input
            name="sigmo_pin"
            type="password"
            value={pin}
            onChange={handleChangePIN}
            placeholder="Digite o PIN"
            maxLength={6}
            inputMode="numeric"
            autoComplete="new-password"
          />

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display:
                'block',

              width:
                '100%',

              height:
                '48px',

              marginTop:
                '20px',

              background:
                '#075eea',

              color:
                '#ffffff',

              border:
                'none',

              borderRadius:
                '8px',

              fontSize:
                '16px',

              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',

              opacity:
                loading
                  ? 0.75
                  : 1
            }}
          >
            {loading
              ? 'Entrando...'
              : 'Entrar'}
          </button>
        </form>

        {release && (
          <button
            type="button"
            onClick={() =>
              setReleaseAberta(true)
            }
            style={{
              width:
                '100%',

              marginTop:
                '14px',

              padding:
                '11px 14px',

              border:
                '1px solid rgba(75, 160, 255, 0.32)',

              borderRadius:
                '8px',

              background:
                'rgba(2, 16, 38, 0.84)',

              color:
                '#ffffff',

              textAlign:
                'left',

              cursor:
                'pointer'
            }}
          >
            <span
              style={{
                display:
                  'block',

                marginBottom:
                  '5px',

                color:
                  '#4db7ff',

                fontSize:
                  '10px',

                fontWeight:
                  900,

                letterSpacing:
                  '1px'
              }}
            >
              ÚLTIMA ATUALIZAÇÃO
            </span>

            <strong
              style={{
                display:
                  'block',

                fontSize:
                  '13px'
              }}
            >
              {release.versao}
            </strong>

            <small
              style={{
                display:
                  'block',

                marginTop:
                  '3px',

                color:
                  '#cbd5e1',

                fontSize:
                  '11px'
              }}
            >
              {formatarDataHora(
                release.data_publicacao
              )}
            </small>
          </button>
        )}
      </section>

      {releaseAberta && release && (
        <div
          onClick={() =>
            setReleaseAberta(false)
          }
          style={{
            position:
              'fixed',

            inset:
              0,

            zIndex:
              9999,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            padding:
              '24px',

            background:
              'rgba(2, 8, 23, 0.78)',

            backdropFilter:
              'blur(5px)'
          }}
        >
          <section
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                'min(520px, 100%)',

              maxHeight:
                '85vh',

              overflowY:
                'auto',

              padding:
                '28px',

              borderRadius:
                '20px',

              background:
                '#ffffff',

              boxShadow:
                '0 30px 90px rgba(2, 8, 23, 0.45)'
            }}
          >
            <span
              style={{
                color:
                  '#075eea',

                fontSize:
                  '11px',

                fontWeight:
                  900,

                letterSpacing:
                  '1px'
              }}
            >
              {release.versao}
            </span>

            <h2
              style={{
                margin:
                  '8px 0 6px',

                color:
                  '#0b1f38'
              }}
            >
              {release.titulo}
            </h2>

            <small
              style={{
                color:
                  '#667085'
              }}
            >
              Publicado em{' '}
              {formatarDataHora(
                release.data_publicacao
              )}
            </small>

            {release.descricao && (
              <p
                style={{
                  margin:
                    '18px 0',

                  color:
                    '#475467',

                  lineHeight:
                    1.6
                }}
              >
                {release.descricao}
              </p>
            )}

            {Array.isArray(
              release.novidades
            ) &&
              release.novidades.length >
                0 && (
                <div
                  style={{
                    display:
                      'grid',

                    gap:
                      '10px'
                  }}
                >
                  {release.novidades.map(
                    (
                      novidade,
                      index
                    ) => (
                      <div
                        key={`${novidade}-${index}`}
                        style={{
                          padding:
                            '12px 14px',

                          border:
                            '1px solid #e4e7ec',

                          borderRadius:
                            '11px',

                          background:
                            '#f8fafc',

                          color:
                            '#344054',

                          fontSize:
                            '13px',

                          fontWeight:
                            700
                        }}
                      >
                        ✓ {novidade}
                      </div>
                    )
                  )}
                </div>
              )}

            <button
              type="button"
              onClick={() =>
                setReleaseAberta(false)
              }
              style={{
                width:
                  '100%',

                minHeight:
                  '44px',

                marginTop:
                  '22px',

                border:
                  'none',

                borderRadius:
                  '10px',

                background:
                  '#075eea',

                color:
                  '#ffffff',

                fontWeight:
                  800,

                cursor:
                  'pointer'
              }}
            >
              Fechar
            </button>
          </section>
        </div>
      )}
    </div>
  )
}