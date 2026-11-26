
-- Hybrid online multiplayer: one device can own multiple player seats.
alter table public.ludo_room_members
  add column if not exists player_indices integer[] not null default '{}';

update public.ludo_room_members
set player_indices = array[player_index]
where cardinality(player_indices) = 0;

drop function if exists public.ludo_create_room(text, uuid);
drop function if exists public.ludo_join_room(text, text, uuid);

create function public.ludo_create_room(p_name text, p_token uuid, p_player_count integer default 1)
returns table(room_code text, room_state jsonb)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_code text;
  v_id uuid;
  v_state jsonb;
  v_players jsonb;
  v_indices integer[];
begin
  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 20 then
    raise exception 'Enter a name between 1 and 20 characters';
  end if;
  if p_token is null then raise exception 'Invalid player token'; end if;
  if p_player_count < 1 or p_player_count > 4 then
    raise exception 'Choose 1 to 4 players on this device';
  end if;

  loop
    v_code := lpad((floor(random() * 1000000))::bigint::text, 6, '0');
    exit when not exists (select 1 from public.ludo_rooms r where r.code = v_code);
  end loop;

  v_indices := array(select generate_series(0, p_player_count - 1));
  select jsonb_agg(jsonb_build_object(
    'name', case when i = 0 then trim(p_name) else trim(p_name) || ' ' || (i + 1)::text end,
    'color', (array['red', 'green', 'yellow', 'blue'])[i + 1],
    'ai', false,
    'tokens', jsonb_build_array(
      jsonb_build_object('progress', -1), jsonb_build_object('progress', -1),
      jsonb_build_object('progress', -1), jsonb_build_object('progress', -1)
    )
  ) order by i)
  into v_players
  from generate_series(0, p_player_count - 1) as s(i);

  v_state := jsonb_build_object(
    'players', v_players, 'turn', 0, 'dice', null, 'choices', jsonb_build_array(),
    'message', 'Waiting for players to join.', 'champion', null, 'started', false
  );
  insert into public.ludo_rooms(code, state, status)
    values (v_code, v_state, 'waiting') returning id into v_id;
  insert into public.ludo_room_members(room_id, player_token, player_index, player_indices, player_name)
    values (v_id, p_token, 0, v_indices, trim(p_name));
  return query select v_code, v_state;
end
$function$;

create function public.ludo_join_room(p_code text, p_name text, p_token uuid, p_player_count integer default 1)
returns table(room_code text, room_state jsonb, your_index integer)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_room public.ludo_rooms%rowtype;
  v_index integer;
  v_colors text[] := array['red', 'green', 'yellow', 'blue'];
  v_players jsonb;
  v_indices integer[];
begin
  if p_code !~ '^[0-9]{6}$' then raise exception 'Room code must be 6 digits'; end if;
  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 20 then
    raise exception 'Enter a name between 1 and 20 characters';
  end if;
  if p_player_count < 1 or p_player_count > 4 then
    raise exception 'Choose 1 to 4 players on this device';
  end if;

  select * into v_room from public.ludo_rooms where code = p_code for update;
  if not found then raise exception 'Room not found'; end if;

  select player_index into v_index
  from public.ludo_room_members
  where room_id = v_room.id and player_token = p_token;
  if found then
    return query select v_room.code, v_room.state, v_index;
    return;
  end if;

  if v_room.status <> 'waiting' then raise exception 'This room has already started'; end if;
  v_index := jsonb_array_length(v_room.state -> 'players');
  if v_index + p_player_count > 4 then raise exception 'Not enough player slots left in this room'; end if;

  v_indices := array(select generate_series(v_index, v_index + p_player_count - 1));
  select coalesce(v_room.state -> 'players', '[]'::jsonb) ||
    coalesce(jsonb_agg(jsonb_build_object(
      'name', case when i = v_index then trim(p_name) else trim(p_name) || ' ' || (i - v_index + 1)::text end,
      'color', v_colors[i + 1],
      'ai', false,
      'tokens', jsonb_build_array(
        jsonb_build_object('progress', -1), jsonb_build_object('progress', -1),
        jsonb_build_object('progress', -1), jsonb_build_object('progress', -1)
      )
    ) order by i), '[]'::jsonb)
  into v_players
  from generate_series(v_index, v_index + p_player_count - 1) as s(i);

  v_room.state := jsonb_set(v_room.state, '{players}', v_players);
  update public.ludo_rooms set state = v_room.state, updated_at = now() where id = v_room.id;
  insert into public.ludo_room_members(room_id, player_token, player_index, player_indices, player_name)
    values (v_room.id, p_token, v_index, v_indices, trim(p_name));
  return query select v_room.code, v_room.state, v_index;
end
$function$;

