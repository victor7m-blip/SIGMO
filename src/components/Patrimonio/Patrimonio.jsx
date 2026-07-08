import PatrimonioHeader from './PatrimonioHeader'
import PatrimonioSearch from './PatrimonioSearch'
import PatrimonioActions from './PatrimonioActions'
import PatrimonioTable from './PatrimonioTable'
import PatrimonioEmpty from './PatrimonioEmpty'
import PatrimonioLoading from './PatrimonioLoading'

export default function Patrimonio({
    titulo,
    subtitulo,

    loading,

    dados = [],

    filtros,

    colunas,

    onPesquisar,

    onNovo,

    onEditar,

    onExcluir,

    onVisualizar
}) {

    return (

        <>

            <PatrimonioHeader
                titulo={titulo}
                subtitulo={subtitulo}
            />

            <PatrimonioSearch
                filtros={filtros}
                onPesquisar={onPesquisar}
            />

            <PatrimonioActions
                onNovo={onNovo}
            />

            {loading
                ? <PatrimonioLoading />

                : dados.length === 0

                    ? <PatrimonioEmpty />

                    : (
                        <PatrimonioTable
                            dados={dados}
                            colunas={colunas}
                            onEditar={onEditar}
                            onExcluir={onExcluir}
                            onVisualizar={onVisualizar}
                        />
                    )}

        </>

    )

}