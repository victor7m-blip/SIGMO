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
      setError('Informe RE e PIN.')
      return
    }

    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('sigmo_users')
      .select('*')
      .eq('re', re.trim())
      .eq('pin', pin.trim())
      .eq('situacao', 'Ativo')
      .maybeSingle()

    setLoading(false)

    if (queryError) {
      console.error(queryError)
      setError('Erro ao consultar o banco.')
      return
    }

    if (!data) {
      setError('Usuário não encontrado, PIN incorreto ou usuário inativo.')
      return
    }

    await registerAudit('LOGIN', 'Usuário acessou o SIGMO.', data, 'Login')
    saveSession(data)
    onLogin(data)
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
          <input value={re} onChange={(e) => setRe(e.target.value)} placeholder="Digite o RE" />

          <label>PIN</label>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Digite o PIN" />

          {error && <div className="error">{error}</div>}

          <button className="primary-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  )
}