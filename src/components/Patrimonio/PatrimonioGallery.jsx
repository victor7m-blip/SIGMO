export default function PatrimonioGallery({
    fotos = [],
    onOpen
}) {

    if (!fotos.length)
        return null

    return (
        <div className="gallery">

            {fotos.map((foto,index)=>(
                <img
                    key={index}
                    src={foto}
                    alt=""
                    onClick={()=>onOpen(foto)}
                />
            ))}

        </div>
    )
}