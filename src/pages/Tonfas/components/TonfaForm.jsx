import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import { TIPOS_TONFA } from '../../../constants/tonfas'
import { UNIDADES_27_BPMM } from '../../../constants/unidades'

import {
  atualizarTonfa,
  cadastrarTonfa
} from '../../../services/tonfasService'

import { registerAudit } from '../../../services/auditoriaService'

import TonfaFotos from './TonfaFotos'

const FORM_INICIAL = {
  tipo: 'TONFA',
  unidade: '27º BPM/M - 5ª CIA',
  quantidade: '',
  status_operacional: 'RESERVA',
  local_atual: 'P4',
  observacoes: '',
  qr_code: '',
  foto_url: '',
  ativo: true
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(numero)
  )
}

function obterFormTonfa(tonfa = null) {
  if (!tonfa) {
    return {
      ...FORM_INICIAL
    }
  }

  return {
    tipo:
      texto(tonfa.tipo).toUpperCase() ||
      'TONFA',

    unidade:
      texto(tonfa.unidade).toUpperCase() ||
      '27º BPM/M - 5ª CIA',

    quantidade:
      numeroInteiro(tonfa.quantidade),

    status_operacional:
      texto(
        tonfa.status_operacional
      ).toUpperCase() ||
      'RESERVA',

    local_atual:
      texto(tonfa.local_atual) ||
      'P4',

    observacoes:
      texto(tonfa.observacoes),

    qr_code:
      texto(tonfa.qr_code),

    foto_url:
      texto(tonfa.foto_url),

    ativo:
      tonfa.ativo !== false
  }
}

function obterRotuloTipo(tipo) {
  return tipo === 'CASSETETE'
    ? 'Cassetete'
    : 'Tonfa'
}

function obterClasseSaldo(valor) {
  return valor > 0
    ? 'tonfa-saldo-card tonfa-saldo-card-active'
    : 'tonfa-saldo-card'
}

