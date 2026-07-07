export function pesquisar(lista,texto=''){

    if(!texto) return lista

    texto=texto.toLowerCase()

    return lista.filter(item=>

        JSON.stringify(item)

            .toLowerCase()

            .includes(texto)

    )

}