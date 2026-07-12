import { useEffect, useRef, useState } from 'react'

import './PatrimonioFotos.css'

export default function PatrimonioFotos({ config, item }) {
  const inputRef = useRef(null)

  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [fotoAtual, setFotoAtual] = useState(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!config?.fotos?.listar || !item?.id) {
        setFotos([])
        return
      }

      try {
        setLoading(true)
        setErro('')

        const lista = await config.fotos.listar(item.id)

        if (ativo) {
          setFotos(Array.isArray(lista) ? lista : [])
        }
      } catch (error) {
        console.error(error)

        if (ativo) {
          setErro(error.message || 'Erro ao carregar fotos.')
          setFotos([])
        }
      } finally {
        if (ativo) {
          setLoading(false)
        }
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [config, item?.id])

  async function carregarFotos() {
    if (!config?.fotos?.listar || !item?.id) {
      setFotos([])
      return
    }

    try {
      setLoading(true)
      setErro('')

      const lista = await config.fotos.listar(item.id)

      setFotos(Array.isArray(lista) ? lista : [])
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao carregar fotos.')
      setFotos([])
    } finally {
      setLoading(false)
    }
  }

  function selecionarArquivos() {
    inputRef.current?.click()
  }

  async function enviarFotos(event) {
    const arquivos = Array.from(event.target.files || [])

    event.target.value = ''

    if (!arquivos.length) return

    if (!item?.id) {
      setErro('Salve o patrimônio antes de adicionar fotos.')
      return
    }

    if (!config?.fotos?.upload) {
      setErro('O envio de fotos não está configurado para este módulo.')
      return
    }

    try {
      setEnviando(true)
      setErro('')

      for (const arquivo of arquivos) {
        if (!arquivo.type.startsWith('image/')) {
          throw new Error(
            `O arquivo "${arquivo.name}" não é uma imagem válida.`
          )
        }

        await config.fotos.upload(
          arquivo,
          item.id,
          null,
          fotos.length === 0
        )
      }

      await carregarFotos()
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao enviar fotos.')
    } finally {
      setEnviando(false)
    }
  }

  async function definirPrincipal(foto) {
    if (!config?.fotos?.definirPrincipal) return

    try {
      setErro('')

      await config.fotos.definirPrincipal(foto)
      await carregarFotos()

      setFotoAtual((atual) => {
        if (!atual || atual.id !== foto.id) return atual

        return {
          ...atual,
          principal: true
        }
      })
    } catch (error) {
      console.error(error)
      setErro(
        error.message ||
        'Erro ao definir a foto principal.'
      )
    }
  }

  async function excluirFoto(foto) {
    if (!config?.fotos?.excluir) return

    const confirmar = window.confirm(
      'Deseja realmente excluir esta foto?'
    )

    if (!confirmar) return

    try {
      setErro('')

      await config.fotos.excluir(foto)

      if (fotoAtual?.id === foto.id) {
        setFotoAtual(null)
      }

      await carregarFotos()
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao excluir foto.')
    }
  }

  async function baixarFoto(foto) {
    try {
      setErro('')

      if (config?.fotos?.baixar) {
        await config.fotos.baixar(foto)
        return
      }

      const link = document.createElement('a')

      link.href = foto.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.download = ''

      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao baixar foto.')
    }
  }

  return (
    <section className="patrimonio-section patrimonio-fotos-section">
      <header className="patrimonio-section-header">
        <div>
          <h3>Fotos</h3>
          <p>
            Fotos cadastradas deste patrimônio.
          </p>
        </div>

        {config?.fotos?.upload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={enviarFotos}
            />

            <button
              type="button"
              className="patrimonio-fotos-upload-btn"
              onClick={selecionarArquivos}
              disabled={enviando || !item?.id}
            >
              {enviando
                ? 'Enviando...'
                : 'Adicionar fotos'}
            </button>
          </>
        )}
      </header>

      {erro && (
        <div className="patrimonio-fotos-alert">
          {erro}
        </div>
      )}

      {loading && (
        <div className="patrimonio-empty-box">
          Carregando fotos...
        </div>
      )}

      {!loading && fotos.length === 0 && (
        <div className="patrimonio-empty-box">
          <div className="patrimonio-fotos-empty-content">
            <strong>Nenhuma foto cadastrada</strong>

            <span>
              Adicione fotos para documentar o estado e a
              identificação deste patrimônio.
            </span>

            {config?.fotos?.upload && (
              <button
                type="button"
                onClick={selecionarArquivos}
                disabled={enviando}
              >
                Adicionar primeira foto
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && fotos.length > 0 && (
        <div className="patrimonio-fotos-grid">
          {fotos.map((foto) => (
            <article
              key={foto.id}
              className={`patrimonio-foto-card ${
                foto.principal
                  ? 'patrimonio-foto-card-principal'
                  : ''
              }`}
            >
              <button
                type="button"
                className="patrimonio-foto-button"
                onClick={() => setFotoAtual(foto)}
              >
                <img
                  src={foto.url}
                  alt="Foto do patrimônio"
                  className="patrimonio-foto"
                />

                {foto.principal && (
                  <span className="patrimonio-foto-principal-badge">
                    Principal
                  </span>
                )}
              </button>

              <div className="patrimonio-foto-actions">
                {!foto.principal &&
                  config?.fotos?.definirPrincipal && (
                    <button
                      type="button"
                      onClick={() =>
                        definirPrincipal(foto)
                      }
                    >
                      Tornar principal
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => baixarFoto(foto)}
                >
                  Baixar
                </button>

                {config?.fotos?.excluir && (
                  <button
                    type="button"
                    className="patrimonio-foto-delete"
                    onClick={() => excluirFoto(foto)}
                  >
                    Excluir
                  </button>
                )}
              </div>
            </article>
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
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="patrimonio-foto-modal-header">
              <div>
                <strong>
                  Foto do patrimônio
                </strong>

                {fotoAtual.principal && (
                  <span>Foto principal</span>
                )}
              </div>

              <button
                type="button"
                className="patrimonio-foto-modal-close"
                onClick={() => setFotoAtual(null)}
              >
                Fechar
              </button>
            </div>

            <img
              src={fotoAtual.url}
              alt="Foto ampliada do patrimônio"
            />

            <div className="patrimonio-foto-modal-actions">
              {!fotoAtual.principal &&
                config?.fotos?.definirPrincipal && (
                  <button
                    type="button"
                    onClick={() =>
                      definirPrincipal(fotoAtual)
                    }
                  >
                    Tornar principal
                  </button>
                )}

              <button
                type="button"
                onClick={() =>
                  baixarFoto(fotoAtual)
                }
              >
                Baixar foto
              </button>

              {config?.fotos?.excluir && (
                <button
                  type="button"
                  className="patrimonio-foto-delete"
                  onClick={() =>
                    excluirFoto(fotoAtual)
                  }
                >
                  Excluir foto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}