-- 1. Corrigindo o "Search Path Mutable" (Protegendo os caminhos internos das funções)
ALTER FUNCTION public.update_full_operations_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. Revogando o acesso público/anônimo direto da API para funções críticas
REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

-- 3. Garantindo que apenas usuários logados (ou o sistema interno) possam usá-las
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
