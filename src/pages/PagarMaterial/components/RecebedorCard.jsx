import { useEffect, useState } from 'react'
import { listarPoliciais } from '../../../services/policiaisService'

function obterNome(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    ''
  )
}

export default function RecebedorCard({
  re,
  onChangeRE,
  onSelecionado
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [policial, setPolicial] = useState(null)

  useEffect(() => {
    const numero = String(re || '').replace(/\D/g, '')

    if (numero.length < 6) {
      setPolicial(null)
      setErro('')
      onSelecionado?.(null)
      return
    }

    const timer = setTimeout(buscar, 300)

    return () => clearTimeout(timer)

    async function buscar() {
      try {
        setLoading(true)
        setErro('')

        const resultado = await listarPoliciais({
          filtros: {
            re: numero
          },
          pagina: 1,
          limite: 20
        })

        const lista = resultado?.data || []

        const encontrado =
          lista.find((p) =>
            String(p.re || '')
              .replace(/\D/g, '')
              .startsWith(numero)
          ) || null

        if (!encontrado) {
          setPolicial(null)
          setErro('Policial não encontrado.')
          onSelecionado?.(null)
          return
        }

        setPolicial(encontrado)
        onSelecionado?.(encontrado)
      } finally {
        setLoading(false)
      }
    }
  }, [re])

  return (
    <section className="pm-recebedor-card">

      <label>

        RE

        <input
          value={re}
          maxLength={6}
          inputMode="numeric"
          placeholder="000000"
          onChange={(e) =>
            onChangeRE(
              e.target.value.replace(/\D/g, '')
            )
          }
        />

      </label>

      {loading && (
        <div className="pm-loading">
          Pesquisando...
        </div>
      )}

      {erro && (
        <div className="pm-error">
          {erro}
        </div>
      )}

      {policial && (

        <div className="pm-policial">

          <div className="pm-avatar">

            {policial.foto_url ? (
              <img
                src={policial.foto_url}
                alt=""
              />
            ) : (
              <span>
                {obterNome(policial)
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}

          </div>

          <div className="pm-info">

            <strong>
              {obterNome(policial)}
            </strong>

            <div>
              {policial.posto_graduacao}
            </div>

            <div>
              {policial.companhia}
            </div>

            <div>
              {policial.pelotao}
            </div>

            <small>
              {policial.situacao}
            </small>

          </div>

        </div>

      )}

    </section>
  )
}