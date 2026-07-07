export async function salvar(service, item) {

    if (item.id) {

        return await service.atualizar(item.id, item)

    }

    return await service.cadastrar(item)

}

export async function remover(service, id) {

    return await service.excluir(id)

}