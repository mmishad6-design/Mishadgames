-- Server-side validation for online Ludo moves, captures, blockades, and no-move turns.
CREATE OR REPLACE FUNCTION public.ludo_update_state(p_code text, p_token uuid, p_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  v_room public.ludo_rooms%rowtype;
  v_indices integer[];
  v_old_players jsonb;
  v_new_players jsonb;
  v_count integer;
  v_i integer;
  v_j integer;
  v_k integer;
  v_player jsonb;
  v_old_player jsonb;
  v_token jsonb;
  v_old_token jsonb;
  v_color text;
  v_start integer;
  v_old_progress integer;
  v_new_progress integer;
  v_candidate_end integer;
  v_path_blocked boolean;
  v_has_legal boolean := false;
  v_mover_index integer;
  v_mover_old_progress integer;
  v_mover_new_progress integer;
  v_mover_start integer;
  v_dice integer;
  v_turn integer;
  v_expected_turn integer;
  v_landing_absolute integer;
  v_absolute integer;
  v_block_count integer;
  v_changed_own integer := 0;
  v_capture_count integer := 0;
  v_champion text;
  v_all_finished boolean;
begin
  select * into v_room from public.ludo_rooms where code = p_code for update;
  if not found then raise exception 'Room not found'; end if;

  select player_indices into v_indices
  from public.ludo_room_members
  where room_id = v_room.id and player_token = p_token;

  if v_indices is null then raise exception 'You are not a member of this room'; end if;
  v_turn := (v_room.state->>'turn')::integer;
  if not (v_turn = any(v_indices)) then raise exception 'It is not your turn'; end if;
  if v_room.state->'resetRequest'->>'status' = 'pending'
     and coalesce((v_room.state->'resetRequest'->>'expiresAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
  then raise exception 'A reset request is pending'; end if;
  if v_room.status <> 'playing' then raise exception 'Game is not active'; end if;
  if v_room.state->'dice' is null or v_room.state->'dice' = 'null'::jsonb then
    raise exception 'Roll the dice before moving';
  end if;
  if jsonb_typeof(p_state->'players') <> 'array' then raise exception 'Invalid game state'; end if;

  v_dice := (v_room.state->>'dice')::integer;
  if v_dice < 1 or v_dice > 6 then raise exception 'Invalid dice value'; end if;
  v_old_players := v_room.state->'players';
  v_new_players := p_state->'players';
  v_count := jsonb_array_length(v_old_players);
  if jsonb_array_length(v_new_players) <> v_count or v_count < 2 or v_count > 4 then
    raise exception 'Invalid game state';
  end if;

  -- Determine whether any token can legally move; a no-move roll must still be accepted.
  for v_i in 0..v_count-1 loop
    if v_i = v_turn then
      for v_j in 0..3 loop
        v_old_progress := (v_old_players->v_i->'tokens'->v_j->>'progress')::integer;
        if v_old_progress = -1 then
          if v_dice <> 6 then continue; end if;
          v_candidate_end := 0;
        elsif v_old_progress between 0 and 55 and v_old_progress + v_dice <= 56 then
          v_candidate_end := v_old_progress + v_dice;
        else
          continue;
        end if;

        v_path_blocked := false;
        v_color := v_old_players->v_i->>'color';
        v_start := case v_color when 'red' then 0 when 'green' then 13 when 'yellow' then 26 when 'blue' then 39 else null end;
        if v_start is null then raise exception 'Invalid player color'; end if;
        if v_old_progress < 51 then
          for v_k in greatest(0, v_old_progress + 1)..least(50, v_candidate_end) loop
            v_absolute := (v_start + v_k) % 52;
            if v_absolute not in (0,13,26,39) then
              select count(*) into v_block_count
              from jsonb_array_elements(v_old_players) as pl(p)
              cross join lateral jsonb_array_elements(pl.p->'tokens') as tk(t)
              where (tk.t->>'progress')::integer between 0 and 50
                and ((case pl.p->>'color' when 'red' then 0 when 'green' then 13 when 'yellow' then 26 when 'blue' then 39 else -100 end)
                     + (tk.t->>'progress')::integer) % 52 = v_absolute;
              if v_block_count >= 2 then v_path_blocked := true; exit; end if;
            end if;
          end loop;
        end if;
        if not v_path_blocked then v_has_legal := true; exit; end if;
      end loop;
    end if;
    if v_has_legal then exit; end if;
  end loop;

  v_mover_index := v_turn;
  v_old_player := v_old_players->v_mover_index;
  v_mover_start := case v_old_player->>'color' when 'red' then 0 when 'green' then 13 when 'yellow' then 26 when 'blue' then 39 else null end;
  if v_mover_start is null then raise exception 'Invalid player color'; end if;

  if not v_has_legal then
    if v_new_players is distinct from v_old_players then
      raise exception 'No legal move exists; player tokens cannot change';
    end if;
    v_expected_turn := case when v_dice = 6 then v_turn else (v_turn + 1) % v_count end;
    if (p_state->>'turn')::integer is distinct from v_expected_turn then
      raise exception 'Invalid turn progression after no legal move';
    end if;
    if p_state->'dice' is distinct from 'null'::jsonb then raise exception 'Dice must be cleared'; end if;
    if p_state->>'champion' is not null and p_state->>'champion' <> '' and p_state->>'champion' <> 'null' then
      raise exception 'Invalid winner state';
    end if;
    update public.ludo_rooms set state=p_state, updated_at=now() where id=v_room.id;
    return p_state;
  end if;

  -- Player identity and token shape are immutable during a move.
  for v_i in 0..v_count-1 loop
    v_player := v_new_players->v_i;
    v_old_player := v_old_players->v_i;
    if v_player->>'name' is distinct from v_old_player->>'name'
       or v_player->>'color' is distinct from v_old_player->>'color'
       or v_player->>'ai' is distinct from v_old_player->>'ai'
       or jsonb_typeof(v_player->'tokens') <> 'array'
       or jsonb_array_length(v_player->'tokens') <> 4
    then raise exception 'Invalid player data'; end if;

    for v_j in 0..3 loop
      v_token := v_player->'tokens'->v_j;
      v_old_token := v_old_players->v_i->'tokens'->v_j;
      if jsonb_typeof(v_token->'progress') <> 'number'
         or jsonb_typeof(v_old_token->'progress') <> 'number'
      then raise exception 'Invalid token position'; end if;
      v_old_progress := (v_old_token->>'progress')::integer;
      v_new_progress := (v_token->>'progress')::integer;
      if v_new_progress < -1 or v_new_progress > 56 or v_old_progress < -1 or v_old_progress > 56 then
        raise exception 'Invalid token position'; end if;

      if v_i = v_mover_index then
        if v_new_progress <> v_old_progress then
          v_changed_own := v_changed_own + 1;
          v_mover_old_progress := v_old_progress;
          v_mover_new_progress := v_new_progress;
          if v_changed_own > 1 then raise exception 'Only one token may move per turn'; end if;
          if v_old_progress = -1 then
            if v_dice <> 6 or v_new_progress <> 0 then raise exception 'Illegal token entry'; end if;
          elsif v_old_progress >= 0 and v_old_progress <= 55 then
            if v_new_progress <> v_old_progress + v_dice or v_new_progress > 56 then
              raise exception 'Illegal token movement'; end if;
          else
            raise exception 'Token has already finished';
          end if;
        end if;
      elsif v_new_progress <> v_old_progress then
        v_color := v_old_player->>'color';
        v_start := case v_color when 'red' then 0 when 'green' then 13 when 'yellow' then 26 when 'blue' then 39 else null end;
        if v_new_progress <> -1 or v_old_progress < 0 or v_old_progress > 50 or v_start is null then
          raise exception 'Invalid opponent token change';
        end if;
        v_capture_count := v_capture_count + 1;
      end if;
    end loop;
  end loop;

  if v_changed_own <> 1 then raise exception 'Exactly one active token must move'; end if;
  v_landing_absolute := case when v_mover_new_progress between 0 and 50
    then (v_mover_start + v_mover_new_progress) % 52 else -1 end;

  if v_capture_count > 0 then
    for v_i in 0..v_count-1 loop
      if v_i <> v_mover_index then
        v_color := v_old_players->v_i->>'color';
        v_start := case v_color when 'red' then 0 when 'green' then 13 when 'yellow' then 26 when 'blue' then 39 else null end;
        for v_j in 0..3 loop
          v_old_progress := (v_old_players->v_i->'tokens'->v_j->>'progress')::integer;
          v_new_progress := (v_new_players->v_i->'tokens'->v_j->>'progress')::integer;
          if v_new_progress <> v_old_progress then
            if v_landing_absolute < 0 or v_landing_absolute in (0,8,13,21,26,34,39,47)
               or v_start is null or ((v_start + v_old_progress) % 52) <> v_landing_absolute
            then raise exception 'Invalid capture'; end if;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  if v_mover_old_progress < 51 then
    for v_k in greatest(0, v_mover_old_progress + 1)..least(50, v_mover_new_progress) loop
      v_absolute := (v_mover_start + v_k) % 52;
      if v_absolute not in (0,13,26,39) then
        select count(*) into v_block_count
        from jsonb_array_elements(v_old_players) with ordinality as pl(p, pi)
        cross join lateral jsonb_array_elements(pl.p->'tokens') as tk(t)
        where (tk.t->>'progress')::integer between 0 and 50
          and ((case pl.p->>'color' when 'red' then 0 when 'green' then 13 when 'yellow' then 26 when 'blue' then 39 else -100 end)
               + (tk.t->>'progress')::integer) % 52 = v_absolute;
        if v_block_count >= 2 then raise exception 'A blockade blocks that path'; end if;
      end if;
    end loop;
  end if;

  v_expected_turn := case
    when v_dice = 6 or v_capture_count > 0 or v_mover_new_progress = 56 then v_turn
    else (v_turn + 1) % v_count
  end;
  if (p_state->>'turn')::integer is distinct from v_expected_turn then
    raise exception 'Invalid turn progression';
  end if;
  if p_state->'dice' is distinct from 'null'::jsonb then raise exception 'Dice must be cleared after a move'; end if;

  select bool_and((t->>'progress')::integer = 56) into v_all_finished
  from jsonb_array_elements(v_new_players->v_mover_index->'tokens') t;
  v_champion := p_state->>'champion';
  if coalesce(v_all_finished,false) then
    if v_champion is distinct from (v_new_players->v_mover_index->>'name') then
      raise exception 'Winner state does not match token positions';
    end if;
  elsif v_champion is not null and v_champion <> '' and v_champion <> 'null' then
    raise exception 'Invalid winner state';
  end if;

  update public.ludo_rooms
  set state=p_state, updated_at=now(),
      status=case when coalesce(v_all_finished,false) then 'finished' else status end
  where id=v_room.id;
  return p_state;
end
$function$
;
