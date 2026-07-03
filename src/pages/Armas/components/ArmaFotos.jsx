import { useEffect, useState } from 'react'
import {
  uploadFotoArma,
  listarFotosArma,
  excluirFotoArma
} from '../../../services/armasFotosService'

const MAX_FOTOS = 5

export default function ArmaFotos({ armaId, user }) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function carregarFotos() {
    if (!armaId) return

    try {
      const data = await listarFotosArma(armaId)
      setFotos(data || [])
    } catch (error) {
      setErro('Erro ao carregar fotos da arma.')
    }
  }

  useEffect(() => {
    carregarFotos()
  }, [armaId])

  async function handleUpload(event) {
    const arquivos = Array.from(event.target.files || [])

    if (!armaId) {
      setErro('Salve a arma antes de adicionar fotos.')
      return
    }

    if (fotos.length + arquivos.length > MAX_FOTOS) {
      setErro(`Limite máximo de ${MAX_FOTOS} fotos por arma.`)
      return
    }

    try {
      setLoading(true)
      setErro('')

      for (const file of arquivos) {
        await uploadFotoArma(file, armaId, user)
      }

      await carregarFotos()
      event.target.value = ''
    } catch (error) {
      setErro('Erro ao enviar foto.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcluir(foto) {
    const confirmar = window.confirm('Deseja excluir esta foto?')
    if (!confirmar) return

    try {
      setLoading(true)
      await excluirFotoArma(foto.id, foto.caminho)
      await carregarFotos()
    } catch (error) {
      setErro('Erro ao excluir foto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="arma-fotos-box">
      <div className="arma-fotos-header">
        <div>
          <h3>Fotos da arma</h3>
          <p>Adicione até {MAX_FOTOS} fotos opcionais.</p>
        </div>

        <label className="btn-secondary">
          + Adicionar foto
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleUpload}
            disabled={loading || fotos.length >= MAX_FOTOS}
          />
        </label>
      </div>

      {erro && <div className="form-error">{erro}</div>}

      <div className="arma-fotos-grid">
        {fotos.map((foto) => (
          <div className="arma-foto-card" key={foto.id}>
            <img src={foto.url} alt="Foto da arma" />

            <button
              type="button"
              className="btn-danger-small"
              onClick={() => handleExcluir(foto)}
              disabled={loading}
            >
              Excluir
            </button>
          </div>
        ))}

        {fotos.length === 0 && (
          <div className="arma-fotos-empty">
            Nenhuma foto cadastrada.
          </div>
        )}
      </div>
    </section>
  )
}