import { useEffect, useState } from 'react'
import './PatrimonioFotos.css'

export default function PatrimonioFotos({ config, item }) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [fotoAtual, setFotoAtual] = useState(null)

  useEffect(() => {
    carregarFotos()
  }, [item?.id])

  async function carregarFotos() {
    if (!config?.fotos?.listar || !item?.id) {
      setFotos([])
      return
    }

    try {
      setLoading(true)
      setErro('')

      const lista = await config.fotos.listar(item.id)

      setFotos(lista || [])
    } catch (err) {
      console.error(err)
      setErro(err.message || 'Erro ao carregar fotos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="patrimonio-section">

      <header>

        <h3>Fotos</h3>

        <p>Fotos cadastradas deste patrimônio.</p>

      </header>

      {loading && (
        <div className="patrimonio-empty-box">
          Carregando fotos...
        </div>
      )}

      {!loading && erro && (
        <div className="patrimonio-empty-box">
          {erro}
        </div>
      )}

      {!loading && !erro && fotos.length === 0 && (
        <div className="patrimonio-empty-box">
          Nenhuma foto cadastrada.
        </div>
      )}

      {!loading && !erro && fotos.length > 0 && (

        <div className="patrimonio-fotos-grid">

          {fotos.map((foto) => (

            <button
              key={foto.id}
              type="button"
              className="patrimonio-foto-button"
              onClick={() => setFotoAtual(foto)}
            >

              <img
                src={foto.url}
                alt="Foto"
                className="patrimonio-foto"
              />

            </button>

          ))}

        </div>

      )}

      {fotoAtual && (

        <div
          className="patrimonio-foto-modal"
          onClick={() => setFotoAtual(null)}
        >

          <div
            className="patrimonio-foto-modal-card"
            onClick={(e) => e.stopPropagation()}
          >

            <button
              type="button"
              className="patrimonio-foto-modal-close"
              onClick={() => setFotoAtual(null)}
            >
              Fechar
            </button>

            <img
              src={fotoAtual.url}
              alt="Foto ampliada"
            />

          </div>

        </div>

      )}

    </section>
  )
}