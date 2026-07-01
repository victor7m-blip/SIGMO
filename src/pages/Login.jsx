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

  if (!re.trim() || !pin.trim()) {
    setError('Informe o RE e o PIN.')
    return
  }

  setLoading(true)

  // 1 - Procura o policial pelo RE
  const { data: policial, error: policialError } = await supabase
    .from('policiais')
    .select('*')
    .eq('re', re.trim())
    .maybeSingle()

  if (policialError) {
    setLoading(false)
    console.error(policialError)
    setError('Erro ao consultar policiais.')
    return
  }

  if (!policial) {
    setLoading(false)
    setError('RE não encontrado.')
    return
  }

  // 2 - Procura o login desse policial
  const { data: usuario, error: usuarioError } = await supabase
    .from('sigmo_users')
    .select('*')
    .eq('policial_id', policial.id)
    .eq('pin', pin.trim())
    .eq('ativo', true)
    .maybeSingle()

  setLoading(false)

  if (usuarioError) {
    console.error(usuarioError)
    setError('Erro ao validar o PIN.')
    return
  }

  if (!usuario) {
    setError('PIN incorreto ou usuário inativo.')
    return
  }

  const sessionUser = {
    ...policial,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    user_id: usuario.id
  }

  await registerAudit(
    'LOGIN',
    'Usuário acessou o SIGMO.',
    sessionUser,
    'Login'
  )

  saveSession(sessionUser)
  onLogin(sessionUser)
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
  onChange={(e) => setPin(e.target.value.slice(0, 6))}
  placeholder="Digite o PIN"
  maxLength={6}
/>

          {error && <div className="error">{error}</div>}

          <button className="primary-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  )
}