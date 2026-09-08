import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarArmasCargaPessoal,
  solicitarDevolucaoCargaAoP4,
  solicitarDevolucaoColeteAoP4
} from '../../services/cargaPessoalService'

import {
  supabase
} from '../../services/supabaseClient'

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


function formatarData(valor) {
  if (!valor) return 'Não informado'

  const data = new Date(
    `${String(valor).slice(0, 10)}T12:00:00`
  )

  if (Number.isNaN(data.getTime())) {
    return 'Não informado'
  }

  return data.toLocaleDateString('pt-BR')
}

function formatarModelagem(valor) {
  const v = String(valor || '')
    .trim()
    .toUpperCase()

  if (v === 'PADRAO') {
    return 'PADRÃO'
  }

  return v || 'Não informado'
}

async function listarColetesCargaPessoal(user) {
  const policialId =
    user?.id ||
    user?.policial_id ||
    user?.id_policial ||
    null

  if (!policialId) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_patrimonios')
    .select(
      'id, referencia_id, numero_patrimonio, numero_serie, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados'
    )
    .eq('tipo', 'colete_balistico')
    .eq('status', 'CARGA')
    .eq('local_atual', 'CARGA PERMANENTE')
    .eq('responsavel_atual_id', policialId)
    .eq('ativo', true)
    .order('numero_patrimonio', {
      ascending: true
    })

  if (error) {
    throw error
  }

  return (data || []).map((item) => {
    const dados =
      item?.dados &&
      typeof item.dados === 'object'
        ? item.dados
        : {}

    return {
      ...dados,
      patrimonio_id: item.id,
      referencia_id: item.referencia_id,
      patrimonio:
        item.numero_patrimonio ||
        dados.patrimonio ||
        null,
      numero_serie:
        item.numero_serie ||
        dados.numero_serie ||
        null,
      status:
        item.status ||
        dados.status ||
        'CARGA',
      local_atual:
        item.local_atual ||
        dados.local_atual ||
        'CARGA PERMANENTE',
      responsavel_atual_id:
        item.responsavel_atual_id ||
        null,
      responsavel_atual_nome:
        item.responsavel_atual_nome ||
        null
    }
  })
}

export default function CargaPessoal({
  user
}) {
  const [armas, setArmas] = useState([])
  const [coletes, setColetes] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [devolvendoId, setDevolvendoId] = useState(null)

  async function carregar() {
    try {
      setLoading(true)
      setErro('')

      const [
        listaArmas,
        listaColetes
      ] = await Promise.all([
        listarArmasCargaPessoal(user),
        listarColetesCargaPessoal(user)
      ])

      setArmas(listaArmas || [])
      setColetes(listaColetes || [])
    } catch (error) {
      console.error(
        'Erro ao carregar carga pessoal:',
        error
      )

      setArmas([])
      setColetes([])
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


  async function devolverColeteAoP4(colete) {
    const identificacao =
      colete?.patrimonio ||
      colete?.numero_serie ||
      'este colete'

    const confirmou = window.confirm(
      `Confirma a devolução de ${identificacao} ao P4?\n\nO colete continuará vinculado à sua carga até a movimentação ser recebida pelo P4.`
    )

    if (!confirmou) return

    const idDevolucao =
      colete?.patrimonio_id ||
      colete?.referencia_id ||
      colete?.patrimonio

    try {
      setDevolvendoId(idDevolucao)
      setErro('')
      setMensagem('')

      await solicitarDevolucaoColeteAoP4({
        colete,
        user
      })

      setMensagem(
        'Devolução do colete enviada ao P4. O material permanecerá na sua carga até o recebimento ser confirmado.'
      )
    } catch (error) {
      console.error(
        'Erro ao solicitar devolução do colete ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a devolução do colete ao P4.'
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
          <strong>{coletes.length}</strong>
          <small>
            Coletes balísticos em carga
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

      <section className="carga-pessoal-painel">
        <div className="carga-pessoal-painel-titulo">
          <div>
            <span>COLETE BALÍSTICO</span>
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
            Carregando coletes...
          </div>
        ) : coletes.length === 0 ? (
          <div className="carga-pessoal-vazio">
            Nenhum colete balístico em carga permanente
            vinculado ao seu cadastro.
          </div>
        ) : (
          <div className="carga-pessoal-grid">
            {coletes.map((colete) => (
              <article
                className="carga-pessoal-card"
                key={
                  colete.patrimonio_id ||
                  colete.referencia_id ||
                  colete.patrimonio
                }
              >
                <div className="carga-pessoal-card-topo">
                  <div className="carga-pessoal-icone">
                    🦺
                  </div>

                  <div>
                    <span>
                      COLETE BALÍSTICO
                    </span>

                    <h3>
                      {[
                        texto(
                          colete.fabricante,
                          ''
                        ),
                        texto(
                          colete.nivel_protecao,
                          ''
                        )
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                        'Colete balístico'}
                    </h3>
                  </div>

                  <b>CARGA</b>
                </div>

                <dl>
                  <div>
                    <dt>Patrimônio</dt>
                    <dd>
                      {texto(
                        colete.patrimonio
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Nº de série</dt>
                    <dd>
                      {texto(
                        colete.numero_serie
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Lote</dt>
                    <dd>
                      {texto(
                        colete.numero_lote
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Sexo</dt>
                    <dd>
                      {texto(
                        colete.sexo
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Tamanho</dt>
                    <dd>
                      {[
                        texto(
                          colete.tamanho,
                          ''
                        ),
                        formatarModelagem(
                          colete.modelagem
                        )
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </dd>
                  </div>

                  <div>
                    <dt>Nível</dt>
                    <dd>
                      {texto(
                        colete.nivel_protecao
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Validade</dt>
                    <dd>
                      {formatarData(
                        colete.validade
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Situação</dt>
                    <dd>
                      CARGA PERMANENTE
                    </dd>
                  </div>
                </dl>

                <footer className="carga-pessoal-card-footer">
                  <span>
                    Colete balístico vinculado à sua carga
                    individual pelo P4.
                  </span>

                  <button
                    type="button"
                    className="carga-pessoal-devolver"
                    onClick={() =>
                      devolverColeteAoP4(colete)
                    }
                    disabled={
                      devolvendoId ===
                      (
                        colete?.patrimonio_id ||
                        colete?.referencia_id ||
                        colete?.patrimonio
                      )
                    }
                  >
                    {devolvendoId ===
                    (
                      colete?.patrimonio_id ||
                      colete?.referencia_id ||
                      colete?.patrimonio
                    )
                      ? 'Enviando...'
                      : 'Devolver ao P4'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
      </section>
    </main>
  )
}
