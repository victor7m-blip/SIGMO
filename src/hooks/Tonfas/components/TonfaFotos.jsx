import {
  useCallback,
  useEffect,
  useState
} from 'react'

import TonfaFotoCard from './TonfaFotoCard'

import {
  definirFotoPrincipalTonfa,
  excluirFotoTonfa,
  listarFotosTonfa,
  uploadFotoTonfa
} from '../../../services/tonfasFotosService'

import "../styles/TonfaFotos.css";
import "../styles/TonfaFotoCard.css";

const MAX_FOTOS = 5

export default function TonfaFotos({
  user,
  tonfaId,
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
      if (!tonfaId) {
        setFotos([])
        return
      }

      try {
        setLoading(true)
        setErro('')

        const resultado =
          await listarFotosTonfa(tonfaId)

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
            'Erro ao carregar as fotos do Tonfa.'
        )
      } finally {
        setLoading(false)
      }
    },
    [
      tonfaId,
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

    if (!tonfaId) {
      setErro(
        'Salve o Tonfa antes de adicionar fotos.'
      )

      return
    }

    if (
      fotos.length + arquivos.length >
      MAX_FOTOS
    ) {
      setErro(
        `O limite é de ${MAX_FOTOS} fotos por Tonfa.`
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
          await uploadFotoTonfa(
            arquivo,
            tonfaId,
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
          'Erro ao enviar a foto do Tonfa.'
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
        await excluirFotoTonfa(
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
        await definirFotoPrincipalTonfa(
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
    !tonfaId ||
    uploading ||
    loading ||
    fotos.length >= MAX_FOTOS

  return (
    <section className="tonfa-fotos-box">
      <div className="tonfa-fotos-header">
        <div>
          <h3>Fotos do Tonfa</h3>

          <p>
            Adicione até {MAX_FOTOS} fotos.
            Selecione uma delas como principal.
          </p>
        </div>

        <label
          className={[
            'tonfa-fotos-upload-button',
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

      {!tonfaId && (
        <div className="tonfa-fotos-info">
          Salve os dados do Tonfa para liberar
          o envio de fotos.
        </div>
      )}

      {erro && (
        <div className="tonfa-fotos-error">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="tonfa-fotos-empty">
          Carregando fotos...
        </div>
      ) : (
        <div className="tonfa-fotos-grid">
          {fotos.map((foto) => (
            <TonfaFotoCard
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
            <div className="tonfa-fotos-empty">
              Nenhuma foto cadastrada.
            </div>
          )}
        </div>
      )}

      <div className="tonfa-fotos-counter">
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