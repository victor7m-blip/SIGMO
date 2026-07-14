import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  interpretarCodigoQr
} from '../../../services/qrScannerService'

import {
  registrarEventoTimelinePatrimonial
} from '../../../services/timelinePatrimonioService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function obterUsuario(user) {
  if (!user) {
    return {
      id: null,
      nome: 'Usuário SIGMO'
    }
  }

  return {
    id:
      user.id ||
      user.user_id ||
      null,

    nome:
      user.nome ||
      user.nome_completo ||
      user.user_metadata?.nome ||
      user.user_metadata?.full_name ||
      user.email ||
      'Usuário SIGMO'
  }
}

function obterIdentificador(patrimonio) {
  return (
    patrimonio?.identificador ||
    patrimonio?.numero_patrimonio ||
    patrimonio?.patrimonio ||
    patrimonio?.numero_serie ||
    patrimonio?.serie ||
    patrimonio?.referencia_id ||
    patrimonio?.id ||
    'Patrimônio'
  )
}

export default function QRScanner({
  patrimonio = null,
  user = null,
  onLeitura,
  onQrLido,
  disabled = false,
  desabilitado = false,
  registrarTimeline = true
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const frameRef = useRef(null)

  const cameraAtivaRef =
    useRef(false)

  const processandoRef =
    useRef(false)

  const [
    codigo,
    setCodigo
  ] = useState('')

  const [
    cameraAtiva,
    setCameraAtiva
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    processando,
    setProcessando
  ] = useState(false)

  const bloqueado =
    disabled ||
    desabilitado

  const pararCamera =
    useCallback(() => {
      cameraAtivaRef.current =
        false

      if (frameRef.current) {
        cancelAnimationFrame(
          frameRef.current
        )

        frameRef.current = null
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          )

        streamRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.srcObject =
          null
      }

      setCameraAtiva(false)
    }, [])

  const registrarEventoQr =
    useCallback(
      async ({
        tipo,
        titulo,
        descricao,
        codigoLido,
        leitura = null
      }) => {
        if (
          !registrarTimeline ||
          !patrimonio
        ) {
          return
        }

        const usuario =
          obterUsuario(user)

        await registrarEventoTimelinePatrimonial({
          patrimonioId:
            patrimonio.id,

          referenciaId:
            patrimonio.referencia_id,

          tipo,

          titulo,

          descricao,

          usuarioId:
            usuario.id,

          usuarioNome:
            usuario.nome,

          statusAtual:
            patrimonio.status,

          localAtual:
            patrimonio.local_atual ||
            patrimonio.local,

          dados: {
            codigo_lido:
              codigoLido,

            leitura,

            origem_leitura:
              'QR_SCANNER'
          }
        })
      },
      [
        patrimonio,
        registrarTimeline,
        user
      ]
    )

  const processar =
    useCallback(
      async (valor) => {
        const codigoNormalizado =
          texto(valor)

        if (
          !codigoNormalizado ||
          processandoRef.current ||
          bloqueado
        ) {
          return
        }

        try {
          processandoRef.current =
            true

          setProcessando(true)
          setErro('')

          const leitura =
            interpretarCodigoQr(
              codigoNormalizado
            )

          const resultado =
            await onLeitura?.({
              codigo:
                codigoNormalizado,

              leitura
            })

          await registrarEventoQr({
            tipo:
              'QRCODE_LIDO',

            titulo:
              'QR Code lido',

            descricao:
              'O QR Code do patrimônio foi lido pelo scanner.',

            codigoLido:
              codigoNormalizado,

            leitura
          })

          onQrLido?.({
            codigo:
              codigoNormalizado,

            leitura,

            resultado
          })

          setCodigo('')
        } catch (error) {
          console.error(
            'Erro ao processar QR Code:',
            error
          )

          const mensagem =
            error?.message ||
            'Falha ao interpretar o QR Code.'

          setErro(mensagem)

          try {
            await registrarEventoQr({
              tipo:
                'QRCODE_INVALIDO',

              titulo:
                'Leitura de QR inválida',

              descricao:
                mensagem,

              codigoLido:
                codigoNormalizado
            })
          } catch (
            timelineError
          ) {
            console.warn(
              'Não foi possível registrar a leitura inválida na timeline:',
              timelineError
            )
          }
        } finally {
          processandoRef.current =
            false

          setProcessando(false)
        }
      },
      [
        bloqueado,
        onLeitura,
        onQrLido,
        registrarEventoQr
      ]
    )

  const detectar =
    useCallback(
      async () => {
        if (
          !cameraAtivaRef.current ||
          !videoRef.current ||
          !detectorRef.current
        ) {
          return
        }

        try {
          if (
            videoRef.current
              .readyState >= 2 &&
            !processandoRef.current
          ) {
            const resultado =
              await detectorRef.current.detect(
                videoRef.current
              )

            const qr =
              resultado?.[0]
                ?.rawValue

            if (qr) {
              pararCamera()

              await processar(qr)

              return
            }
          }
        } catch (
          detectionError
        ) {
          console.warn(
            'Falha temporária na leitura da câmera:',
            detectionError
          )
        }

        if (
          cameraAtivaRef.current
        ) {
          frameRef.current =
            requestAnimationFrame(
              detectar
            )
        }
      },
      [
        pararCamera,
        processar
      ]
    )

  const abrirCamera =
    useCallback(
      async () => {
        if (bloqueado) {
          return
        }

        try {
          setErro('')

          if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
              .getUserMedia
          ) {
            throw new Error(
              'A câmera não está disponível neste dispositivo.'
            )
          }

          if (
            !(
              'BarcodeDetector'
              in window
            )
          ) {
            throw new Error(
              'O leitor automático de QR Code não é suportado neste navegador. Utilize o código manual.'
            )
          }

          detectorRef.current =
            new window.BarcodeDetector({
              formats: [
                'qr_code'
              ]
            })

          const stream =
            await navigator
              .mediaDevices
              .getUserMedia({
                video: {
                  facingMode: {
                    ideal:
                      'environment'
                  },

                  width: {
                    ideal: 1280
                  },

                  height: {
                    ideal: 720
                  }
                },

                audio: false
              })

          streamRef.current =
            stream

          if (!videoRef.current) {
            throw new Error(
              'Não foi possível preparar o vídeo da câmera.'
            )
          }

          videoRef.current.srcObject =
            stream

          await videoRef.current.play()

          cameraAtivaRef.current =
            true

          setCameraAtiva(true)

          frameRef.current =
            requestAnimationFrame(
              detectar
            )
        } catch (error) {
          console.error(
            'Erro ao abrir câmera:',
            error
          )

          pararCamera()

          setErro(
            error?.message ||
            'Não foi possível abrir a câmera.'
          )
        }
      },
      [
        bloqueado,
        detectar,
        pararCamera
      ]
    )

  useEffect(() => {
    if (bloqueado) {
      pararCamera()
    }
  }, [
    bloqueado,
    pararCamera
  ])

  useEffect(() => {
    return () => {
      pararCamera()
    }
  }, [pararCamera])

  return (
    <section className="central-detalhe-secao">
      <div className="central-secao-titulo">
        <div>
          <span>
            QR CODE
          </span>

          <h3>
            Scanner Patrimonial
          </h3>
        </div>

        {cameraAtiva && (
          <strong>
            Câmera ativa
          </strong>
        )}
      </div>

      {patrimonio && (
        <div className="central-qr-identificacao">
          <strong>
            {obterIdentificador(
              patrimonio
            )}
          </strong>

          <span>
            Escaneie um QR Code para localizar ou conferir outro patrimônio.
          </span>
        </div>
      )}

      <div className="central-qr-scanner">
        <div className="central-qr-scanner-acoes">
          {!cameraAtiva ? (
            <button
              type="button"
              className="central-botao-primario"
              onClick={
                abrirCamera
              }
              disabled={
                bloqueado ||
                processando
              }
            >
              Abrir câmera
            </button>
          ) : (
            <button
              type="button"
              className="central-botao-perigo"
              onClick={
                pararCamera
              }
            >
              Fechar câmera
            </button>
          )}
        </div>

        {cameraAtiva && (
          <div className="central-camera-box">
            <video
              ref={videoRef}
              playsInline
              muted
            />

            <div className="central-camera-mira">
              <span />
              <span />
              <span />
              <span />
            </div>

            <p>
              Posicione o QR Code dentro da moldura.
            </p>
          </div>
        )}

        <form
          className="central-qr-manual"
          onSubmit={(event) => {
            event.preventDefault()

            processar(codigo)
          }}
        >
          <label
            htmlFor="central-qr-codigo"
          >
            Código manual
          </label>

          <div>
            <input
              id="central-qr-codigo"
              type="text"
              value={codigo}
              onChange={(event) =>
                setCodigo(
                  event.target.value
                )
              }
              placeholder="Digite ou leia o QR Code"
              autoComplete="off"
              disabled={
                bloqueado ||
                processando
              }
            />

            <button
              type="submit"
              disabled={
                bloqueado ||
                !codigo.trim() ||
                processando
              }
            >
              {processando
                ? 'Lendo...'
                : 'Abrir'}
            </button>
          </div>
        </form>

        {erro && (
          <div className="central-scanner-erro">
            <strong>
              Falha na leitura
            </strong>

            <span>
              {erro}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}