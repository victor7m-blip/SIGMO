import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarArmasCargaPessoal,
  solicitarDevolucaoCargaAoP4
} from '../../services/cargaPessoalService'

import './CargaPessoal.css'

function texto(valor, fallback = 'Não informado') {
  const v = String(valor ?? '').trim()
  return v || fallback
}

function nomeArma(arma) {
  return [
    arma?.especie,
    arma?.marca,
    arma?.modelo,
    arma?.calibre
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export default function CargaPessoal({
  user
}) {
  const [armas, setArmas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [devolvendoId, setDevolvendoId] = useState(null)

  async function carregar() {
    try {
      setLoading(true)
      setErro('')

      const lista =
        await listarArmasCargaPessoal(user)

      setArmas(lista)
    } catch (error) {
      console.error(
        'Erro ao carregar carga pessoal:',
        error
      )

      setArmas([])
      setErro(
        error?.message ||
        'Não foi possível carregar sua carga pessoal.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [user])

  const nomeUsuario = useMemo(
    () =>
      user?.nome_guerra ||
      user?.nome ||
      user?.nome_completo ||
      'Policial',
    [user]
  )

  async function devolverAoP4(arma) {
    const identificacao =
      arma?.numero_serie ||
      arma?.patrimonio ||
      'esta arma'

    const confirmou = window.confirm(
      `Confirma a devolução de ${identificacao} ao P4?\n\nA arma continuará vinculada à sua carga até a movimentação ser recebida pelo P4.`
    )

    if (!confirmou) return

    try {
      setDevolvendoId(arma.id)
      setErro('')
      setMensagem('')

      await solicitarDevolucaoCargaAoP4({
        arma,
        user
      })

      setMensagem(
        'Devolução enviada ao P4. A arma permanecerá na sua carga até o recebimento ser confirmado.'
      )
    } catch (error) {
      console.error(
        'Erro ao solicitar devolução ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a devolução ao P4.'
      )
    } finally {
      setDevolvendoId(null)
    }
  }

  return (
    <main className="carga-pessoal-page">
      <header className="carga-pessoal-header">
        <div>
          <span>CARGA PESSOAL</span>
          <h1>Materiais vinculados a você</h1>
          <p>
            Consulte equipamentos de carga permanente
            vinculados ao seu cadastro funcional.
          </p>
        </div>

        <div className="carga-pessoal-user">
          <small>RESPONSÁVEL</small>
          <strong>{nomeUsuario}</strong>
          {user?.re && (
            <span>RE {user.re}</span>
          )}
        </div>
      </header>

      <section className="carga-pessoal-resumo">
        <article>
          <span>Armas em carga</span>
          <strong>{armas.length}</strong>
          <small>Carga permanente ativa</small>
        </article>

        <article>
          <span>Outros equipamentos</span>
          <strong>0</strong>
          <small>
            Espaço preparado para novas integrações
          </small>
        </article>

        <article>
          <span>Fardamento</span>
          <strong>—</strong>
          <small>
            Histórico de entrega será integrado depois
          </small>
        </article>
      </section>

      {erro && (
        <div className="carga-pessoal-erro">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="carga-pessoal-sucesso">
          {mensagem}
        </div>
      )}

      <section className="carga-pessoal-painel">
        <div className="carga-pessoal-painel-titulo">
          <div>
            <span>ARMAS</span>
            <h2>Carga permanente</h2>
          </div>

          <button
            type="button"
            onClick={carregar}
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <div className="carga-pessoal-vazio">
            Carregando sua carga pessoal...
          </div>
        ) : armas.length === 0 ? (
          <div className="carga-pessoal-vazio">
            Nenhuma arma em carga permanente vinculada
            ao seu cadastro.
          </div>
        ) : (
          <div className="carga-pessoal-grid">
            {armas.map((arma) => (
              <article
                className="carga-pessoal-card"
                key={arma.id}
              >
                <div className="carga-pessoal-card-topo">
                  <div className="carga-pessoal-icone">
                    ▰
                  </div>

                  <div>
                    <span>
                      {texto(arma.especie, 'ARMA')}
                    </span>
                    <h3>
                      {nomeArma(arma) || 'Arma'}
                    </h3>
                  </div>

                  <b>CARGA</b>
                </div>

                <dl>
                  <div>
                    <dt>Patrimônio</dt>
                    <dd>
                      {texto(
                        arma.patrimonio,
                        arma.numero_serie
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Nº de série</dt>
                    <dd>
                      {texto(arma.numero_serie)}
                    </dd>
                  </div>

                  <div>
                    <dt>Acabamento</dt>
                    <dd>
                      {texto(arma.acabamento)}
                    </dd>
                  </div>

                  <div>
                    <dt>Situação</dt>
                    <dd>CARGA PERMANENTE</dd>
                  </div>
                </dl>

                <footer className="carga-pessoal-card-footer">
                  <span>
                    Este item permanece bloqueado para
                    edição enquanto estiver em carga.
                  </span>

                  <button
                    type="button"
                    className="carga-pessoal-devolver"
                    onClick={() => devolverAoP4(arma)}
                    disabled={devolvendoId === arma.id}
                  >
                    {devolvendoId === arma.id
                      ? 'Enviando...'
                      : 'Devolver ao P4'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
