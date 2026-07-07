import PatrimonioToolbar from './PatrimonioToolbar'
import PatrimonioFilters from './PatrimonioFilters'

export default function PatrimonioPage({

    toolbar,

    filtros,

    tabela,

    modal

}) {

    return (

        <>

            <PatrimonioToolbar {...toolbar} />

            <PatrimonioFilters {...filtros} />

            {tabela}

            {modal}

        </>

    )

}