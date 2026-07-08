export default function PatrimonioSearch({

    filtros,

    onPesquisar

}) {

    return (

        <div className="search-panel">

            {filtros}

            <button
                onClick={onPesquisar}
            >

                Pesquisar

            </button>

        </div>

    )

}