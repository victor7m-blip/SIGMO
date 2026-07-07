import { useEffect, useState } from 'react'

export default function usePatrimonio(service) {

    const [lista, setLista] = useState([])
    const [loading, setLoading] = useState(true)

    async function carregar() {

        setLoading(true)

        const dados = await service.listar()

        setLista(dados)

        setLoading(false)

    }

    useEffect(() => {

        carregar()

    }, [])

    return {

        lista,

        loading,

        recarregar: carregar,

        setLista

    }

}