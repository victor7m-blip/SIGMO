export default function CarrinhoMateriais({
  itens = [],
  onRemover,
  onQuantidadeChange,
  onAlternarNovidade,
  onNovidadeChange,
  onSelecionarFotosNovidade,
  onRemoverFotoNovidade,
  onRemoverNovidade
}) {
  return (
    <div className="pagar-material-selected">
      <h3>Materiais selecionados</h3>

      {itens.length === 0 ? (
        <div className="pagar-material-empty">
          Nenhum material adicionado.
        </div>
      ) : (
        itens.map((material) => {
          const controlaQuantidade =
            material.controla_quantidade ||
            material.tipo_registro ===
              'TONFA_QUANTIDADE'

          const recebimentoQuantidade =
            material.tipo_registro ===
            'TONFA_QUANTIDADE'

          const quantidadeMaxima =
            Number(
              recebimentoQuantidade
                ? (
                    material.quantidade_maxima ??
                    material.quantidade_disponivel ??
                    material.quantidade ??
                    1
                  )
                : (
                    material.quantidade_maxima ??
                    material.quantidade_disponivel ??
                    1
                  )
            )

          const quantidadeSelecionada =
            Number(
              material.quantidade_receber ??
              material.quantidade_selecionada ??
              material.quantidade ??
              1
            )

          const novidade =
            material.novidade || null

          const novidadeAberta =
            Boolean(
              material.novidade_aberta
            )

          const quantidadeAfetadaMaxima =
            Math.max(
              1,
              Number(
                material.quantidade_receber ??
                material.quantidade ??
                1
              )
            )

          return (
            <article
              key={[
                material.tabela_origem,
                material.id
              ].join('-')}
              className={`pagar-material-selected-item ${
                novidade
                  ? 'has-novidade'
                  : ''
              }`}
            >
              <div className="pagar-material-selected-info">
                <div className="pagar-material-selected-top">
                  <div>
                    <strong>
                      {material.patrimonio ||
                        material.numero_patrimonio ||
                        material.id}
                    </strong>

                    <span>
                      {material.descricao ||
                        material.modelo ||
                        'MATERIAL'}
                    </span>

                    <small>
                      {[
                        material.local_atual,
                        material.status
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="pagar-material-remove-item"
                    aria-label="Remover material"
                    onClick={() =>
                      onRemover?.(
                        material.id
                      )
                    }
                  >
                    ×
                  </button>
                </div>

                {controlaQuantidade && (
                  <label className="pagar-material-quantity">
                    <span>Quantidade</span>

                    <input
                      type="number"
                      min="1"
                      max={quantidadeMaxima}
                      value={
                        quantidadeSelecionada
                      }
                      onChange={(event) =>
                        onQuantidadeChange?.(
                          material.id,
                          event.target.value
                        )
                      }
                    />

                    <small>
                      {recebimentoQuantidade
                        ? 'Saldo em cautela'
                        : 'Disponível no cofre'}
                      : {quantidadeMaxima}
                    </small>
                  </label>
                )}

                <div className="pagar-material-item-novidade-actions">
                  <button
                    type="button"
                    className={
                      novidade
                        ? 'pagar-material-novidade-btn is-registered'
                        : 'pagar-material-novidade-btn'
                    }
                    onClick={() =>
                      onAlternarNovidade?.(
                        material.id
                      )
                    }
                  >
                    {novidade
                      ? novidadeAberta
                        ? 'Fechar novidade'
                        : 'Editar novidade'
                      : novidadeAberta
                        ? 'Cancelar novidade'
                        : 'Registrar novidade'}
                  </button>

                  {novidade && (
                    <>
                      <span className="pagar-material-novidade-ok">
                        ✓ Novidade registrada
                      </span>

                      <button
                        type="button"
                        className="pagar-material-novidade-remove"
                        onClick={() =>
                          onRemoverNovidade?.(
                            material.id
                          )
                        }
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>

                {novidadeAberta && (
                  <div className="pagar-material-novidade-card">
                    <div className="pagar-material-novidade-card-head">
                      <span>
                        REGISTRO DE NOVIDADE
                      </span>

                      <strong>
                        {material.descricao ||
                          material.patrimonio ||
                          'MATERIAL'}
                      </strong>
                    </div>

                    <div className="pagar-material-novidade-grid">
                      <label>
                        Tipo da novidade

                        <select
                          value={
                            novidade?.tipo ||
                            ''
                          }
                          onChange={(event) =>
                            onNovidadeChange?.(
                              material.id,
                              'tipo',
                              event.target.value
                            )
                          }
                        >
                          <option value="">
                            SELECIONE
                          </option>
                          <option value="AVARIA">
                            AVARIA
                          </option>
                          <option value="DEFEITO">
                            DEFEITO
                          </option>
                          <option value="MANUTENCAO_PREVENTIVA">
                            MANUTENÇÃO PREVENTIVA
                          </option>
                          <option value="LIMPEZA">
                            LIMPEZA NECESSÁRIA
                          </option>
                          <option value="EXTRAVIO_ACESSORIO">
                            EXTRAVIO DE ACESSÓRIO
                          </option>
                          <option value="OUTRO">
                            OUTRO
                          </option>
                        </select>
                      </label>

                      <label>
                        Providência

                        <select
                          value={
                            novidade?.providencia ||
                            'COFRE'
                          }
                          onChange={(event) =>
                            onNovidadeChange?.(
                              material.id,
                              'providencia',
                              event.target.value
                            )
                          }
                        >
                          <option value="COFRE">
                            RETORNAR AO COFRE
                          </option>
                          <option value="MANUTENCAO">
                            ENVIAR PARA MANUTENÇÃO
                          </option>
                          <option value="BAIXA">
                            SOLICITAR BAIXA PATRIMONIAL
                          </option>
                        </select>
                      </label>

                      {recebimentoQuantidade && (
                        <label>
                          Quantidade com novidade

                          <input
                            type="number"
                            min="1"
                            max={
                              quantidadeAfetadaMaxima
                            }
                            value={
                              novidade?.quantidade_afetada ??
                              1
                            }
                            onChange={(event) =>
                              onNovidadeChange?.(
                                material.id,
                                'quantidade_afetada',
                                event.target.value
                              )
                            }
                          />

                          <small>
                            Máximo:{' '}
                            {quantidadeAfetadaMaxima}
                          </small>
                        </label>
                      )}

                      <label className="pagar-material-novidade-full">
                        Descrição

                        <textarea
                          value={
                            novidade?.descricao ||
                            ''
                          }
                          onChange={(event) =>
                            onNovidadeChange?.(
                              material.id,
                              'descricao',
                              event.target.value
                            )
                          }
                          placeholder="DESCREVA A AVARIA, DEFEITO OU OUTRA SITUAÇÃO ENCONTRADA"
                        />
                      </label>

                      <label className="pagar-material-novidade-full">
                        Fotos

                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          onChange={(event) =>
                            onSelecionarFotosNovidade?.(
                              material.id,
                              event
                            )
                          }
                        />

                        <small>
                          Até 5 MB por foto.
                        </small>
                      </label>
                    </div>

                    {Array.isArray(
                      novidade?.previews
                    ) &&
                      novidade.previews.length >
                        0 && (
                      <div className="pagar-material-novidade-fotos">
                        {novidade.previews.map(
                          (
                            preview,
                            indice
                          ) => (
                            <article
                              key={
                                preview.id ||
                                `${material.id}-${indice}`
                              }
                              className="pagar-material-novidade-foto-card"
                            >
                              <a
                                href={
                                  preview.url
                                }
                                target="_blank"
                                rel="noreferrer"
                                title="Ampliar foto"
                              >
                                <img
                                  src={
                                    preview.url
                                  }
                                  alt={`Foto ${
                                    indice + 1
                                  } da novidade`}
                                />
                              </a>

                              <div>
                                <span>
                                  Foto{' '}
                                  {indice + 1}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoverFotoNovidade?.(
                                      material.id,
                                      indice
                                    )
                                  }
                                >
                                  Remover
                                </button>
                              </div>
                            </article>
                          )
                        )}
                      </div>
                    )}

                    {novidade &&
                      (novidade.tipo ||
                        novidade.descricao) && (
                      <div className="pagar-material-novidade-resumo">
                        <strong>
                          {novidade.tipo ||
                            'NOVIDADE'}
                        </strong>

                        <span>
                          {novidade.descricao ||
                            'Descrição pendente'}
                        </span>

                        {recebimentoQuantidade && (
                          <small>
                            Quantidade afetada:{' '}
                            {novidade.quantidade_afetada ||
                              1}
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
