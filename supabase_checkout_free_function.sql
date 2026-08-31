-- Run in Supabase Dashboard → SQL Editor
-- Lets a customer claim a ฿0 order (free/trial pricing) without going through Stripe.
-- Re-validates ownership, pending status, and the ฿0 total server-side before granting
-- entitlements — never trusts the client on whether an order is actually free.

create or replace function public.checkout_free(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_order record;
begin
  if v_customer_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'ไม่พบคำสั่งซื้อนี้';
  end if;

  if v_order.customer_id <> v_customer_id then
    raise exception 'ไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'คำสั่งซื้อนี้ไม่สามารถดำเนินการได้ (สถานะไม่ใช่ pending)';
  end if;

  if v_order.total_baht <> 0 then
    raise exception 'คำสั่งซื้อนี้ไม่ใช่รายการฟรี ต้องชำระเงินผ่าน Stripe';
  end if;

  update public.orders set status = 'paid' where id = p_order_id;

  perform public.grant_entitlements_for_order(p_order_id);

  return jsonb_build_object('order_id', p_order_id, 'status', 'paid');
end;
$$;

grant execute on function public.checkout_free(uuid) to authenticated;
