-- Founding a company under row level security.
--
-- 0001 left onboarding impossible, and the flow test in supabase/test/04_flow.sql
-- caught it: `companies` had no INSERT policy, and `memberships` required the
-- caller to already be a founder of the company they were joining. The first
-- founder could therefore never be created.
--
-- The fix is a single security-definer function rather than a pair of
-- permissive policies. Two reasons:
--
--   1. Atomicity. Creating the company and claiming it must happen in one
--      transaction. Done as two client calls with a permissive membership
--      policy, there is a window in which a company exists with no members, and
--      anyone who learns its id could claim it.
--   2. Least privilege. No INSERT policy on `companies` means there is no way
--      to create one except through this function, which always attaches the
--      caller as its founder.

create or replace function found_company(
  p_name               text,
  p_owner_display_name text,
  p_preferred_title    text default '회장님',
  p_preset             text default 'LOCAL_BUSINESS',
  p_locale             text default 'ko-KR'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_company uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'company name is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_owner_display_name), '') = '' then
    raise exception 'founder name is required' using errcode = '22023';
  end if;

  insert into companies (name, preset, locale)
  values (btrim(p_name), p_preset, p_locale)
  returning id into v_company;

  insert into memberships (user_id, company_id, role)
  values (v_user, v_company, 'FOUNDER');

  insert into founder_identities
    (company_id, user_id, owner_display_name, preferred_title, locale)
  values
    (v_company, v_user, btrim(p_owner_display_name),
     coalesce(nullif(btrim(p_preferred_title), ''), '회장님'), p_locale);

  return v_company;
end
$$;

revoke all on function found_company(text, text, text, text, text) from public;
grant execute on function found_company(text, text, text, text, text) to authenticated;
