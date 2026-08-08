-- SIGMO Sprint 7.6.12
-- Finaliza somente os itens de uma DEVOLUCAO que já foram efetivamente
-- recebidos pelos services operacionais. Esta RPC NÃO movimenta patrimônio
-- e NÃO altera saldos; ela apenas conclui o documento de devolução.

create or replace function public.sigmo_confirmar_itens_devolucao(
  p_movimentacao_id uuid,
  p_item_ids uuid[],
  p_recebedor_id uuid,
  p_recebedor_nome text,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_mov public.sigmo_movimentacoes%rowtype;
  v_total_pendentes integer := 0;
  v_total_atualizados integer := 0;
  v_finalizada boolean := false;
begin
  select *
    into v_mov
  from public.sigmo_movimentacoes
  where id = p_movimentacao_id
  for update;

  if v_mov.id is null then
    raise exception 'Movimentação não encontrada.';
  end if;

  if upper(coalesce(v_mov.tipo_movimentacao, '')) <> 'DEVOLUCAO' then
    raise exception 'A movimentação informada não é uma devolução.';
  end if;

  if v_mov.status not in (
    'aguardando_recebimento',
    'alteracao_solicitada',
    'em_andamento'
  ) then
    raise exception 'A devolução não está disponível para recebimento.';
  end if;

  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    raise exception 'Nenhum item da devolução foi informado.';
  end if;

  update public.sigmo_movimentacao_itens
  set status_item = 'recebido'
  where movimentacao_id = p_movimentacao_id
    and id = any(p_item_ids)
    and coalesce(status_item, '') <> 'recebido';

  get diagnostics v_total_atualizados = row_count;

  select count(*)
    into v_total_pendentes
  from public.sigmo_movimentacao_itens
  where movimentacao_id = p_movimentacao_id
    and coalesce(status_item, '') <> 'recebido';

  v_finalizada := v_total_pendentes = 0;

  update public.sigmo_movimentacao_recebimentos
  set
    recebedor_id = p_recebedor_id,
    recebedor_nome = p_recebedor_nome,
    status = case when v_finalizada then 'recebido' else status end,
    observacao = coalesce(p_observacao, observacao),
    updated_at = now()
  where movimentacao_id = p_movimentacao_id;

  if v_finalizada then
    update public.sigmo_movimentacoes
    set
      status = 'finalizada',
      recebedor_id = p_recebedor_id,
      recebedor_nome = p_recebedor_nome,
      finalizada_at = now(),
      updated_at = now()
    where id = p_movimentacao_id;
  else
    update public.sigmo_movimentacoes
    set updated_at = now()
    where id = p_movimentacao_id;
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'movimentacao_id', p_movimentacao_id,
    'itens_atualizados', v_total_atualizados,
    'itens_pendentes', v_total_pendentes,
    'finalizada', v_finalizada
  );
end;
$function$;

grant execute on function public.sigmo_confirmar_itens_devolucao(
  uuid,
  uuid[],
  uuid,
  text,
  text
) to authenticated;
