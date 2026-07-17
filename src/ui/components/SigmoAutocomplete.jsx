import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import './SigmoAutocomplete.css'

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
}

function prepararOption(option) {
  if (typeof option === 'string') {
    return {
      value: option,
      label: option
    }
  }

  return {
    value:
      option.value ??
      option.nome ??
      '',

    label:
      option.label ??
      option.nome ??
      option.value ??
      ''
  }
}

export default function SigmoAutocomplete({
  label,
  name,
  value = '',
  onChange,
  onBlur,
  options = [],
  placeholder = '',
  disabled = false,
  required = false,
  loading = false,
  emptyMessage = 'Nenhuma sugestão encontrada.',
  maxSuggestions = 8
}) {
  const [aberto, setAberto] =
    useState(false)

  const [indiceAtivo, setIndiceAtivo] =
    useState(-1)

  const containerRef =
    useRef(null)

  const valorNormalizado =
    normalizarTexto(value)

  const sugestoes = useMemo(() => {
    const lista = options
      .map(prepararOption)
      .filter(
        (option) =>
          option.value &&
          option.label
      )

    if (!valorNormalizado) {
      return lista.slice(
        0,
        maxSuggestions
      )
    }

    const iniciamCom = []
    const contem = []

    lista.forEach((option) => {
      const labelNormalizado =
        normalizarTexto(
          option.label
        )

      if (
        labelNormalizado.startsWith(
          valorNormalizado
        )
      ) {
        iniciamCom.push(option)
        return
      }

      if (
        labelNormalizado.includes(
          valorNormalizado
        )
      ) {
        contem.push(option)
      }
    })

    return [
      ...iniciamCom,
      ...contem
    ].slice(0, maxSuggestions)
  }, [
    options,
    valorNormalizado,
    maxSuggestions
  ])

  useEffect(() => {
    function handleClickFora(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target
        )
      ) {
        setAberto(false)
        setIndiceAtivo(-1)
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickFora
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickFora
      )
    }
  }, [])

  useEffect(() => {
    setIndiceAtivo(
      sugestoes.length > 0
        ? 0
        : -1
    )
  }, [
    valorNormalizado,
    sugestoes.length
  ])

  function emitirAlteracao(
    novoValor
  ) {
    onChange?.({
      target: {
        name,
        value: novoValor
      }
    })
  }

  function selecionarSugestao(
    option
  ) {
    if (!option) return

    emitirAlteracao(option.value)

    setAberto(false)
    setIndiceAtivo(-1)
  }

  function handleInputChange(event) {
    emitirAlteracao(
      event.target.value
    )

    setAberto(true)
  }

  function handleFocus() {
    if (disabled) return

    setAberto(true)
  }

  function handleBlur(event) {
    onBlur?.(event)
  }

  function handleKeyDown(event) {
    if (
      event.key === 'Escape'
    ) {
      setAberto(false)
      setIndiceAtivo(-1)
      return
    }

    if (
      event.key === 'ArrowDown'
    ) {
      event.preventDefault()

      if (!aberto) {
        setAberto(true)
        return
      }

      setIndiceAtivo((indice) => {
        if (
          sugestoes.length === 0
        ) {
          return -1
        }

        return indice >=
          sugestoes.length - 1
          ? 0
          : indice + 1
      })

      return
    }

    if (
      event.key === 'ArrowUp'
    ) {
      event.preventDefault()

      if (!aberto) {
        setAberto(true)
        return
      }

      setIndiceAtivo((indice) => {
        if (
          sugestoes.length === 0
        ) {
          return -1
        }

        return indice <= 0
          ? sugestoes.length - 1
          : indice - 1
      })

      return
    }

    if (
      event.key === 'Enter' &&
      aberto &&
      indiceAtivo >= 0
    ) {
      event.preventDefault()

      selecionarSugestao(
        sugestoes[indiceAtivo]
      )

      return
    }

    if (
      event.key === 'Tab' &&
      aberto &&
      sugestoes.length > 0 &&
      valorNormalizado
    ) {
      selecionarSugestao(
        sugestoes[
          indiceAtivo >= 0
            ? indiceAtivo
            : 0
        ]
      )
    }
  }

  return (
    <div
      className="sigmo-autocomplete"
      ref={containerRef}
    >
      {label && (
        <label
          className="sigmo-autocomplete-label"
          htmlFor={name}
        >
          {label}

          {required && (
            <span aria-hidden="true">
              {' '}*
            </span>
          )}
        </label>
      )}

      <div className="sigmo-autocomplete-control">
        <input
          id={name}
          name={name}
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={aberto}
        />

        <button
          type="button"
          className="sigmo-autocomplete-toggle"
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            if (!disabled) {
              setAberto(
                (atual) => !atual
              )
            }
          }}
          disabled={disabled}
          aria-label={
            aberto
              ? 'Fechar sugestões'
              : 'Abrir sugestões'
          }
        >
          ▾
        </button>
      </div>

      {aberto && !disabled && (
        <div
          className="sigmo-autocomplete-menu"
          role="listbox"
        >
          {loading && (
            <div className="sigmo-autocomplete-message">
              Carregando sugestões...
            </div>
          )}

          {!loading &&
            sugestoes.length === 0 && (
              <div className="sigmo-autocomplete-message">
                {emptyMessage}
              </div>
            )}

          {!loading &&
            sugestoes.map(
              (option, index) => {
                const ativa =
                  index === indiceAtivo

                return (
                  <button
                    key={
                      `${name}-${option.value}`
                    }
                    type="button"
                    role="option"
                    aria-selected={ativa}
                    className={
                      ativa
                        ? 'sigmo-autocomplete-option active'
                        : 'sigmo-autocomplete-option'
                    }
                    onMouseEnter={() =>
                      setIndiceAtivo(index)
                    }
                    onMouseDown={(
                      event
                    ) => {
                      event.preventDefault()

                      selecionarSugestao(
                        option
                      )
                    }}
                  >
                    {option.label}
                  </button>
                )
              }
            )}
        </div>
      )}
    </div>
  )
}