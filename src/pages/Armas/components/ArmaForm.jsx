import {
  useCallback,
  useEffect,
  useState
} from 'react'

import SigmoButton from '../../../ui/components/SigmoButton'
import SigmoCard from '../../../ui/components/SigmoCard'

import ArmaDados from './ArmaDados'
import ArmaFotos from './ArmaFotos'

import {
  cadastrarArma,
  atualizarArma
} from '../../../services/armasService'

import {
  registrarCatalogoArma
} from '../../../services/armasCatalogoService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import './ArmaForm.css'

import {
  listarFotosArma,
  uploadFotoArma,
  excluirFotoArma
} from '../../../services/armasFotosService'

const initialForm = {
  propriedade: 'PMESP',

  patrimonio: '',
  numero_serie: '',
  especie: '',
  marca: '',
  modelo: '',
  calibre: '',
  acabamento: '',
  unidade: '',
  status: 'RESERVA',

  carga_policial_id: '',
  carga_policial_re: '',
  carga_policial_nome: '',
  carga_policial_posto_graduacao: '',
  carga_policial_companhia: '',
  carga_policial_pelotao: '',
  carga_policial_funcao: '',

  observacoes: '',

  numero_sigma: '',
  numero_registro: '',
  validade_registro: '',
  comprimento_cano: '',
  capacidade: '',
  pais_fabricacao: '',
  ano_fabricacao: '',

  proprietario_policial_id: '',
  proprietario_nome: '',
  proprietario_re: '',

  situacao_documental: ''
}

