import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { saveSession } from '../services/auth'
import { registerAudit } from '../services/audit'
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

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const reLimpo = re.trim()
    const pinLimpo = pin.trim()

    console.log('1 - Clicou no login', { reLimpo, pinLimpo })

    if (!reLimpo || !pinLimpo) {
      setError('Informe o RE e o PIN.')
      setLoading(false)
      return
    }

    const { data: policial, error: policialError } = await supabase
      .from('policiais')
      .select('*')
      .eq('re', reLimpo)
      .maybeSingle()

    console.log('2 - Resultado policial:', policial, policialError)

    if (policialError) {
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

    console.log('3 - Resultado usuário:', usuario, usuarioError)

    if (usuarioError) {
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
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      user_id: usuario.id
    }

    console.log('4 - Sessão criada:', sessionUser)

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
    setLoading(false)
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
        <form onSubmit={handleLogin}>
          <label>RE / Matrícula</label>
          <input
            value={re}
            onChange={(e) => setRe(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Digite o RE"
            maxLength={6}
            inputMode="numeric"
          />

          <label>PIN</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Digite o PIN"
            maxLength={6}
            inputMode="numeric"
          />

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
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
              cursor: 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  )
}