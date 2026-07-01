-- =========================================================
-- 1. CORREÇÃO DE FUNÇÕES (SEARCH PATH E PERMISSÕES)
-- =========================================================
ALTER FUNCTION public.update_full_operations_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- =========================================================
-- 2. CORREÇÃO DE POLÍTICAS RLS "ALWAYS TRUE" (BLINDAGEM)
-- =========================================================

-- Tabela: audit_logs
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Tabela: import_history
DROP POLICY IF EXISTS delete_import_history ON public.import_history;
DROP POLICY IF EXISTS insert_import_history ON public.import_history;
DROP POLICY IF EXISTS update_import_history ON public.import_history;

CREATE POLICY delete_import_history ON public.import_history 
  FOR DELETE USING (company_id::text = get_my_company_id());
CREATE POLICY insert_import_history ON public.import_history 
  FOR INSERT WITH CHECK (company_id::text = get_my_company_id());
CREATE POLICY update_import_history ON public.import_history 
  FOR UPDATE USING (company_id::text = get_my_company_id()) WITH CHECK (company_id::text = get_my_company_id());

-- Tabela: import_products_audit
DROP POLICY IF EXISTS delete_import_products_audit ON public.import_products_audit;
DROP POLICY IF EXISTS insert_import_products_audit ON public.import_products_audit;

CREATE POLICY delete_import_products_audit ON public.import_products_audit 
  FOR DELETE USING (company_id::text = get_my_company_id());
CREATE POLICY insert_import_products_audit ON public.import_products_audit 
  FOR INSERT WITH CHECK (company_id::text = get_my_company_id());

-- Tabela: inventory_kpi_history
DROP POLICY IF EXISTS anon_delete_inventory_kpi_history ON public.inventory_kpi_history;
DROP POLICY IF EXISTS anon_insert_inventory_kpi_history ON public.inventory_kpi_history;
DROP POLICY IF EXISTS anon_update_inventory_kpi_history ON public.inventory_kpi_history;

CREATE POLICY anon_delete_inventory_kpi_history ON public.inventory_kpi_history 
  FOR DELETE USING (company_id::text = get_my_company_id());
CREATE POLICY anon_insert_inventory_kpi_history ON public.inventory_kpi_history 
  FOR INSERT WITH CHECK (company_id::text = get_my_company_id());
CREATE POLICY anon_update_inventory_kpi_history ON public.inventory_kpi_history 
  FOR UPDATE USING (company_id::text = get_my_company_id()) WITH CHECK (company_id::text = get_my_company_id());

-- Tabela: inventory_top_vendas_history
DROP POLICY IF EXISTS anon_delete_inventory_top_vendas_history ON public.inventory_top_vendas_history;
DROP POLICY IF EXISTS anon_insert_inventory_top_vendas_history ON public.inventory_top_vendas_history;
DROP POLICY IF EXISTS anon_update_inventory_top_vendas_history ON public.inventory_top_vendas_history;

CREATE POLICY anon_delete_inventory_top_vendas_history ON public.inventory_top_vendas_history 
  FOR DELETE USING (company_id::text = get_my_company_id());
CREATE POLICY anon_insert_inventory_top_vendas_history ON public.inventory_top_vendas_history 
  FOR INSERT WITH CHECK (company_id::text = get_my_company_id());
CREATE POLICY anon_update_inventory_top_vendas_history ON public.inventory_top_vendas_history 
  FOR UPDATE USING (company_id::text = get_my_company_id()) WITH CHECK (company_id::text = get_my_company_id());
