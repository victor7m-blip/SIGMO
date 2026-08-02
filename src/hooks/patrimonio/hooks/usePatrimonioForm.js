import { useState } from 'react'
import { patrimonioBaseFields } from '../patrimonioConfig'
import {
  normalizarPatrimonio,
  validarPatrimonioBasico
} from '../utils/patrimonioUtils'

export function usePatrimonioForm(initialValues = {}) {
  const [form, setForm] = useState({
    ...patrimonioBaseFields,
    ...initialValues
  })

  const [erro, setErro] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  function setField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  function validar() {
    const dados = normalizarPatrimonio(form)
    const erroValidacao = validarPatrimonioBasico(dados)

    setErro(erroValidacao)

    return {
      valido: !erroValidacao,
      dados,
      erro: erroValidacao
    }
  }

  function reset(novosDados = {}) {
    setForm({
      ...patrimonioBaseFields,
      ...novosDados
    })
    setErro('')
  }

  return {
    form,
    erro,
    setErro,
    setForm,
    setField,
    handleChange,
    validar,
    reset
  }
}