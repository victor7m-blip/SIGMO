import {
  useMemo,
  useState
} from 'react'

export default function GaleriaFotos({
  patrimonio = null,
  fotos = [],
  titulo = 'Galeria Patrimonial'
}) {

  const [
    fotoAtual,
    setFotoAtual
  ] = useState(0)

  const lista =
    useMemo(
      ()=>fotos.filter(Boolean),
      [fotos]
    )

  function abrir(indice){
    setFotoAtual(indice)
  }

  function fechar(){
    setFotoAtual(-1)
  }

  function anterior(e){
    e.stopPropagation()

    setFotoAtual(atual=>
      atual<=0
        ? lista.length-1
        : atual-1
    )
  }

  function proxima(e){
    e.stopPropagation()

    setFotoAtual(atual=>
      atual>=lista.length-1
        ?0
        :atual+1
    )
  }

  return(

<section className="central-detalhe-secao">

<div className="central-secao-titulo">

<div>

<span>

FOTOS

</span>

<h3>

{titulo}

</h3>

</div>

<strong>

{lista.length}

</strong>

</div>

{patrimonio && (

<div className="central-galeria-info">

<strong>

{patrimonio.identificador ||
 patrimonio.numero_patrimonio ||
 patrimonio.patrimonio}

</strong>

<span>

Registro fotográfico do patrimônio

</span>

</div>

)}

{lista.length===0 && (

<div className="central-estado">

Nenhuma foto cadastrada.

</div>

)}

{lista.length>0 && (

<div className="central-galeria">

{lista.map((foto,index)=>(

<button
type="button"
key={`${foto}-${index}`}
className="central-galeria-item"
onClick={()=>abrir(index)}
>

<img
src={foto}
alt={`Foto ${index+1}`}
/>

<div>

Foto {index+1}

</div>

</button>

))}

</div>

)}

{fotoAtual>=0 &&
lista[fotoAtual] && (

<div
className="central-foto-modal"
onClick={fechar}
>

<button
type="button"
className="central-foto-modal-fechar"
onClick={fechar}
>

×

</button>

<button
type="button"
className="central-foto-anterior"
onClick={anterior}
>

‹

</button>

<img
src={lista[fotoAtual]}
alt={`Foto ${fotoAtual+1}`}
onClick={e=>e.stopPropagation()}
/>

<button
type="button"
className="central-foto-proxima"
onClick={proxima}
>

›

</button>

<div className="central-foto-indice">

{fotoAtual+1} / {lista.length}

</div>

</div>

)}

</section>

  )

}