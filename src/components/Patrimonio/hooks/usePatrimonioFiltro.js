import { useMemo } from 'react'
import { aplicarFiltros } from '../config/filterBuilder'
import { pesquisar } from '../config/searchBuilder'

export default function usePatrimonioFiltro(
    lista,
    busca,
    filtros
) {

    return useMemo(() => {

        let dados = pesquisar(lista, busca)

        dados = aplicarFiltros(dados, filtros)

        return dados

    }, [lista, busca, filtros])

}