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

import {
  solicitarRecuperacaoPin
} from '../services/recuperacaoSenhaService'

import {
  concluirTrocaObrigatoriaPin
} from '../services/credenciaisService'

import {
  obterPerfilTemporarioAtivo,
  PERFIS_TEMPORARIOS
} from '../features/perfisTemporarios/services/perfisTemporariosService'

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

async function abrirSessaoSegura(
  usuarioId,
  pinInformado
) {
  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_abrir_sessao',
    {
      p_usuario_id: usuarioId,
      p_pin: pinInformado
    }
  )

  if (error) {
    throw error
  }

  const sessao =
    Array.isArray(data)
      ? data[0]
      : data

  const token =
    sessao?.token

  if (!token) {
    throw new Error(
      'A sessão segura não retornou um token.'
    )
  }

  return token
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

  const [
    recuperacaoAberta,
    setRecuperacaoAberta
  ] = useState(false)

  const [
    reRecuperacao,
    setReRecuperacao
  ] = useState('')

  const [
    reResponsavel,
    setReResponsavel
  ] = useState('')

  const [
    recuperacaoLoading,
    setRecuperacaoLoading
  ] = useState(false)

  const [
    recuperacaoErro,
    setRecuperacaoErro
  ] = useState('')

  const [
    recuperacaoSucesso,
    setRecuperacaoSucesso
  ] = useState('')


  const [
    trocaPendente,
    setTrocaPendente
  ] = useState(null)

  const [
    novoPin,
    setNovoPin
  ] = useState('')

  const [
    confirmarNovoPin,
    setConfirmarNovoPin
  ] = useState('')

  const [
    trocaLoading,
    setTrocaLoading
  ] = useState(false)

  const [
    trocaErro,
    setTrocaErro
  ] = useState('')

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

  function abrirRecuperacao() {
    setReRecuperacao(re)
    setReResponsavel('')
    setRecuperacaoErro('')
    setRecuperacaoSucesso('')
    setRecuperacaoAberta(true)
  }

  function fecharRecuperacao() {
    if (recuperacaoLoading) {
      return
    }

    setRecuperacaoAberta(false)
    setRecuperacaoErro('')
    setRecuperacaoSucesso('')
  }

  async function handleSolicitarRecuperacao(event) {
    event.preventDefault()

    setRecuperacaoErro('')
    setRecuperacaoSucesso('')
    setRecuperacaoLoading(true)

    try {
      const resultado =
        await solicitarRecuperacaoPin({
          reSolicitante:
            reRecuperacao,
          reResponsavel
        })

      const nomeResponsavel =
        resultado?.responsavel_nome

      setRecuperacaoSucesso(
        nomeResponsavel
          ? `Solicitação encaminhada para ${nomeResponsavel}.`
          : 'Solicitação encaminhada com sucesso.'
      )
    } catch (err) {
      console.error(
        'Erro ao solicitar recuperação de PIN:',
        err
      )

      setRecuperacaoErro(
        err?.message ||
        'Não foi possível registrar a solicitação.'
      )
    } finally {
      setRecuperacaoLoading(false)
    }
  }

  async function handleTrocaObrigatoria(event) {
    event.preventDefault()

    setTrocaErro('')

    const pinNovoLimpo =
      limparNumero(novoPin, 6)

    const confirmacaoLimpa =
      limparNumero(confirmarNovoPin, 6)

    if (
      pinNovoLimpo.length !== 6 ||
      confirmacaoLimpa.length !== 6
    ) {
      setTrocaErro(
        'O novo PIN deve ter exatamente 6 números.'
      )
      return
    }

    if (pinNovoLimpo !== confirmacaoLimpa) {
      setTrocaErro(
        'A confirmação não corresponde ao novo PIN.'
      )
      return
    }

    if (pinNovoLimpo === trocaPendente?.pinTemporario) {
      setTrocaErro(
        'Escolha um PIN diferente do PIN temporário.'
      )
      return
    }

    setTrocaLoading(true)

    try {
      await concluirTrocaObrigatoriaPin({
        usuarioId: trocaPendente.usuarioId,
        novoPin: pinNovoLimpo
      })

      const sessionUser = {
        ...trocaPendente.sessionUser,
        exige_troca: false
      }

      try {
        await registerAudit(
          'ALTERAR_PIN',
          'Usuário definiu um novo PIN após recuperação de acesso.',
          sessionUser,
          'Login'
        )
      } catch (auditError) {
        console.error(
          'Erro ao registrar auditoria da troca de PIN:',
          auditError
        )
      }

      const sigmoSessionToken =
        await abrirSessaoSegura(
          trocaPendente.usuarioId,
          pinNovoLimpo
        )

      saveSession(
        sessionUser,
        sigmoSessionToken
      )
      onLogin(sessionUser)
    } catch (err) {
      console.error(
        'Erro ao concluir troca obrigatória de PIN:',
        err
      )

      setTrocaErro(
        err?.message ||
        'Não foi possível alterar o PIN.'
      )
    } finally {
      setTrocaLoading(false)
    }
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

      let perfilTemporarioAtivo = null

      try {
        perfilTemporarioAtivo =
          await obterPerfilTemporarioAtivo({
            policialRe:
              policial.re,

            perfil:
              PERFIS_TEMPORARIOS
                .AUXILIAR_SVDD_TEMPORARIO
          })
      } catch (perfilTemporarioError) {
        console.error(
          'Erro ao consultar perfil temporário no login:',
          perfilTemporarioError
        )
      }

      const possuiAuxiliarTemporario =
        Boolean(
          perfilTemporarioAtivo?.valido
        )

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

        perfil_temporario:
          possuiAuxiliarTemporario
            ? 'AUXILIAR DO SVDD'
            : null,

        perfil_temporario_ativo:
          possuiAuxiliarTemporario,

        perfil_temporario_inicio:
          possuiAuxiliarTemporario
            ? perfilTemporarioAtivo?.inicio_em || null
            : null,

        perfil_temporario_fim:
          possuiAuxiliarTemporario
            ? perfilTemporarioAtivo?.expira_em || null
            : null,

        ativo:
          usuario.ativo,

        user_id:
          usuario.id,

        exige_troca:
          Boolean(usuario.exige_troca)
      }

      if (usuario.exige_troca) {
        setTrocaPendente({
          usuarioId: usuario.id,
          pinTemporario: pinLimpo,
          sessionUser
        })

        setNovoPin('')
        setConfirmarNovoPin('')
        setTrocaErro('')
        return
      }

      const sigmoSessionToken =
        await abrirSessaoSegura(
          usuario.id,
          pinLimpo
        )

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
        sessionUser,
        sigmoSessionToken
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

  if (trocaPendente) {
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
        <section
          className="login-card"
          style={{
            width: 'min(430px, calc(100% - 32px))'
          }}
        >
          <div
            style={{
              marginBottom: '22px',
              textAlign: 'center'
            }}
          >
            <span
              style={{
                display: 'inline-block',
                marginBottom: '8px',
                color: '#4db7ff',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '1.2px'
              }}
            >
              SEGURANÇA DE ACESSO
            </span>

            <h2
              style={{
                margin: '0 0 8px',
                color: '#ffffff',
                fontSize: '24px'
              }}
            >
              Troca obrigatória de PIN
            </h2>

            <p
              style={{
                margin: 0,
                color: '#cbd5e1',
                fontSize: '13px',
                lineHeight: 1.55
              }}
            >
              O PIN usado no acesso é temporário. Defina um novo PIN para continuar no SIGMO.
            </p>
          </div>

          <form
            onSubmit={handleTrocaObrigatoria}
            autoComplete="off"
          >
            <label>Novo PIN</label>
            <input
              name="sigmo_novo_pin"
              type="password"
              value={novoPin}
              onChange={(event) =>
                setNovoPin(
                  limparNumero(event.target.value, 6)
                )
              }
              placeholder="Digite 6 números"
              maxLength={6}
              inputMode="numeric"
              autoComplete="new-password"
              autoFocus
            />

            <label>Confirmar novo PIN</label>
            <input
              name="sigmo_confirmar_novo_pin"
              type="password"
              value={confirmarNovoPin}
              onChange={(event) =>
                setConfirmarNovoPin(
                  limparNumero(event.target.value, 6)
                )
              }
              placeholder="Repita o novo PIN"
              maxLength={6}
              inputMode="numeric"
              autoComplete="new-password"
            />

            {trocaErro && (
              <div className="error">
                {trocaErro}
              </div>
            )}

            <button
              type="submit"
              disabled={trocaLoading}
              style={{
                display: 'block',
                width: '100%',
                height: '48px',
                marginTop: '20px',
                border: 'none',
                borderRadius: '8px',
                background: '#075eea',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 800,
                cursor: trocaLoading
                  ? 'not-allowed'
                  : 'pointer',
                opacity: trocaLoading ? 0.75 : 1
              }}
            >
              {trocaLoading
                ? 'Alterando PIN...'
                : 'Alterar PIN e continuar'}
            </button>
          </form>
        </section>
      </div>
    )
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

        <button
          type="button"
          onClick={abrirRecuperacao}
          disabled={loading}
          style={{
            width:
              '100%',

            marginTop:
              '12px',

            padding:
              '9px 12px',

            border:
              'none',

            background:
              'transparent',

            color:
              '#8ecbff',

            fontSize:
              '13px',

            fontWeight:
              700,

            textDecoration:
              'underline',

            textUnderlineOffset:
              '3px',

            cursor:
              loading
                ? 'not-allowed'
                : 'pointer',

            opacity:
              loading
                ? 0.6
                : 1
          }}
        >
          Esqueci meu PIN
        </button>

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

      {recuperacaoAberta && (
        <div
          onClick={fecharRecuperacao}
          style={{
            position:
              'fixed',

            inset:
              0,

            zIndex:
              9998,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            padding:
              '24px',

            background:
              'rgba(2, 8, 23, 0.82)',

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
                'min(460px, 100%)',

              padding:
                '26px',

              border:
                '1px solid rgba(77, 183, 255, 0.25)',

              borderRadius:
                '18px',

              background:
                'linear-gradient(145deg, #071a35 0%, #031022 100%)',

              boxShadow:
                '0 30px 90px rgba(0, 0, 0, 0.48)'
            }}
          >
            <span
              style={{
                display:
                  'block',

                color:
                  '#4db7ff',

                fontSize:
                  '11px',

                fontWeight:
                  900,

                letterSpacing:
                  '1px'
              }}
            >
              RECUPERAÇÃO DE ACESSO
            </span>

            <h2
              style={{
                margin:
                  '8px 0 8px',

                color:
                  '#ffffff',

                fontSize:
                  '22px'
              }}
            >
              Esqueci meu PIN
            </h2>

            <p
              style={{
                margin:
                  '0 0 20px',

                color:
                  '#b8c7dc',

                fontSize:
                  '13px',

                lineHeight:
                  1.55
              }}
            >
              Informe o seu RE e o RE do responsável que receberá a solicitação. Nesta etapa, nenhum PIN será alterado automaticamente.
            </p>

            <form
              onSubmit={handleSolicitarRecuperacao}
              autoComplete="off"
            >
              <label
                style={{
                  display:
                    'block',

                  marginBottom:
                    '7px',

                  color:
                    '#e7eef8',

                  fontSize:
                    '13px',

                  fontWeight:
                    800
                }}
              >
                Seu RE
              </label>

              <input
                type="text"
                value={reRecuperacao}
                onChange={(event) =>
                  setReRecuperacao(
                    limparNumero(
                      event.target.value,
                      6
                    )
                  )
                }
                placeholder="Digite o seu RE"
                maxLength={6}
                inputMode="numeric"
                disabled={
                  recuperacaoLoading ||
                  Boolean(recuperacaoSucesso)
                }
                style={{
                  boxSizing:
                    'border-box',

                  width:
                    '100%',

                  height:
                    '46px',

                  padding:
                    '0 13px',

                  border:
                    '1px solid rgba(142, 203, 255, 0.28)',

                  borderRadius:
                    '9px',

                  outline:
                    'none',

                  background:
                    'rgba(255, 255, 255, 0.08)',

                  color:
                    '#ffffff',

                  fontSize:
                    '15px'
                }}
              />

              <label
                style={{
                  display:
                    'block',

                  margin:
                    '16px 0 7px',

                  color:
                    '#e7eef8',

                  fontSize:
                    '13px',

                  fontWeight:
                    800
                }}
              >
                RE do responsável
              </label>

              <input
                type="text"
                value={reResponsavel}
                onChange={(event) =>
                  setReResponsavel(
                    limparNumero(
                      event.target.value,
                      6
                    )
                  )
                }
                placeholder="Digite o RE do responsável"
                maxLength={6}
                inputMode="numeric"
                disabled={
                  recuperacaoLoading ||
                  Boolean(recuperacaoSucesso)
                }
                style={{
                  boxSizing:
                    'border-box',

                  width:
                    '100%',

                  height:
                    '46px',

                  padding:
                    '0 13px',

                  border:
                    '1px solid rgba(142, 203, 255, 0.28)',

                  borderRadius:
                    '9px',

                  outline:
                    'none',

                  background:
                    'rgba(255, 255, 255, 0.08)',

                  color:
                    '#ffffff',

                  fontSize:
                    '15px'
                }}
              />

              {recuperacaoErro && (
                <div
                  style={{
                    marginTop:
                      '15px',

                    padding:
                      '11px 12px',

                    border:
                      '1px solid rgba(248, 113, 113, 0.35)',

                    borderRadius:
                      '9px',

                    background:
                      'rgba(127, 29, 29, 0.28)',

                    color:
                      '#fecaca',

                    fontSize:
                      '13px'
                  }}
                >
                  {recuperacaoErro}
                </div>
              )}

              {recuperacaoSucesso && (
                <div
                  style={{
                    marginTop:
                      '15px',

                    padding:
                      '11px 12px',

                    border:
                      '1px solid rgba(52, 211, 153, 0.35)',

                    borderRadius:
                      '9px',

                    background:
                      'rgba(6, 78, 59, 0.35)',

                    color:
                      '#a7f3d0',

                    fontSize:
                      '13px',

                    lineHeight:
                      1.5
                  }}
                >
                  {recuperacaoSucesso}
                  <br />
                  Procure o responsável pessoalmente para concluir a recuperação.
                </div>
              )}

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    recuperacaoSucesso
                      ? '1fr'
                      : '1fr 1fr',

                  gap:
                    '10px',

                  marginTop:
                    '20px'
                }}
              >
                <button
                  type="button"
                  onClick={fecharRecuperacao}
                  disabled={recuperacaoLoading}
                  style={{
                    minHeight:
                      '44px',

                    border:
                      '1px solid rgba(255, 255, 255, 0.18)',

                    borderRadius:
                      '9px',

                    background:
                      'rgba(255, 255, 255, 0.07)',

                    color:
                      '#ffffff',

                    fontWeight:
                      800,

                    cursor:
                      recuperacaoLoading
                        ? 'not-allowed'
                        : 'pointer'
                  }}
                >
                  {recuperacaoSucesso
                    ? 'Fechar'
                    : 'Cancelar'}
                </button>

                {!recuperacaoSucesso && (
                  <button
                    type="submit"
                    disabled={recuperacaoLoading}
                    style={{
                      minHeight:
                        '44px',

                      border:
                        'none',

                      borderRadius:
                        '9px',

                      background:
                        '#075eea',

                      color:
                        '#ffffff',

                      fontWeight:
                        800,

                      cursor:
                        recuperacaoLoading
                          ? 'not-allowed'
                          : 'pointer',

                      opacity:
                        recuperacaoLoading
                          ? 0.72
                          : 1
                    }}
                  >
                    {recuperacaoLoading
                      ? 'Enviando...'
                      : 'Solicitar recuperação'}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}

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