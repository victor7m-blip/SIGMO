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

          const novidadePendente =
            material.novidade_pendente || null

          const novidadeRegistrada =
            Boolean(
              novidadePendente?.id
            )

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
                novidadeRegistrada || novidade
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
                      novidadeRegistrada
                        ? 'pagar-material-novidade-btn is-registered'
                        : 'pagar-material-novidade-btn'
                    }
                    onClick={() =>
                      onAlternarNovidade?.(
                        material.id
                      )
                    }
                  >
                    {novidadeAberta
                      ? 'Fechar novidade'
                      : novidadeRegistrada
                        ? 'Analisar novidade'
                        : novidade
                          ? 'Editar novidade'
                          : 'Registrar novidade'}
                  </button>

                  {novidadeRegistrada && (
                    <span className="pagar-material-novidade-ok">
                      ✓ Novidade registrada pelo usuário
                    </span>
                  )}

                  {!novidadeRegistrada && novidade && (
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
                  )}
                </div>

                {novidadeAberta && (
                  <div className="pagar-material-novidade-card">
                    <div className="pagar-material-novidade-card-head">
                      <span>
                        {novidadeRegistrada
                          ? 'NOVIDADE REGISTRADA PELO USUÁRIO'
                          : 'REGISTRO DE NOVIDADE'}
                      </span>

                      <strong>
                        {material.descricao ||
                          material.patrimonio ||
                          'MATERIAL'}
                      </strong>
                    </div>

                    {novidadeRegistrada && (
                      <div
                        className="pagar-material-feedback pagar-material-feedback-success"
                        style={{
                          marginBottom: '12px'
                        }}
                      >
                        Ocorrência já registrada. Analise os dados abaixo e escolha a providência operacional.
                      </div>
                    )}

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
                            ''
                          }
                          onChange={(event) =>
                            onNovidadeChange?.(
                              material.id,
                              'providencia',
                              event.target.value
                            )
                          }
                        >
                          <option value="">
                            SELECIONE A PROVIDÊNCIA
                          </option>
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
                      novidadePendente?.fotos
                    ) &&
                      novidadePendente.fotos.length >
                        0 && (
                      <div className="pagar-material-novidade-fotos">
                        {novidadePendente.fotos.map(
                          (
                            foto,
                            indice
                          ) => (
                            <article
                              key={
                                foto.id ||
                                `${material.id}-existente-${indice}`
                              }
                              className="pagar-material-novidade-foto-card"
                            >
                              <a
                                href={
                                  foto.foto_url
                                }
                                target="_blank"
                                rel="noreferrer"
                                title="Ampliar foto registrada pelo usuário"
                              >
                                <img
                                  src={
                                    foto.foto_url
                                  }
                                  alt={`Foto ${
                                    indice + 1
                                  } da novidade registrada`}
                                />
                              </a>

                              <div>
                                <span>
                                  Foto registrada{' '}
                                  {indice + 1}
                                </span>
                              </div>
                            </article>
                          )
                        )}
                      </div>
                    )}

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
