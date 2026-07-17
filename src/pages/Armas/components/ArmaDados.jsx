import {
  useEffect,
  useState
} from 'react'

import SigmoInput from '../../../ui/components/SigmoInput'
import SigmoSelect from '../../../ui/components/SigmoSelect'
import SigmoTextarea from '../../../ui/components/SigmoTextarea'
import SigmoAutocomplete from '../../../ui/components/SigmoAutocomplete'

import PatrimonioFormGrid from '../../../components/Patrimonio/PatrimonioFormGrid'

import { supabase } from '../../../services/supabaseClient'

import {
  listarMarcasArmas,
  listarModelosArmas
} from '../../../services/armasCatalogoService'

import {
  ACABAMENTOS_ARMAS,
  CALIBRES_ARMAS,
  ESPECIES_ARMAS,
  PROPRIEDADES_ARMAS,
  SITUACOES_DOCUMENTAIS_ARMAS,
  STATUS_ARMAS
} from '../../../constants/armas'

import {
  UNIDADES_27_BPMM
} from '../../../constants/unidades'

function normalizarReBase(valor) {
  return String(valor || '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

export default function ArmaDados({
  form,
  onChange,
  disabled = false
}) {
  const [buscandoPolicial, setBuscandoPolicial] =
    useState(false)

  const [erroPolicial, setErroPolicial] =
    useState('')

  const [policialCarga, setPolicialCarga] =
    useState(null)

  const [marcas, setMarcas] =
    useState([])

  const [modelos, setModelos] =
    useState([])

  const [loadingMarcas, setLoadingMarcas] =
    useState(false)

  const [loadingModelos, setLoadingModelos] =
    useState(false)

  const armaParticular =
    form.propriedade === 'PARTICULAR'

  const armaEmCarga =
    form.status === 'CARGA'

  useEffect(() => {
    if (!armaEmCarga) {
      setPolicialCarga(null)
      setErroPolicial('')
      return
    }

    if (
      form.carga_policial_id &&
      form.carga_policial_re
    ) {
      setPolicialCarga({
        id:
          form.carga_policial_id,

        re:
          normalizarReBase(
            form.carga_policial_re
          ),

        nome:
          form.carga_policial_nome || '',

        posto_graduacao:
          form
            .carga_policial_posto_graduacao ||
          '',

        companhia:
          form.carga_policial_companhia ||
          '',

        pelotao:
          form.carga_policial_pelotao ||
          '',

        funcao:
          form.carga_policial_funcao ||
          ''
      })
    }
  }, [
    armaEmCarga,
    form.carga_policial_id,
    form.carga_policial_re,
    form.carga_policial_nome,
    form.carga_policial_posto_graduacao,
    form.carga_policial_companhia,
    form.carga_policial_pelotao,
    form.carga_policial_funcao
  ])

  useEffect(() => {
    let ativo = true

    async function carregarMarcas() {
      try {
        setLoadingMarcas(true)

        const lista =
          await listarMarcasArmas()

        if (ativo) {
          setMarcas(lista || [])
        }
      } catch (error) {
        console.error(
          'Erro ao carregar marcas:',
          error
        )
      } finally {
        if (ativo) {
          setLoadingMarcas(false)
        }
      }
    }

    carregarMarcas()

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true

    async function carregarModelos() {
      try {
        setLoadingModelos(true)

        const lista =
          await listarModelosArmas({
            marca: form.marca
          })

        if (ativo) {
          setModelos(lista || [])
        }
      } catch (error) {
        console.error(
          'Erro ao carregar modelos:',
          error
        )

        if (ativo) {
          setModelos([])
        }
      } finally {
        if (ativo) {
          setLoadingModelos(false)
        }
      }
    }

    carregarModelos()

    return () => {
      ativo = false
    }
  }, [form.marca])

  function atualizarCampo(
    name,
    value
  ) {
    onChange({
      target: {
        name,
        value: value ?? ''
      }
    })
  }

  function limparDadosPolicialCarga({
    manterRe = false
  } = {}) {
    if (!manterRe) {
      atualizarCampo(
        'carga_policial_re',
        ''
      )
    }

    atualizarCampo(
      'carga_policial_id',
      ''
    )

    atualizarCampo(
      'carga_policial_nome',
      ''
    )

    atualizarCampo(
      'carga_policial_posto_graduacao',
      ''
    )

    atualizarCampo(
      'carga_policial_companhia',
      ''
    )

    atualizarCampo(
      'carga_policial_pelotao',
      ''
    )

    atualizarCampo(
      'carga_policial_funcao',
      ''
    )

    setPolicialCarga(null)
  }

  async function buscarPolicialPorRe(
    reInformado
  ) {
    const re = normalizarReBase(
      typeof reInformado === 'string'
        ? reInformado
        : form.carga_policial_re
    )

    if (re.length !== 6) {
      limparDadosPolicialCarga({
        manterRe: true
      })

      setErroPolicial(
        'Informe os 6 números do RE.'
      )

      return
    }

    try {
      setBuscandoPolicial(true)
      setErroPolicial('')

      const {
        data,
        error
      } = await supabase
        .from('policiais')
        .select(`
          id,
          re,
          nome_guerra,
          posto_graduacao,
          companhia,
          pelotao,
          funcao
        `)
        .ilike(
          're',
          `${re}%`
        )
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        limparDadosPolicialCarga({
          manterRe: true
        })

        setErroPolicial(
          'Nenhum policial foi localizado com este RE.'
        )

        return
      }

      const policial = {
        id:
          data.id,

        re,

        nome:
          data.nome_guerra || '',

        posto_graduacao:
          data.posto_graduacao || '',

        companhia:
          data.companhia || '',

        pelotao:
          data.pelotao || '',

        funcao:
          data.funcao || ''
      }

      setPolicialCarga(policial)

      atualizarCampo(
        'carga_policial_id',
        policial.id
      )

      atualizarCampo(
        'carga_policial_re',
        policial.re
      )

      atualizarCampo(
        'carga_policial_nome',
        policial.nome
      )

      atualizarCampo(
        'carga_policial_posto_graduacao',
        policial.posto_graduacao
      )

      atualizarCampo(
        'carga_policial_companhia',
        policial.companhia
      )

      atualizarCampo(
        'carga_policial_pelotao',
        policial.pelotao
      )

      atualizarCampo(
        'carga_policial_funcao',
        policial.funcao
      )
    } catch (error) {
      console.error(
        'Erro ao localizar policial:',
        error
      )

      limparDadosPolicialCarga({
        manterRe: true
      })

      setErroPolicial(
        error.message ||
          'Erro ao localizar o policial.'
      )
    } finally {
      setBuscandoPolicial(false)
    }
  }

  function handleReCargaChange(event) {
    const somenteNumeros =
      normalizarReBase(
        event.target.value
      )

    onChange({
      target: {
        name: 'carga_policial_re',
        value: somenteNumeros
      }
    })

    setPolicialCarga(null)
    setErroPolicial('')

    atualizarCampo(
      'carga_policial_id',
      ''
    )

    atualizarCampo(
      'carga_policial_nome',
      ''
    )

    atualizarCampo(
      'carga_policial_posto_graduacao',
      ''
    )

    atualizarCampo(
      'carga_policial_companhia',
      ''
    )

    atualizarCampo(
      'carga_policial_pelotao',
      ''
    )

    atualizarCampo(
      'carga_policial_funcao',
      ''
    )

    if (somenteNumeros.length === 6) {
      buscarPolicialPorRe(
        somenteNumeros
      )
    }
  }

  return (
    <div className="arma-dados">
      <section className="arma-dados-section">
        <div className="arma-dados-section-header">
          <div>
            <h3>
              Identificação e propriedade
            </h3>

            <p>
              Informe a origem e os dados
              principais de identificação da arma.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoSelect
            label="Propriedade"
            name="propriedade"
            value={form.propriedade}
            onChange={onChange}
            disabled={disabled}
            options={PROPRIEDADES_ARMAS}
          />

          <SigmoInput
            label="Patrimônio"
            name="patrimonio"
            value={form.patrimonio}
            onChange={onChange}
            disabled={disabled}
            placeholder="Número patrimonial — opcional"
          />

          <SigmoInput
            label="Número de série"
            name="numero_serie"
            value={form.numero_serie}
            onChange={onChange}
            required
            disabled={disabled}
          />

          <SigmoSelect
            label="Espécie"
            name="especie"
            value={form.especie}
            onChange={onChange}
            disabled={disabled}
            options={ESPECIES_ARMAS}
          />

          <SigmoAutocomplete
            label="Marca"
            name="marca"
            value={form.marca}
            onChange={onChange}
            disabled={disabled}
            required
            loading={loadingMarcas}
            options={marcas.map(
              (item) => ({
                value: item.nome,
                label: item.nome
              })
            )}
            placeholder="Digite ou selecione a marca"
          />

          <SigmoAutocomplete
            label="Modelo"
            name="modelo"
            value={form.modelo}
            onChange={onChange}
            disabled={disabled}
            loading={loadingModelos}
            options={modelos.map(
              (item) => ({
                value: item.nome,
                label: item.nome
              })
            )}
            placeholder="Digite ou selecione o modelo"
          />

          <SigmoSelect
            label="Calibre"
            name="calibre"
            value={form.calibre}
            onChange={onChange}
            required
            disabled={disabled}
            options={CALIBRES_ARMAS}
          />

          <SigmoSelect
            label="Acabamento"
            name="acabamento"
            value={form.acabamento}
            onChange={onChange}
            disabled={disabled}
            options={ACABAMENTOS_ARMAS}
          />
        </PatrimonioFormGrid>
      </section>

      <section className="arma-dados-section">
        <div className="arma-dados-section-header">
          <div>
            <h3>
              Controle operacional
            </h3>

            <p>
              Informe a unidade, a situação
              atual e os dados de controle.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoSelect
            label="Unidade"
            name="unidade"
            value={form.unidade}
            onChange={onChange}
            disabled={disabled}
            options={UNIDADES_27_BPMM}
          />

          <SigmoSelect
            label="Status"
            name="status"
            value={form.status}
            onChange={onChange}
            disabled={disabled}
            options={STATUS_ARMAS}
          />
        </PatrimonioFormGrid>
      </section>

      {armaEmCarga && (
        <section className="arma-dados-section arma-dados-particular">
          <div className="arma-dados-section-header">
            <div>
              <span className="arma-dados-badge">
                Carga permanente
              </span>

              <h3>
                Policial responsável
              </h3>

              <p>
                Informe somente os seis números
                do RE para vincular a arma.
              </p>
            </div>
          </div>

          <PatrimonioFormGrid>
            <div>
              <SigmoInput
                label="RE do policial"
                name="carga_policial_re"
                value={normalizarReBase(
                  form.carga_policial_re
                )}
                onChange={handleReCargaChange}
                onBlur={() =>
                  buscarPolicialPorRe()
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter'
                  ) {
                    event.preventDefault()

                    buscarPolicialPorRe()
                  }
                }}
                inputMode="numeric"
                maxLength={6}
                required
                disabled={disabled}
                placeholder="Digite os 6 números do RE"
              />

              {buscandoPolicial && (
                <div className="arma-dados-aviso">
                  Localizando policial...
                </div>
              )}

              {erroPolicial && (
                <div className="arma-form-error">
                  {erroPolicial}
                </div>
              )}
            </div>
          </PatrimonioFormGrid>

          {policialCarga && (
            <div className="arma-dados-aviso">
              <strong>
                Policial localizado
              </strong>

              <div>
                {[
                  policialCarga
                    .posto_graduacao,

                  policialCarga.nome
                ]
                  .filter(Boolean)
                  .join(' ') || '-'}
              </div>

              <div>
                RE: {
                  policialCarga.re || '-'
                }
              </div>

              <div>
                {[
                  policialCarga.companhia,
                  policialCarga.pelotao
                ]
                  .filter(Boolean)
                  .join(' — ') || '-'}
              </div>

              {policialCarga.funcao && (
                <div>
                  Função: {
                    policialCarga.funcao
                  }
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {armaParticular && (
        <section className="arma-dados-section arma-dados-particular">
          <div className="arma-dados-section-header">
            <div>
              <span className="arma-dados-badge">
                Arma particular
              </span>

              <h3>
                Documentação da arma
              </h3>

              <p>
                Estes dados são obrigatórios
                para o controle de arma
                particular de policial.
              </p>
            </div>
          </div>

          <PatrimonioFormGrid>
            <SigmoInput
              label="Número SIGMA"
              name="numero_sigma"
              value={form.numero_sigma}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="Número do registro"
              name="numero_registro"
              value={form.numero_registro}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="Validade do registro"
              name="validade_registro"
              type="date"
              value={form.validade_registro}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoSelect
              label="Situação documental"
              name="situacao_documental"
              value={
                form.situacao_documental
              }
              onChange={onChange}
              disabled={disabled}
              options={
                SITUACOES_DOCUMENTAIS_ARMAS
              }
            />

            <SigmoInput
              label="Comprimento do cano"
              name="comprimento_cano"
              value={form.comprimento_cano}
              onChange={onChange}
              required
              disabled={disabled}
              placeholder="Ex.: 102 mm"
            />

            <SigmoInput
              label="Capacidade"
              name="capacidade"
              type="number"
              min="1"
              value={form.capacidade}
              onChange={onChange}
              required
              disabled={disabled}
              placeholder="Quantidade de munições"
            />

            <SigmoInput
              label="País de fabricação"
              name="pais_fabricacao"
              value={form.pais_fabricacao}
              onChange={onChange}
              disabled={disabled}
            />

            <SigmoInput
              label="Ano de fabricação"
              name="ano_fabricacao"
              type="number"
              min="1800"
              max="2100"
              value={form.ano_fabricacao}
              onChange={onChange}
              disabled={disabled}
            />
          </PatrimonioFormGrid>
        </section>
      )}

      {armaParticular && (
        <section className="arma-dados-section arma-dados-particular">
          <div className="arma-dados-section-header">
            <div>
              <h3>
                Proprietário
              </h3>

              <p>
                Vincule a arma ao policial
                proprietário.
              </p>
            </div>
          </div>

          <PatrimonioFormGrid>
            <SigmoInput
              label="Nome do proprietário"
              name="proprietario_nome"
              value={form.proprietario_nome}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="RE do proprietário"
              name="proprietario_re"
              value={form.proprietario_re}
              onChange={onChange}
              required
              disabled={disabled}
            />
          </PatrimonioFormGrid>

          <div className="arma-dados-aviso">
            Neste primeiro momento, o nome e
            o RE são preenchidos manualmente.
          </div>
        </section>
      )}

      <section className="arma-dados-section">
        <div className="arma-dados-section-header">
          <div>
            <h3>
              Observações
            </h3>

            <p>
              Registre informações
              complementares relevantes.
            </p>
          </div>
        </div>

        <SigmoTextarea
          label="Observações"
          name="observacoes"
          value={form.observacoes}
          onChange={onChange}
          disabled={disabled}
          placeholder="Digite observações sobre a arma..."
        />
      </section>
    </div>
  )
}