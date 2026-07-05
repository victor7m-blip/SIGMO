import { useEffect, useState } from 'react'
import {
  uploadFotoPolicial,
  listarFotosPolicial,
  excluirFotoPolicial
} from '../../../services/policiaisFotosService'

export default function PolicialFotos({ policialId, user }) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregarFotos()
  }, [policialId])

  async function carregarFotos() {
    try {
      setLoading(true)
      setErro('')

      const data = await listarFotosPolicial(policialId)
      setFotos(data || [])
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar fotos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(event) {
    const arquivos = Array.from(event.target.files || [])
    if (!arquivos.length) return

    try {
      setLoading(true)
      setErro('')

      for (const arquivo of arquivos) {
        await uploadFotoPolicial(arquivo, policialId, user)
      }

      event.target.value = ''
      await carregarFotos()
    } catch (error) {
      console.error(error)
      setErro('Erro ao enviar foto.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcluir(foto) {
    const confirmar = window.confirm('Excluir esta foto?')
    if (!confirmar) return

    try {
      setLoading(true)
      setErro('')

      await excluirFotoPolicial(foto.id, foto.caminho)
      await carregarFotos()
    } catch (error) {
      console.error(error)
      setErro('Erro ao excluir foto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="policiais-fotos-box">
      <div className="policiais-fotos-header">
        <div>
          <strong>Fotos do policial</strong>
          <span>Envie imagens para identificação funcional.</span>
        </div>

        <label className="policiais-upload-btn">
          Enviar fotos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            hidden
          />
        </label>
      </div>

      {erro && <p className="policiais-feedback policiais-feedback-error">{erro}</p>}
      {loading && <p className="policiais-feedback">Carregando fotos...</p>}

      <div className="policiais-fotos-grid">
        {fotos.map((foto) => (
          <div className="policiais-foto-card" key={foto.id}>
            <img src={foto.url} alt="Foto do policial" />

            <button type="button" onClick={() => handleExcluir(foto)}>
              Excluir
            </button>
          </div>
        ))}

        {!loading && fotos.length === 0 && (
          <p className="policiais-empty-fotos">Nenhuma foto cadastrada.</p>
        )}
      </div>
    </div>
  )
}