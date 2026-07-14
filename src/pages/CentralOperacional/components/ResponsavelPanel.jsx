import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarPatrimoniosResponsavel
} from '../../../services/responsabilidadeService'

import {
  nomeCategoria,
  obterIdentificadorPatrimonio,
  obterDescricaoPatrimonio,
  obterStatusPatrimonio,
  classeStatusPatrimonio
} from '../../../utils/centralPatrimonioUtils'

export default function ResponsavelPanel({
  re,
  nome,
  patrimonioAtual = null,
  onAbrirPatrimonio
}) {
  const [
    patrimonios,
    setPatrimonios
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    erro,
    setErro
  ] = useState('')

  async function carregar() {
    if (!re && !nome) {
      setPatrimonios([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErro('')

      const resultado =
        await listarPatrimoniosResponsavel({
          re,
          nome
        })

      setPatrimonios(resultado)
    } catch (error) {
      console.error(error)

      setErro(
        error?.message ||
          'Não foi possível carregar a carga patrimonial.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [re, nome])

  const quantidade =
    useMemo(
      () => patrimonios.length,
      [patrimonios]
    )

  return (
    <section className="central-detalhe-secao">

      <div className="central-secao-titulo">

        <div>

          <span>
            RESPONSABILIDADE
          </span>

          <h3>
            Carga Patrimonial
          </h3>

        </div>

        <strong>
          {quantidade}
        </strong>

      </div>

      <div className="central-responsavel-resumo">

        <div className="central-responsavel-avatar">

          {(nome || 'SR')
            .substring(0,2)
            .toUpperCase()}

        </div>

        <div>

          <strong>
            {nome || 'Sem responsável'}
          </strong>

          <span>
            {re ? `RE ${re}` : 'Sem RE'}
          </span>

        </div>

      </div>

      {loading && (
        <div className="central-estado">
          Carregando carga patrimonial...
        </div>
      )}

      {!loading && erro && (
        <div className="central-estado central-estado-erro">

          <strong>
            Erro ao consultar responsável
          </strong>

          <span>
            {erro}
          </span>

          <button
            type="button"
            onClick={carregar}
          >
            Atualizar
          </button>

        </div>
      )}

      {!loading &&
        !erro &&
        quantidade === 0 && (
          <div className="central-estado">
            Nenhum patrimônio localizado.
          </div>
        )}

      {!loading &&
        !erro &&
        quantidade > 0 && (

          <div className="central-responsabilidade-lista">

            {patrimonios.map(
              (patrimonio) => {

                const status =
                  obterStatusPatrimonio(
                    patrimonio
                  )

                const atual =
                  patrimonioAtual &&
                  String(patrimonio.id) ===
                  String(
                    patrimonioAtual.id
                  )

                return (

                  <button
                    type="button"
                    key={patrimonio.id}
                    className={
                      atual
                        ? 'central-responsabilidade-item atual'
                        : 'central-responsabilidade-item'
                    }
                    onClick={() =>
                      onAbrirPatrimonio?.(
                        patrimonio
                      )
                    }
                  >

                    <div className="central-responsabilidade-info">

                      <span>
                        {nomeCategoria(
                          patrimonio.tipo
                        )}
                      </span>

                      <strong>
                        {obterIdentificadorPatrimonio(
                          patrimonio
                        )}
                      </strong>

                      <small>
                        {obterDescricaoPatrimonio(
                          patrimonio
                        )}
                      </small>

                    </div>

                    <span
                      className={`central-status ${classeStatusPatrimonio(
                        status
                      )}`}
                    >
                      {status}
                    </span>

                  </button>

                )

              }
            )}

          </div>

        )}

    </section>
  )
}