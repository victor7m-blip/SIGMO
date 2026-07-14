import {
  useEffect,
  useRef,
  useState
} from 'react'

import {
  interpretarCodigoQr
} from '../../../services/qrScannerService'

export default function QRScanner({
  patrimonio = null,
  onLeitura,
  disabled = false
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const frameRef = useRef(null)

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

  function pararCamera() {

    if (frameRef.current) {
      cancelAnimationFrame(
        frameRef.current
      )
      frameRef.current = null
    }

    if (streamRef.current) {

      streamRef.current
        .getTracks()
        .forEach(track => track.stop())

      streamRef.current = null

    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraAtiva(false)

  }

  async function processar(valor) {

    const texto =
      String(valor || '').trim()

    if (
      !texto ||
      processando ||
      disabled
    ) {
      return
    }

    try {

      setErro('')
      setProcessando(true)

      const leitura =
        interpretarCodigoQr(
          texto
        )

      await onLeitura?.({
        codigo: texto,
        leitura
      })

      setCodigo('')

    } catch (e) {

      console.error(e)

      setErro(
        e?.message ||
        'Falha ao interpretar QR.'
      )

    } finally {

      setProcessando(false)

    }

  }

  async function detectar() {

    if (
      !cameraAtiva ||
      !videoRef.current ||
      !detectorRef.current
    ) {
      return
    }

    try {

      if (
        videoRef.current.readyState >= 2
      ) {

        const resultado =
          await detectorRef.current.detect(
            videoRef.current
          )

        const qr =
          resultado?.[0]?.rawValue

        if (qr) {

          pararCamera()

          await processar(qr)

          return

        }

      }

    } catch {}

    frameRef.current =
      requestAnimationFrame(
        detectar
      )

  }

  async function abrirCamera() {

    try {

      setErro('')

      if (
        !('BarcodeDetector' in window)
      ) {
        throw new Error(
          'Leitor QR não suportado.'
        )
      }

      detectorRef.current =
        new window.BarcodeDetector({
          formats:['qr_code']
        })

      const stream =
        await navigator.mediaDevices.getUserMedia({

          video:{
            facingMode:{
              ideal:'environment'
            }
          },

          audio:false

        })

      streamRef.current =
        stream

      videoRef.current.srcObject =
        stream

      await videoRef.current.play()

      setCameraAtiva(true)

    } catch(e){

      console.error(e)

      pararCamera()

      setErro(
        e?.message ||
        'Erro ao abrir câmera.'
      )

    }

  }

  useEffect(()=>{

    if(cameraAtiva){

      frameRef.current =
        requestAnimationFrame(
          detectar
        )

    }

    return ()=>{

      if(frameRef.current){

        cancelAnimationFrame(
          frameRef.current
        )

      }

    }

  },[
    cameraAtiva
  ])

  useEffect(()=>{

    return pararCamera

  },[])

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

</div>

{patrimonio && (

<div className="central-qr-identificacao">

<strong>

{patrimonio.identificador ||
 patrimonio.numero_patrimonio ||
 patrimonio.patrimonio}

</strong>

<span>

Escaneie outro QR para abrir um patrimônio diferente.

</span>

</div>

)}

<div className="central-qr-scanner">

<div className="central-qr-scanner-acoes">

{!cameraAtiva ? (

<button
type="button"
className="central-botao-primario"
onClick={abrirCamera}
disabled={
disabled ||
processando
}
>

Abrir câmera

</button>

) : (

<button
type="button"
className="central-botao-perigo"
onClick={pararCamera}
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

<span/>
<span/>
<span/>
<span/>

</div>

<p>

Posicione o QR dentro da moldura.

</p>

</div>

)}

<form
className="central-qr-manual"
onSubmit={(e)=>{

e.preventDefault()

processar(codigo)

}}
>

<label>

Código manual

</label>

<div>

<input

type="text"

value={codigo}

onChange={(e)=>
setCodigo(
e.target.value
)
}

placeholder="Digite ou leia o QR"

disabled={
disabled ||
processando
}

/>

<button
type="submit"
disabled={
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

{erro}

</div>

)}

</div>

</section>

  )

}