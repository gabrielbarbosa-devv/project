-- Exemplo de verificação manual. Execute somente no Supabase local.
-- Substitua os UUIDs por dois usuários de teste e um workspace/canal que pertença ao usuário B.
-- Como usuário A, as consultas abaixo devem retornar zero linhas.

begin;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);

select id, name
from public.workspaces
where id = 'WORKSPACE_B_UUID'::uuid;

select id, name
from public.channels
where workspace_id = 'WORKSPACE_B_UUID'::uuid;

rollback;
