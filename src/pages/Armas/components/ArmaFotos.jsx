import { useEffect, useState } from 'react'
import {
  uploadFotoArma,
  listarFotosArma,
  excluirFotoArma,
  definirFotoPrincipalArma
} from '../../../services/armasFotosService'
import ArmaFotoCard from './ArmaFotoCard'

const MAX_FOTOS = 5

export default function ArmaFotos({ armaId, user, onFotosChange }) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function carregarFotos() {
    if (!armaId) {
      setFotos([])
      setErro('')
      return
    }

    try {
      setErro('')
      const data = await listarFotosArma(armaId)
      setFotos(data)

      if (onFotosChange) {
        onFotosChange(data)
      }
    } catch (error) {
      console.error(error)
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
      event.target.value = ''
      return
    }

    if (!arquivos.length) return

    if (fotos.length + arquivos.length > MAX_FOTOS) {
      setErro(`Limite máximo de ${MAX_FOTOS} fotos por arma.`)
      event.target.value = ''
      return
    }

    try {
      setLoading(true)
      setErro('')

      const deveSerPrincipal = fotos.length === 0

      for (let index = 0; index < arquivos.length; index++) {
        await uploadFotoArma(
          arquivos[index],
          armaId,
          user,
          deveSerPrincipal && index === 0
        )
      }

      await carregarFotos()
      event.target.value = ''
    } catch (error) {
      console.error(error)
      setErro('Erro ao enviar foto da arma.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDefinirPrincipal(foto) {
    try {
      setLoading(true)
      setErro('')

      await definirFotoPrincipalArma(foto)
      await carregarFotos()
    } catch (error) {
      console.error(error)
      setErro('Erro ao definir foto principal.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcluir(foto) {
    const confirmar = window.confirm('Deseja excluir esta foto?')
    if (!confirmar) return

    try {
      setLoading(true)
      setErro('')

      await excluirFotoArma(foto)
      await carregarFotos()
    } catch (error) {
      console.error(error)
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
          <p>Adicione até {MAX_FOTOS} fotos. A primeira será a principal.</p>
        </div>

        <label className="btn-secondary">
          + Adicionar fotos
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
          <ArmaFotoCard
            key={foto.id}
            foto={foto}
            onExcluir={handleExcluir}
            onDefinirPrincipal={handleDefinirPrincipal}
            disabled={loading}
          />
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