import {
  useMemo,
  useState
} from 'react'

import {
  cancelarConferencia,
  finalizarConferencia,
  iniciarConferencia,
  montarResumoConferencia,
  registrarLeituraConferencia
} from '../../../services/conferenciaService'

import {
  encontrarPatrimonioPorQr
} from '../../../services/qrScannerService'

import {
  dataHora,
  nomeCategoria,
  obterDescricaoPatrimonio,
  obterIdentificadorPatrimonio,
  obterLocalPatrimonio
} from '../../../utils/centralPatrimonioUtils'

import QRScanner from './QRScanner'

function ResultadoLeitura({
  resultado
}) {
  if (!resultado) return null

  const classe =
    resultado.tipo === 'ERRO'
      ? 'central-leitura-erro'
      : resultado.tipo === 'DUPLICADA'
      ? 'central-leitura-aviso'
      : 'central-leitura-sucesso'

  return (
    <div className={`central-leitura-resultado ${classe}`}>

      <strong>

        {resultado.tipo === 'ERRO'
          ? 'Patrimônio não encontrado'
          : resultado.tipo === 'DUPLICADA'
          ? 'QR já conferido'
          : 'Patrimônio conferido'}

      </strong>

      <span>

        {resultado.mensagem ||
          (resultado.patrimonio
            ? obterIdentificadorPatrimonio(
                resultado.patrimonio
              )
            : '')}

      </span>

      {resultado.patrimonio && (

        <small>

          {obterDescricaoPatrimonio(
            resultado.patrimonio
          )}

        </small>

      )}

    </div>
  )
}

export default function ConferenciaPanel({
  categoria,
  patrimonios=[],
  user,
  onFechar
}){

const[
conferencia,
setConferencia
]=useState(null)

const[
resultadoLeitura,
setResultadoLeitura
]=useState(null)

const[
resumoFinal,
setResumoFinal
]=useState(null)

const resumo=useMemo(
()=>montarResumoConferencia(conferencia),
[conferencia]
)

const patrimonioMap=useMemo(()=>{

const map=new Map()

patrimonios.forEach(item=>{

if(item.id)
map.set(String(item.id),item)

if(item.referencia_id)
map.set(String(item.referencia_id),item)

})

return map

},[patrimonios])

const leituras=useMemo(()=>{

return(
conferencia?.leituras??[]
)

.map(item=>({

...item,

patrimonio:
patrimonioMap.get(
String(item.patrimonio_id)
)||
patrimonioMap.get(
String(item.referencia_id)
)

}))

.reverse()

},[
conferencia,
patrimonioMap
])

function iniciar(){

const nova=iniciarConferencia({

categoria:categoria?.tipo,

local:categoria?.local,

usuario:user,

patrimoniosEsperados:patrimonios

})

setConferencia(nova)

setResultadoLeitura(null)

setResumoFinal(null)

}

function registrar({codigo}){

const patrimonio=
encontrarPatrimonioPorQr({

codigo,

patrimonios

})

if(!patrimonio){

setResultadoLeitura({

tipo:'ERRO',

mensagem:'QR não pertence a esta conferência.'

})

return

}

const resultado=

registrarLeituraConferencia({

conferenciaId:
conferencia.id,

patrimonio,

codigoLido:codigo

})

setConferencia({

...resultado.conferencia

})

setResultadoLeitura({

tipo:
resultado.duplicada
?'DUPLICADA'
:'SUCESSO',

patrimonio

})

}

function finalizar(){

const resultado=

finalizarConferencia(

conferencia.id

)

setConferencia({

...resultado.conferencia

})

setResumoFinal(resultado)

}

function cancelar(){

cancelarConferencia(

conferencia.id

)

setConferencia(null)

setResultadoLeitura(null)

setResumoFinal(null)

onFechar?.()

}

return(

<section className="central-detalhe-secao">

<div className="central-secao-titulo">

<div>

<span>

CONFERÊNCIA

</span>

<h3>

Conferência Física

</h3>

</div>

</div>

{!conferencia &&(

<div className="central-conferencia-start">

<h4>

{nomeCategoria(
categoria?.tipo
)}

</h4>

<p>

{patrimonios.length} patrimônios previstos.

</p>

<button
className="central-botao-primario"
onClick={iniciar}
>

Iniciar Conferência

</button>

</div>

)}

{conferencia &&
!resumoFinal &&(

<>

<div className="central-conferencia-resumo">

<article>

<span>Esperados</span>

<strong>

{resumo.totalEsperado}

</strong>

</article>

<article>

<span>Encontrados</span>

<strong>

{resumo.encontrados}

</strong>

</article>

<article>

<span>Ausentes</span>

<strong>

{resumo.ausentes}

</strong>

</article>

<article>

<span>Excedentes</span>

<strong>

{resumo.excedentes}

</strong>

</article>

</div>

<div className="central-conferencia-barra">

<div
style={{
width:`${resumo.percentual}%`
}}
/>

</div>

<QRScanner
onLeitura={registrar}
/>

<ResultadoLeitura
resultado={resultadoLeitura}
/>

<div className="central-leituras-lista">

{leituras.map(item=>(

<article
key={item.id}
>

<div>

<strong>

{item.patrimonio
?obterIdentificadorPatrimonio(item.patrimonio)
:item.codigo_lido}

</strong>

<span>

{item.patrimonio
?obterDescricaoPatrimonio(item.patrimonio)
:'Patrimônio externo'}

</span>

<small>

{item.patrimonio
?obterLocalPatrimonio(item.patrimonio)
:''}

</small>

</div>

<div>

<span>

{item.esperado
?'Esperado'
:'Excedente'}

</span>

<small>

{dataHora(item.lido_em)}

</small>

</div>

</article>

))}

</div>

<div className="central-conferencia-acoes">

<button
className="central-botao-secundario"
onClick={cancelar}
>

Cancelar

</button>

<button
className="central-botao-primario"
onClick={finalizar}
>

Finalizar

</button>

</div>

</>

)}

{resumoFinal &&(

<div className="central-conferencia-final">

<h3>

Conferência Finalizada

</h3>

<p>

{dataHora(
resumoFinal.conferencia.finalizado_em
)}

</p>

<div className="central-conferencia-resumo">

<article>

<span>Esperados</span>

<strong>

{resumoFinal.totalEsperado}

</strong>

</article>

<article>

<span>Encontrados</span>

<strong>

{resumoFinal.encontrados}

</strong>

</article>

<article>

<span>Ausentes</span>

<strong>

{resumoFinal.ausentes}

</strong>

</article>

<article>

<span>Excedentes</span>

<strong>

{resumoFinal.excedentes}

</strong>

</article>

</div>

<button
className="central-botao-primario"
onClick={onFechar}
>

Fechar

</button>

</div>

)}

</section>

)

}