import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { saveSession } from '../services/authService'
import { registerAudit } from '../services/auditoriaService'
import backgroundDesktop from '../assets/SIGMO_01_Login.png'
import backgroundMobile from '../assets/SIGMO_01_Login_Mobile.png'

export default function Login({ onLogin }) {
  const [re, setRe] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [background, setBackground] = useState(backgroundDesktop)

  useEffect(() => {
    function updateBackground() {
      setBackground(window.innerWidth <= 768 ? backgroundMobile : backgroundDesktop)
    }

    updateBackground()
    window.addEventListener('resize', updateBackground)

    return () => window.removeEventListener('resize', updateBackground)
  }, [])

  function limparNumero(value, max = 6) {
    return String(value || '').replace(/\D/g, '').slice(0, max)
  }

  function handleChangeRE(e) {
    setRe(limparNumero(e.target.value, 6))
  }

  function handleChangePIN(e) {
    setPin(limparNumero(e.target.value, 6))
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const reLimpo = limparNumero(re, 6)
    const pinLimpo = limparNumero(pin, 6)

    if (!reLimpo || !pinLimpo) {
      setError('Informe o RE e o PIN.')
      setLoading(false)
      return
    }

    try {
      const { data: policial, error: policialError } = await supabase
        .from('policiais')
        .select('*')
        .ilike('re', `${reLimpo}-%`)
        .maybeSingle()

      if (policialError) {
        console.error(policialError)
        setError('Erro ao consultar policial.')
        setLoading(false)
        return
      }

      if (!policial) {
        setError('RE não encontrado.')
        setLoading(false)
        return
      }

      const { data: usuario, error: usuarioError } = await supabase
        .from('sigmo_users')
        .select('*')
        .eq('policial_id', policial.id)
        .eq('pin', Number(pinLimpo))
        .eq('ativo', true)
        .maybeSingle()

      if (usuarioError) {
        console.error(usuarioError)
        setError('Erro ao validar usuário.')
        setLoading(false)
        return
      }

      if (!usuario) {
        setError('PIN incorreto ou usuário inativo.')
        setLoading(false)
        return
      }

      const sessionUser = {
        id: policial.id,
        re: policial.re,
        nome: policial.nome,
        nome_guerra: policial.nome_guerra,
        posto_graduacao: policial.posto_graduacao,
        companhia: policial.companhia,
        pelotao: policial.pelotao,
        perfil: usuario.perfil,
        ativo: usuario.ativo,
        user_id: usuario.id
      }

      try {
        await registerAudit(
          'LOGIN',
          'Usuário acessou o SIGMO.',
          sessionUser,
          'Login'
        )
      } catch (auditError) {
        console.error('Erro ao registrar auditoria:', auditError)
      }

      saveSession(sessionUser)
      onLogin(sessionUser)
    } catch (err) {
      console.error(err)
      setError('Erro inesperado ao acessar o SIGMO.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#030913'
      }}
    >
      <section className="login-card">
        <form onSubmit={handleLogin} autoComplete="off">
          <label>RE</label>
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

          <label>PIN</label>
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

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              height: '48px',
              marginTop: '20px',
              background: '#075eea',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  )
}