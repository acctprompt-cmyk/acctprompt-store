-- Run in Supabase Dashboard → SQL Editor
-- Creates a secure checkout path for customers: validates prices server-side
-- (never trusts price from the client), then inserts orders + order_items.
--
-- Keyed by price_id (a specific tool_prices row) rather than (tool_id,
-- billing_type) so a tool with multiple screen-count tiers at the same
-- billing period (e.g. 1/3/5 screens, all "monthly") resolves to the exact
-- tier the customer picked instead of an arbitrary row.

create or replace function public.checkout(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_order_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_price_id uuid;
  v_price record;
begin
  if v_customer_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนสั่งซื้อ';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'ตะกร้าว่างเปล่า';
  end if;

  -- Pass 1: validate every item and compute the real total from tool_prices.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_price_id := (v_item->>'price_id')::uuid;

    select * into v_price
    from public.tool_prices
    where id = v_price_id
      and is_active = true
    limit 1;

    if not found then
      raise exception 'ไม่พบราคาที่ใช้งานได้สำหรับตัวเลือกนี้: %', v_price_id;
    end if;

    v_total := v_total + v_price.price_baht;
  end loop;

  insert into public.orders (customer_id, total_baht, status)
  values (v_customer_id, v_total, 'pending')
  returning id into v_order_id;

  -- Pass 2: insert order_items with the same server-computed prices.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_price_id := (v_item->>'price_id')::uuid;

    select * into v_price
    from public.tool_prices
    where id = v_price_id
      and is_active = true
    limit 1;

    insert into public.order_items (order_id, tool_id, price_baht, billing_type, max_sessions)
    values (v_order_id, v_price.tool_id, v_price.price_baht, v_price.billing_type, v_price.max_sessions);
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'total_baht', v_total);
end;
$$;

grant execute on function public.checkout(jsonb) to authenticated;