export default function TonfaForm({
  user,
  tonfaEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] = useState(
    FORM_INICIAL
  )

  const [salvo, setSalvo] = useState(
    null
  )

  const [saving, setSaving] = useState(
    false
  )

  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    if (tonfaEditando) {
      setForm(
        obterFormTonfa(
          tonfaEditando
        )
      )

      setSalvo(
        tonfaEditando
      )
    } else {
      setForm({
        ...FORM_INICIAL
      })

      setSalvo(null)
    }

    setErro('')
    setSucesso('')
  }, [tonfaEditando])

  const registroAtual =
    salvo ||
    tonfaEditando ||
    null

  const saldos = useMemo(() => {
    return {
      total:
        numeroInteiro(
          registroAtual?.quantidade
        ),

      p4:
        numeroInteiro(
          registroAtual?.quantidade_p4
        ),

      svdd:
        numeroInteiro(
          registroAtual?.quantidade_svdd
        ),

      emServico:
        numeroInteiro(
          registroAtual?.quantidade_em_servico
        )
    }
  }, [registroAtual])

  const totalDistribuido =
    saldos.svdd +
    saldos.emServico

  const quantidadeMinima =
    registroAtual?.id
      ? Math.max(
          1,
          totalDistribuido
        )
      : 1

  const qrCodeAtual =
    salvo?.qr_code ||
    form.qr_code ||
    `SIGMO-${
      form.tipo || 'TONFA'
    }`

  function handleChange(event) {
    const {
      name,
      value
    } = event.target

    setErro('')
    setSucesso('')

    setForm((prev) => ({
      ...prev,

      [name]:
        name === 'quantidade'
          ? value.replace(
              /\D/g,
              ''
            )
          : value
    }))
  }

  function validarFormulario() {
    const quantidade =
      numeroInteiro(
        form.quantidade
      )

    if (!texto(form.tipo)) {
      throw new Error(
        'Informe o tipo.'
      )
    }

    if (!texto(form.unidade)) {
      throw new Error(
        'Informe a unidade.'
      )
    }

    if (quantidade <= 0) {
      throw new Error(
        'Informe uma quantidade maior que zero.'
      )
    }

    if (
      registroAtual?.id &&
      quantidade <
        totalDistribuido
    ) {
      throw new Error(
        `A quantidade total não pode ser menor que ${totalDistribuido}, pois existem materiais fora do P4.`
      )
    }

    return quantidade
  }

  function montarPayload(
    quantidade
  ) {
    return {
      ...form,

      tipo:
        texto(
          form.tipo
        ).toUpperCase(),

      quantidade,

      unidade:
        texto(
          form.unidade
        ).toUpperCase(),

      status_operacional:
        texto(
          form.status_operacional
        ).toUpperCase() ||
        'RESERVA',

      local_atual:
        texto(
          form.local_atual
        ) ||
        'P4',

      observacoes:
        texto(
          form.observacoes
        ),

      qr_code:
        texto(
          form.qr_code
        ),

      foto_url:
        texto(
          form.foto_url
        ),

      ativo:
        form.ativo !== false
    }
  }

  async function registrarAuditoria({
    data,
    payload,
    editando
  }) {
    try {
      await registerAudit({
        user,

        action:
          editando
            ? 'ATUALIZAR_TONFA'
            : 'CADASTRAR_TONFA',

        tableName:
          'sigmo_tonfas',

        recordId:
          data?.id ||
          registroAtual?.id ||
          null,

        description:
          editando
            ? `Atualizou estoque de ${obterRotuloTipo(
                payload.tipo
              ).toLowerCase()} para ${payload.quantidade} unidades`
            : `Cadastrou estoque de ${obterRotuloTipo(
                payload.tipo
              ).toLowerCase()} com ${payload.quantidade} unidades`
      })
    } catch (auditError) {
      console.error(
        'Erro ao registrar auditoria de Tonfa:',
        auditError
      )
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setErro('')
      setSucesso('')

      const quantidade =
        validarFormulario()

      const payload =
        montarPayload(
          quantidade
        )

      const idAtual =
        salvo?.id ||
        tonfaEditando?.id ||
        null

      const editando =
        Boolean(idAtual)

      let data

      if (editando) {
        data =
          await atualizarTonfa(
            idAtual,
            payload,
            user
          )
      } else {
        data =
          await cadastrarTonfa(
            payload,
            user
          )
      }

      await registrarAuditoria({
        data,
        payload,
        editando
      })

      setSalvo(data)

      setForm(
        obterFormTonfa(data)
      )

      setSucesso(
        editando
          ? 'Estoque atualizado com sucesso.'
          : 'Estoque cadastrado com sucesso.'
      )
    } catch (error) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao salvar o estoque.'
      )
    } finally {
      setSaving(false)
    }
  }

  function handleFotoPrincipalAlterada(
    url
  ) {
    setSalvo((prev) => {
      if (!prev) {
        return prev
      }

      return {
        ...prev,
        foto_url:
          url || ''
      }
    })

    setForm((prev) => ({
      ...prev,
      foto_url:
        url || ''
    }))
  }

  return (
    <div className="tonfa-form-card">
      <div className="tonfa-form-header">
        <div>
          <h2>
            {registroAtual?.id
              ? 'Editar estoque'
              : 'Novo estoque'}
          </h2>

          <p>
            Controle patrimonial por quantidade de
            Tonfas e Cassetetes.
          </p>
        </div>

        <button
          type="button"
          className="tonfa-btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Fechar
        </button>
      </div>

      {erro && (
        <div
          className="tonfa-alert-error"
          role="alert"
        >
          {erro}
        </div>
      )}

      {sucesso && (
        <div
          className="tonfa-alert-success"
          role="status"
        >
          <div className="tonfa-alert-success-icon">
            ✓
          </div>

          <div>
            <strong>
              {sucesso}
            </strong>

            <span>
              O estoque já foi integrado à Gestão
              Patrimonial do SIGMO.
            </span>
          </div>
        </div>
      )}

      {registroAtual?.id && (
        <section className="tonfa-saldos-section">
          <div className="tonfa-section-heading">
            <div>
              <span className="tonfa-section-eyebrow">
                Posição atual do estoque
              </span>

              <h3>
                Distribuição patrimonial
              </h3>

              <p>
                Os saldos são atualizados
                automaticamente pelas movimentações
                da Engine Patrimonial.
              </p>
            </div>
          </div>

          <div className="tonfa-saldos-grid">
            <article
              className={obterClasseSaldo(
                saldos.total
              )}
            >
              <span>
                Carga total
              </span>

              <strong>
                {saldos.total}
              </strong>
            </article>

            <article
              className={obterClasseSaldo(
                saldos.p4
              )}
            >
              <span>
                Guarda do P4
              </span>

              <strong>
                {saldos.p4}
              </strong>
            </article>

            <article
              className={obterClasseSaldo(
                saldos.svdd
              )}
            >
              <span>
                Cofre do SVDD
              </span>

              <strong>
                {saldos.svdd}
              </strong>
            </article>

            <article
              className={obterClasseSaldo(
                saldos.emServico
              )}
            >
              <span>
                Em serviço
              </span>

              <strong>
                {saldos.emServico}
              </strong>
            </article>
          </div>

          {totalDistribuido > 0 && (
            <div className="tonfa-form-info">
              Existem{' '}
              <strong>
                {totalDistribuido}
              </strong>{' '}
              unidade(s) fora do P4. A quantidade
              total não pode ser reduzida abaixo
              desse valor.
            </div>
          )}
        </section>
      )}

      <form onSubmit={handleSubmit}>
        <div className="tonfa-form-grid">
          <label>
            <span>
              Tipo *
            </span>

            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              disabled={
                saving ||
                Boolean(
                  registroAtual?.id &&
                  totalDistribuido > 0
                )
              }
              required
            >
              {TIPOS_TONFA.map(
                (item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>

            {registroAtual?.id &&
              totalDistribuido > 0 && (
                <small>
                  O tipo não pode ser alterado
                  enquanto houver materiais
                  distribuídos.
                </small>
              )}
          </label>

          <label>
            <span>
              Quantidade total *
            </span>

            <input
              type="number"
              name="quantidade"
              min={quantidadeMinima}
              step="1"
              value={form.quantidade}
              onChange={handleChange}
              placeholder="Ex.: 40"
              disabled={saving}
              required
            />

            {registroAtual?.id && (
              <small>
                Quantidade mínima atual:{' '}
                {quantidadeMinima}
              </small>
            )}
          </label>

          <label>
            <span>
              Unidade *
            </span>

            <select
              name="unidade"
              value={form.unidade}
              onChange={handleChange}
              disabled={saving}
              required
            >
              <option value="">
                Selecione
              </option>

              {UNIDADES_27_BPMM.map(
                (unidade) => (
                  <option
                    key={unidade}
                    value={unidade}
                  >
                    {unidade}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="tonfa-field-full">
  <span>
    Localização patrimonial
  </span>

  <input
    className="tonfa-field-automatico"
    value={
      saldos.p4 > 0
        ? 'P4'
        : saldos.svdd > 0
          ? 'Cofre do SVDD'
          : saldos.emServico > 0
            ? 'Materiais em serviço'
            : registroAtual?.local_atual ||
              form.local_atual ||
              'P4'
    }
    readOnly
    disabled
  />

  <small>
    A localização é calculada pela Engine
    Patrimonial.
  </small>
</label>

          <label className="tonfa-field-full">
  <span>
    Localização patrimonial
  </span>

  <input
    value={
      saldos.p4 > 0
        ? 'P4'
        : saldos.svdd > 0
          ? 'Cofre do SVDD'
          : saldos.emServico > 0
            ? 'Materiais em serviço'
            : registroAtual?.local_atual ||
              form.local_atual ||
              'P4'
    }
    readOnly
    disabled
  />

  <small>
    A localização é calculada pela Engine
    Patrimonial.
  </small>
</label>

          <label className="tonfa-field-full">
            <span>
              Observações
            </span>

            <textarea
  name="observacoes"
  value={form.observacoes}
  onChange={handleChange}
  rows="4"
  placeholder="Ex.: Lote recebido do 27º BPM/M em 23/07/2026."
  disabled={saving}
/>
          </label>
        </div>

        <div className="tonfa-form-actions">
          <button
            type="button"
            className="tonfa-btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="tonfa-btn-primary"
            disabled={saving}
          >
            {saving
              ? 'Salvando...'
              : registroAtual?.id
                ? 'Salvar alterações'
                : 'Salvar estoque'}
          </button>
        </div>
      </form>

      {salvo?.id && (
        <div className="tonfa-after-save">
          <section className="tonfa-qr-card">
            <span className="tonfa-section-eyebrow">
              Identificação patrimonial
            </span>

            <h3>
              QR Code do estoque
            </h3>

            <div className="tonfa-qr-code-box">
              <QRCodeCanvas
                value={qrCodeAtual}
                size={150}
              />
            </div>

            <small>
              {qrCodeAtual}
            </small>
          </section>

          <section className="tonfa-fotos-card">
            <div className="tonfa-fotos-card-header">
              <span className="tonfa-section-eyebrow">
                Registro visual
              </span>

              <h3>
                Fotos do estoque
              </h3>

              <p>
                Adicione imagens para facilitar a
                identificação e a conferência
                patrimonial.
              </p>
            </div>

            <TonfaFotos
              tonfaId={salvo.id}
              user={user}
              fotoPrincipalAtual={
                salvo.foto_url ||
                ''
              }
              onFotoPrincipalAlterada={
                handleFotoPrincipalAlterada
              }
            />
          </section>
        </div>
      )}

      {salvo?.id && (
        <div className="tonfa-form-actions tonfa-finish-actions">
          <div className="tonfa-finish-text">
            <strong>
              Cadastro pronto
            </strong>

            <span>
              Revise os dados e conclua para voltar
              à listagem.
            </span>
          </div>

          <button
            type="button"
            className="tonfa-btn-primary"
            onClick={() =>
              onSaved?.(salvo)
            }
            disabled={saving}
          >
            Concluir cadastro
          </button>
        </div>
      )}
    </div>
  )
}