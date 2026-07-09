import { useEffect, useState } from 'react'
import './PatrimonioFotos.css'

export default function PatrimonioFotos({ config, item }) {
  const [fotos, setFotos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [fotoAberta, setFotoAberta] = useState(null)

  useEffect(() => {
    async function carregar() {
      if (!config?.fotos?.listar || !item?.id) {
        setFotos([])
        return
      }

      try {
        setCarregando(true)
        setErro('')
        const lista = await config.fotos.listar(item.id)
        setFotos(lista || [])
      } catch (err) {
        console.error(err)
        setErro(err.message || 'Erro ao carregar fotos.')
      } finally {
        setCarregando(false)
      }
    }

    carregar()
  }, [config, item])

  return (
    <section className="patrimonio-section">
      <header>
        <h3>Fotos</h3>
        <p>Fotos vinculadas ao patrimônio.</p>
      </header>

      {carregando && <div className="patrimonio-empty-box">Carregando fotos...</div>}
      {erro && <div className="patrimonio-empty-box">{erro}</div>}

      {!carregando && !erro && fotos.length === 0 && (
        <div className="patrimonio-empty-box">
          Nenhuma foto cadastrada para este item.
        </div>
      )}

      {!carregando && !erro && fotos.length > 0 && (
        <div className="patrimonio-fotos-grid">
          {fotos.map((foto) => (
            <button
              key={foto.id}
              type="button"
              className="patrimonio-foto-button"
              onClick={() => setFotoAberta(foto)}
            >
              <img src={foto.url} alt="Foto da arma" className="patrimonio-foto" />
            </button>
          ))}
        </div>
      )}

      {fotoAberta && (
        <div className="patrimonio-foto-modal" onClick={() => setFotoAberta(null)}>
          <div className="patrimonio-foto-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="patrimonio-foto-modal-close"
              onClick={() => setFotoAberta(null)}
            >
              Fechar
            </button>

            <img src={fotoAberta.url} alt="Foto ampliada" />
          </div>
        </div>
      )}
    </section>
  )
}