create or replace function public.ludo_get_my_seats(p_code text, p_token uuid)
returns integer[]
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare v_indices integer[];
begin
  select m.player_indices into v_indices
  from public.ludo_room_members m
  join public.ludo_rooms r on r.id = m.room_id
  where r.code = p_code and m.player_token = p_token;
  if v_indices is null then raise exception 'You are not a member of this room'; end if;
  return v_indices;
end
$function$;

create or replace function public.ludo_roll_dice(p_code text, p_token uuid)
returns integer
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_room public.ludo_rooms%rowtype;
  v_indices integer[];
  v_turn integer;
  v_roll integer;
begin
  select * into v_room from public.ludo_rooms where code = p_code for update;
  if not found then raise exception 'Room not found'; end if;
  select player_indices into v_indices
    from public.ludo_room_members where room_id = v_room.id and player_token = p_token;
  v_turn := (v_room.state ->> 'turn')::integer;
  if v_indices is null or not (v_turn = any(v_indices)) then raise exception 'It is not your turn'; end if;
  if v_room.state -> 'resetRequest' ->> 'status' = 'pending'
     and coalesce((v_room.state -> 'resetRequest' ->> 'expiresAt')::bigint, 0) >
       (extract(epoch from now()) * 1000)::bigint then
    raise exception 'A reset request is pending';
  end if;
  if v_room.status <> 'playing' or v_room.state -> 'dice' <> 'null'::jsonb then
    raise exception 'Dice is not ready';
  end if;
  v_roll := floor(random() * 6)::integer + 1;
  update public.ludo_rooms
    set state = jsonb_set(v_room.state, '{dice}', to_jsonb(v_roll)), updated_at = now()
    where id = v_room.id;
  return v_roll;
end
$function$;

create or replace function public.ludo_update_state(p_code text, p_token uuid, p_state jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_room public.ludo_rooms%rowtype;
  v_indices integer[];
  v_count integer;
  v_i integer;
  v_player jsonb;
  v_old_player jsonb;
  v_turn integer;
begin
  select * into v_room from public.ludo_rooms where code = p_code for update;
  if not found then raise exception 'Room not found'; end if;
  select player_indices into v_indices
    from public.ludo_room_members where room_id = v_room.id and player_token = p_token;
  v_turn := (v_room.state ->> 'turn')::integer;
  if v_indices is null or not (v_turn = any(v_indices)) then raise exception 'It is not your turn'; end if;
  if v_room.state -> 'resetRequest' ->> 'status' = 'pending'
     and coalesce((v_room.state -> 'resetRequest' ->> 'expiresAt')::bigint, 0) >
       (extract(epoch from now()) * 1000)::bigint then
    raise exception 'A reset request is pending';
  end if;
  if v_room.status <> 'playing' then raise exception 'Game is not active'; end if;
  if v_room.state -> 'dice' is null or v_room.state -> 'dice' = 'null'::jsonb then
    raise exception 'Roll the dice before moving';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array'
     or jsonb_array_length(p_state -> 'players') <> jsonb_array_length(v_room.state -> 'players') then
    raise exception 'Invalid game state';
  end if;

  v_count := jsonb_array_length(v_room.state -> 'players');
  v_turn := (p_state ->> 'turn')::integer;
  if v_turn < 0 or v_turn >= v_count then raise exception 'Invalid player turn'; end if;
  if v_turn not in ((v_room.state ->> 'turn')::integer,
      (((v_room.state ->> 'turn')::integer + 1) % v_count)) then
    raise exception 'Invalid turn progression';
  end if;
  if p_state -> 'dice' is distinct from 'null'::jsonb then
    raise exception 'Dice must be cleared after a move';
  end if;

  for v_i in 0 .. v_count - 1 loop
    v_player := p_state -> 'players' -> v_i;
    v_old_player := v_room.state -> 'players' -> v_i;
    if v_player ->> 'name' is distinct from v_old_player ->> 'name'
       or v_player ->> 'color' is distinct from v_old_player ->> 'color'
       or jsonb_array_length(v_player -> 'tokens') <> 4 then
      raise exception 'Invalid player data';
    end if;
    for v_player in select value from jsonb_array_elements(p_state -> 'players' -> v_i -> 'tokens') loop
      if jsonb_typeof(v_player -> 'progress') <> 'number'
         or (v_player ->> 'progress')::integer < -1
         or (v_player ->> 'progress')::integer > 56 then
        raise exception 'Invalid token position';
      end if;
    end loop;
  end loop;

  update public.ludo_rooms
    set state = p_state, updated_at = now(),
      status = case when p_state ->> 'champion' is not null and p_state ->> 'champion' <> 'null'
        then 'finished' else status end
    where id = v_room.id;
  return p_state;
end
$function$;
