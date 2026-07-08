export default function PatrimonioHeader({

    titulo,

    subtitulo

}) {

    return (

        <header className="page-header">

            <h1>{titulo}</h1>

            <p>{subtitulo}</p>

        </header>

    )

}