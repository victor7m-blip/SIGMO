import { useState } from 'react'

export default function usePatrimonioModal() {

    const [aberto, setAberto] = useState(false)
    const [registro, setRegistro] = useState(null)

    function novo() {
        setRegistro(null)
        setAberto(true)
    }

    function editar(item) {
        setRegistro(item)
        setAberto(true)
    }

    function fechar() {
        setAberto(false)
        setRegistro(null)
    }

    return {

        aberto,

        registro,

        novo,

        editar,

        fechar

    }

}