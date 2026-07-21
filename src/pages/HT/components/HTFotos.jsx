import {
  useCallback,
  useEffect,
  useState
} from 'react'

import HTFotoCard from './HTFotoCard'

import {
  definirFotoPrincipalHT,
  excluirFotoHT,
  listarFotosHT,
  uploadFotoHT
} from '../../../services/htsFotosService'

import "../styles/HTFotos.css";
import "../styles/HTFotoCard.css";

const MAX_FOTOS = 5

export default function HTFotos({
  user,
  htId,
  fotoPrincipalAtual = '',
  onFotoPrincipalAlterada
}) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] =
    useState(false)

  const [uploading, setUploading] =
    useState(false)

  const [processandoId, setProcessandoId] =
    useState(null)

  const [erro, setErro] = useState('')

  const carregarFotos = useCallback(
    async () => {
      if (!htId) {
        setFotos([])
        return
      }

      try {
        setLoading(true)
        setErro('')

        const resultado =
          await listarFotosHT(htId)

        setFotos(resultado || [])

        const principal =
          resultado?.find(
            (foto) => foto.principal
          )

        if (
          principal?.url &&
          principal.url !== fotoPrincipalAtual
        ) {
          onFotoPrincipalAlterada?.(
            principal.url
          )
        }
      } catch (error) {
        console.error(error)

        setErro(
          error.message ||
            'Erro ao carregar as fotos do HT.'
        )
      } finally {
        setLoading(false)
      }
    },
    [
      htId,
      fotoPrincipalAtual,
      onFotoPrincipalAlterada
    ]
  )

  useEffect(() => {
    carregarFotos()
  }, [carregarFotos])

  async function handleUpload(event) {
    const input = event.target

    const arquivos = Array.from(
      input.files || []
    )

    input.value = ''

    if (!arquivos.length) return

    if (!htId) {
      setErro(
        'Salve o HT antes de adicionar fotos.'
      )

      return
    }

    if (
      fotos.length + arquivos.length >
      MAX_FOTOS
    ) {
      setErro(
        `O limite é de ${MAX_FOTOS} fotos por HT.`
      )

      return
    }

    try {
      setUploading(true)
      setErro('')

      let primeiraFotoEnviada = null

      for (const arquivo of arquivos) {
        validarArquivo(arquivo)

        const deveSerPrincipal =
          fotos.length === 0 &&
          primeiraFotoEnviada === null

        const foto =
          await uploadFotoHT(
            arquivo,
            htId,
            user,
            deveSerPrincipal
          )

        if (!primeiraFotoEnviada) {
          primeiraFotoEnviada = foto
        }

        if (
          foto?.principal &&
          foto?.url
        ) {
          onFotoPrincipalAlterada?.(
            foto.url
          )
        }
      }

      await carregarFotos()
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao enviar a foto do HT.'
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleExcluir(foto) {
    const confirmou =
      window.confirm(
        'Deseja realmente excluir esta foto?'
      )

    if (!confirmou) return

    try {
      setProcessandoId(foto.id)
      setErro('')

      const resultado =
        await excluirFotoHT(
          foto,
          user
        )

      await carregarFotos()

      if (foto.principal) {
        onFotoPrincipalAlterada?.(
          resultado?.novaPrincipalUrl ||
            ''
        )
      }
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao excluir a foto.'
      )
    } finally {
      setProcessandoId(null)
    }
  }

  async function handleDefinirPrincipal(
    foto
  ) {
    if (foto.principal) return

    try {
      setProcessandoId(foto.id)
      setErro('')

      const principal =
        await definirFotoPrincipalHT(
          foto,
          user
        )

      onFotoPrincipalAlterada?.(
        principal?.url || foto.url
      )

      await carregarFotos()
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao definir a foto principal.'
      )
    } finally {
      setProcessandoId(null)
    }
  }

  const envioBloqueado =
    !htId ||
    uploading ||
    loading ||
    fotos.length >= MAX_FOTOS

  return (
    <section className="ht-fotos-box">
      <div className="ht-fotos-header">
        <div>
          <h3>Fotos do HT</h3>

          <p>
            Adicione até {MAX_FOTOS} fotos.
            Selecione uma delas como principal.
          </p>
        </div>

        <label
          className={[
            'ht-fotos-upload-button',
            envioBloqueado
              ? 'disabled'
              : ''
          ].join(' ')}
        >
          {uploading
            ? 'Enviando...'
            : '+ Adicionar fotos'}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={handleUpload}
            disabled={envioBloqueado}
          />
        </label>
      </div>

      {!htId && (
        <div className="ht-fotos-info">
          Salve os dados do HT para liberar
          o envio de fotos.
        </div>
      )}

      {erro && (
        <div className="ht-fotos-error">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="ht-fotos-empty">
          Carregando fotos...
        </div>
      ) : (
        <div className="ht-fotos-grid">
          {fotos.map((foto) => (
            <HTFotoCard
              key={foto.id}
              foto={foto}
              disabled={
                uploading ||
                processandoId === foto.id
              }
              onExcluir={handleExcluir}
              onDefinirPrincipal={
                handleDefinirPrincipal
              }
            />
          ))}

          {fotos.length === 0 && (
            <div className="ht-fotos-empty">
              Nenhuma foto cadastrada.
            </div>
          )}
        </div>
      )}

      <div className="ht-fotos-counter">
        {fotos.length} de {MAX_FOTOS}{' '}
        fotos cadastradas
      </div>
    </section>
  )
}

function validarArquivo(arquivo) {
  const tiposPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ]

  if (
    !tiposPermitidos.includes(
      arquivo.type
    )
  ) {
    throw new Error(
      `O arquivo "${arquivo.name}" não possui um formato permitido. Use JPG, PNG ou WEBP.`
    )
  }

  const limiteBytes =
    5 * 1024 * 1024

  if (arquivo.size > limiteBytes) {
    throw new Error(
      `O arquivo "${arquivo.name}" ultrapassa o limite de 5 MB.`
    )
  }
}