export default function ArmaForm({
  user,
  armaEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] =
    useState(initialForm)

  const [armaSalva, setArmaSalva] =
    useState(null)

  const [saving, setSaving] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [etapa, setEtapa] =
    useState('dados')

    const [fotos, setFotos] =
    useState([])

  const [uploadingFotos, setUploadingFotos] =
    useState(false)

  const isEditing =
    Boolean(armaEditando?.id)

  const armaAtual =
    armaSalva || armaEditando

    const carregarFotos = useCallback(async () => {
    if (!armaAtual?.id) {
      setFotos([])
      return
    }

    try {
      const resultado =
        await listarFotosArma(
          armaAtual.id
        )

      setFotos(resultado || [])
    } catch (error) {
      console.error(
        'Erro ao carregar fotos da arma:',
        error
      )

      setFotos([])
    }
  }, [armaAtual?.id])

  useEffect(() => {
    carregarFotos()
  }, [carregarFotos])

  useEffect(() => {
    if (armaEditando) {
      setForm({
        propriedade:
          armaEditando.propriedade ||
          'PMESP',

        patrimonio:
          armaEditando.patrimonio || '',

        numero_serie:
          armaEditando.numero_serie || '',

        especie:
          armaEditando.especie || '',

        marca:
          armaEditando.marca || '',

        modelo:
          armaEditando.modelo || '',

        calibre:
          armaEditando.calibre || '',

        acabamento:
          armaEditando.acabamento || '',

        unidade:
          armaEditando.unidade || '',

        status:
          armaEditando.status_operacional ||
          armaEditando.status ||
          'RESERVA',

        carga_policial_id:
          armaEditando.carga_policial_id ||
          '',

        carga_policial_re:
          armaEditando.carga_policial_re ||
          '',

        carga_policial_nome:
          armaEditando.carga_policial_nome ||
          '',

        carga_policial_posto_graduacao:
          armaEditando
            .carga_policial_posto_graduacao ||
          '',

        carga_policial_companhia:
          armaEditando
            .carga_policial_companhia ||
          '',

        carga_policial_pelotao:
          armaEditando
            .carga_policial_pelotao ||
          '',

        carga_policial_funcao:
          armaEditando
            .carga_policial_funcao ||
          '',

        observacoes:
          armaEditando.observacoes || '',

        numero_sigma:
          armaEditando.numero_sigma || '',

        numero_registro:
          armaEditando.numero_registro ||
          '',

        validade_registro:
          armaEditando.validade_registro ||
          '',

        comprimento_cano:
          armaEditando.comprimento_cano ||
          '',

        capacidade:
          armaEditando.capacidade ?? '',

        pais_fabricacao:
          armaEditando.pais_fabricacao ||
          '',

        ano_fabricacao:
          armaEditando.ano_fabricacao ??
          '',

        proprietario_policial_id:
          armaEditando
            .proprietario_policial_id ||
          '',

        proprietario_nome:
          armaEditando.proprietario_nome ||
          '',

        proprietario_re:
          armaEditando.proprietario_re ||
          '',

        situacao_documental:
          armaEditando
            .situacao_documental ||
          ''
      })

      setArmaSalva(armaEditando)
    } else {
      setForm(initialForm)
      setArmaSalva(null)
    }

    setErro('')
    setEtapa('dados')
  }, [armaEditando])

  function handleChange(event) {
    const {
      name,
      value
    } = event.target

    if (name === 'propriedade') {
      const propriedade =
        String(
          value || 'PMESP'
        ).toUpperCase()

      setForm((prev) => {
        if (propriedade === 'PMESP') {
          return {
            ...prev,
            propriedade,

            numero_sigma: '',
            numero_registro: '',
            validade_registro: '',
            comprimento_cano: '',
            capacidade: '',
            pais_fabricacao: '',
            ano_fabricacao: '',

            proprietario_policial_id:
              '',

            proprietario_nome: '',
            proprietario_re: '',

            situacao_documental: ''
          }
        }

        return {
          ...prev,
          propriedade
        }
      })

      return
    }

    if (name === 'proprietario_re') {
      const re = String(value || '')
        .replace(/\D/g, '')
        .slice(0, 7)

      setForm((prev) => ({
        ...prev,
        proprietario_re: re
      }))

      return
    }

    if (name === 'status') {
      const status =
        String(
          value || 'RESERVA'
        ).toUpperCase()

      setForm((prev) => {
        if (status !== 'CARGA') {
          return {
            ...prev,
            status,

            carga_policial_id: '',
            carga_policial_re: '',
            carga_policial_nome: '',

            carga_policial_posto_graduacao:
              '',

            carga_policial_companhia:
              '',

            carga_policial_pelotao:
              '',

            carga_policial_funcao:
              ''
          }
        }

        return {
          ...prev,
          status
        }
      })

      return
    }

    const camposSemMaiusculo = [
  'validade_registro',
  'capacidade',
  'ano_fabricacao',
  'proprietario_policial_id',
  'carga_policial_id',
  'calibre'
]

    setForm((prev) => ({
      ...prev,

      [name]:
        camposSemMaiusculo.includes(name)
          ? value
          : String(value || '')
              .toUpperCase()
    }))
  }

  async function handleSalvarDados(event) {
    event?.preventDefault()

    setSaving(true)
    setErro('')

    try {
      let data

      const status =
        String(
          form.status || 'RESERVA'
        ).toUpperCase()

      const armaEmCarga =
        status === 'CARGA'

      if (
        armaEmCarga &&
        !form.carga_policial_id
      ) {
        throw new Error(
          'Informe um RE válido e localize o policial responsável pela carga.'
        )
      }

      const patrimonioNormalizado =
        String(form.patrimonio || '').trim().toUpperCase()

      const numeroSerieNormalizado =
        String(form.numero_serie || '').trim().toUpperCase()

      // Algumas armas antigas não possuem patrimônio preenchido e são
      // identificadas pelo número de série. Nesses casos, o QR é criado
      // usando o número de série como referência.
      const referenciaQr =
        patrimonioNormalizado || numeroSerieNormalizado

      const qrCodeExistente =
        String(
          armaAtual?.qr_code ||
          armaEditando?.qr_code ||
          ''
        ).trim()

      const qrCode =
        qrCodeExistente ||
        (referenciaQr
          ? `SIGMO-ARMA-${referenciaQr}`
          : null)

      const payload = {
        ...form,

        propriedade:
          String(
            form.propriedade || 'PMESP'
          )
            .trim()
            .toUpperCase(),

        patrimonio:
          patrimonioNormalizado || null,

        // Mantém o QR já existente. Quando estiver vazio, cria no padrão
        // SIGMO-ARMA-{PATRIMÔNIO}; se patrimônio estiver vazio, usa o número
        // de série, preservando compatibilidade com registros antigos.
        qr_code: qrCode,

        numero_serie: numeroSerieNormalizado,

        marca:
          String(
            form.marca || ''
          )
            .trim()
            .toUpperCase(),

        modelo:
          String(
            form.modelo || ''
          )
            .trim()
            .toUpperCase(),

        status,

        capacidade:
          form.capacidade === ''
            ? null
            : Number(form.capacidade),

        ano_fabricacao:
          form.ano_fabricacao === ''
            ? null
            : Number(
                form.ano_fabricacao
              ),

        proprietario_policial_id:
          form.proprietario_policial_id ||
          null,

        proprietario_nome:
          form.proprietario_nome ||
          null,

        proprietario_re:
          form.proprietario_re ||
          null,

        validade_registro:
          form.validade_registro ||
          null,

        carga_policial_id:
          armaEmCarga
            ? form.carga_policial_id
            : null,

        carga_policial_re:
          armaEmCarga
            ? form.carga_policial_re ||
              null
            : null,

        carga_policial_nome:
          armaEmCarga
            ? form.carga_policial_nome ||
              null
            : null,

        carga_policial_posto_graduacao:
          armaEmCarga
            ? form
                .carga_policial_posto_graduacao ||
              null
            : null,

        carga_policial_companhia:
          armaEmCarga
            ? form
                .carga_policial_companhia ||
              null
            : null,

        carga_policial_pelotao:
          armaEmCarga
            ? form
                .carga_policial_pelotao ||
              null
            : null,

        carga_policial_funcao:
          armaEmCarga
            ? form
                .carga_policial_funcao ||
              null
            : null
      }

      if (
        isEditing ||
        armaSalva?.id
      ) {
        data = await atualizarArma(
          armaAtual.id,
          payload,
          user
        )

        await registerAudit({
          user,
          action: 'ATUALIZAR_ARMA',
          tableName: 'sigmo_armas',
          recordId: armaAtual.id,

          description:
            `Atualizou arma ${
              form.patrimonio ||
              form.numero_serie
            }`
        })
      } else {
        data = await cadastrarArma(
          payload,
          user
        )

        await registerAudit({
          user,
          action: 'CADASTRAR_ARMA',
          tableName: 'sigmo_armas',
          recordId: data?.id,

          description:
            `Cadastrou arma ${
              form.patrimonio ||
              form.numero_serie
            }`
        })
      }

      try {
        await registrarCatalogoArma({
          marca: payload.marca,
          modelo: payload.modelo
        })
      } catch (catalogoError) {
        console.warn(
          'A arma foi salva, mas não foi possível atualizar o catálogo de marcas e modelos.',
          catalogoError
        )
      }

      const salva =
        data || armaAtual

      setArmaSalva(salva)
      setEtapa('fotos')
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao salvar arma.'
      )
    } finally {
      setSaving(false)
    }
  }

    async function handleUploadFoto(file) {
    if (!file || !armaAtual?.id) {
      return
    }

    try {
      setUploadingFotos(true)
      setErro('')

      await uploadFotoArma(
        file,
        armaAtual.id,
        user
      )

      await carregarFotos()
    } catch (error) {
      console.error(
        'Erro ao enviar foto da arma:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível enviar a foto.'
      )
    } finally {
      setUploadingFotos(false)
    }
  }

  async function handleExcluirFoto(foto) {
    if (!foto?.id) {
      return
    }

    const confirmou =
      window.confirm(
        'Deseja excluir esta foto?'
      )

    if (!confirmou) {
      return
    }

    try {
      setUploadingFotos(true)
      setErro('')

      await excluirFotoArma(
        foto,
        user
      )

      await carregarFotos()
    } catch (error) {
      console.error(
        'Erro ao excluir foto da arma:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível excluir a foto.'
      )
    } finally {
      setUploadingFotos(false)
    }
  }

  function handleFinalizar() {
    onSaved?.()
  }

  return (
    <SigmoCard className="arma-form-card">
      <form onSubmit={handleSalvarDados}>
        <div className="arma-form-header">
          <div>
            <h2>
              {isEditing
                ? 'Editar arma'
                : 'Nova arma'}
            </h2>

            <p>
              {etapa === 'dados'
                ? 'Preencha os dados principais da arma.'
                : 'Adicione fotos, confira os dados e finalize o cadastro.'}
            </p>
          </div>

          <div className="arma-form-steps">
            <span
              className={
                etapa === 'dados'
                  ? 'active'
                  : ''
              }
            >
              1 Dados
            </span>

            <span
              className={
                etapa === 'fotos'
                  ? 'active'
                  : ''
              }
            >
              2 Fotos
            </span>
          </div>
        </div>

        {erro && (
          <div className="arma-form-error">
            {erro}
          </div>
        )}

        {etapa === 'dados' && (
          <>
            <ArmaDados
              form={form}
              onChange={handleChange}
              disabled={saving}
            />

            <div className="arma-form-actions">
              <SigmoButton
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={saving}
              >
                Cancelar
              </SigmoButton>

              <SigmoButton
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : 'Seguinte'}
              </SigmoButton>
            </div>
          </>
        )}

        {etapa === 'fotos' && (
          <>
            <ArmaFotos
  arma={armaAtual}
  fotos={fotos}
  uploading={uploadingFotos}
  onUpload={handleUploadFoto}
  onExcluir={handleExcluirFoto}
  disabled={saving}
/>

            <div className="arma-form-actions">
              <SigmoButton
                type="button"
                variant="secondary"
                onClick={() =>
                  setEtapa('dados')
                }
                disabled={saving}
              >
                Voltar aos dados
              </SigmoButton>

              <SigmoButton
                type="button"
                variant="success"
                onClick={handleFinalizar}
                disabled={saving}
              >
                Finalizar
              </SigmoButton>
            </div>
          </>
        )}
      </form>
    </SigmoCard>
  )
}