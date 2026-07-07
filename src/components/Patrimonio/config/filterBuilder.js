export function aplicarFiltros(lista, filtros={}) {

    return lista.filter(item=>{

        return Object.entries(filtros).every(([campo,valor])=>{

            if(!valor) return true

            return item[campo]===valor

        })

    })

}