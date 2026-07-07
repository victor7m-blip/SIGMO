export async function listar(service) {
    return await service.listar()
}

export async function obter(service, id) {
    return await service.obter(id)
}

export async function cadastrar(service, dados) {
    return await service.cadastrar(dados)
}

export async function atualizar(service, id, dados) {
    return await service.atualizar(id, dados)
}

export async function excluir(service, id) {
    return await service.excluir(id)
}