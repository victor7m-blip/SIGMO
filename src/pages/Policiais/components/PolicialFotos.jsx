import { useEffect, useMemo, useState } from 'react'
import {
  uploadFotoPolicial,
  listarFotosPolicial,
  excluirFotoPolicial,
  definirFotoPrincipal
} from '../../../services/policiaisFotosService'
import PolicialFotoCard from './PolicialFotoCard'

export default function PolicialFotos({
  policialId,
  user,
  somenteLeitura = false,
  onFotoPrincipalChange
}) {
  const [fotos, setFotos] = useState([])
  const [fotoSelecionada, setFotoSelecionada] = useState(null)
  const [arquivo, setArquivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const fotoPrincipal = useMemo(() => {
    return fotos.find((foto) => foto.principal) || fotos[0] || null
  }, [fotos])

  async function carregarFotos() {
    if (!policialId) return

    try {
      setErro('')
      setLoading(true)

      const data = await listarFotosPolicial(policialId)

      setFotos(data)

      const principal = data.find((foto) => foto.principal) || data[0] || null

      setFotoSelecionada((atual) => {
        if (!atual) return principal
        return data.find((foto) => foto.id === atual.id) || principal
      })

      onFotoPrincipalChange?.(principal?.url || null)
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao carregar fotos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarFotos()
  }, [policialId])

  async function handleUpload(event) {
    event.preventDefault()

    if (!arquivo) {
      setErro('Selecione uma foto antes de enviar.')
      return
    }

    try {
      setErro('')
      setLoading(true)

      const novaFoto = await uploadFotoPolicial(arquivo, policialId, user)

      setArquivo(null)
      event.target.reset()

      await carregarFotos()

      if (novaFoto?.principal) {
        onFotoPrincipalChange?.(novaFoto.url)
      }
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao enviar foto.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDefinirPrincipal(foto) {
    try {
      setErro('')
      setLoading(true)

      const atualizada = await definirFotoPrincipal(policialId, foto.id, foto.url)

      await carregarFotos()
      setFotoSelecionada(atualizada)
      onFotoPrincipalChange?.(atualizada.url)
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao definir foto principal.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExcluir(foto) {
    const confirmar = window.confirm('Deseja excluir esta foto?')

    if (!confirmar) return

    try {
      setErro('')
      setLoading(true)

      await excluirFotoPolicial(foto, policialId)
      await carregarFotos()
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao excluir foto.')
    } finally {
      setLoading(false)
    }
  }

  if (!policialId) {
    return (
      <div className="policial-fotos-box">
        <p className="policial-fotos-empty">
          Salve o policial antes de adicionar fotos.
        </p>
      </div>
    )
  }

  return (
    <div className="policial-fotos-box">
      <div className="policial-fotos-header">
        <div>
          <h3>Fotos do policial</h3>
          <p>
            A foto principal será exibida na tabela, no modal e futuramente na credencial.
          </p>
        </div>
      </div>

      {erro && (
        <div className="form-error">
          {erro}
        </div>
      )}

      {fotoPrincipal && (
        <div className="policial-foto-destaque">
          <img
            src={(fotoSelecionada || fotoPrincipal).url}
            alt="Foto selecionada do policial"
          />

          <div>
            <strong>
              {(fotoSelecionada || fotoPrincipal).principal
                ? 'Foto principal'
                : 'Foto selecionada'}
            </strong>

            {!somenteLeitura && fotoSelecionada && !fotoSelecionada.principal && (
              <button
                type="button"
                onClick={() => handleDefinirPrincipal(fotoSelecionada)}
                disabled={loading}
              >
                Usar como principal
              </button>
            )}
          </div>
        </div>
      )}

      {!somenteLeitura && (
        <form className="policial-fotos-upload" onSubmit={handleUpload}>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setArquivo(event.target.files?.[0] || null)}
            disabled={loading}
          />

          <button type="submit" disabled={loading || !arquivo}>
            {loading ? 'Enviando...' : 'Enviar foto'}
          </button>
        </form>
      )}

      {loading && fotos.length === 0 && (
        <p className="policial-fotos-empty">
          Carregando fotos...
        </p>
      )}

      {!loading && fotos.length === 0 && (
        <p className="policial-fotos-empty">
          Nenhuma foto cadastrada.
        </p>
      )}

      {fotos.length > 0 && (
        <div className="policial-fotos-grid">
          {fotos.map((foto) => (
            <PolicialFotoCard
              key={foto.id}
              foto={foto}
              selecionada={fotoSelecionada?.id === foto.id}
              onSelecionar={setFotoSelecionada}
              onDefinirPrincipal={somenteLeitura ? null : handleDefinirPrincipal}
              onExcluir={somenteLeitura ? null : handleExcluir}
              disabled={loading}
            />
          ))}
        </div>
      )}
    </div>
  )
}