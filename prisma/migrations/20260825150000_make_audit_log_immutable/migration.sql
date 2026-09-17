-- Audit kaydı yalnız ekleme mantığıyla çalışır. Uygulama hesabı veya doğrudan
-- SQL kullanan bakım araçları mevcut audit satırlarını değiştiremez ya da
-- silemez; düzeltmeler yeni bir audit olayıyla izlenir.
CREATE OR REPLACE FUNCTION "audit_kaydi_degisimini_engelle"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditKaydi kayıtları değiştirilemez veya silinemez';
END;
$$;

CREATE TRIGGER "AuditKaydi_immutable"
BEFORE UPDATE OR DELETE ON "AuditKaydi"
FOR EACH ROW
EXECUTE FUNCTION "audit_kaydi_degisimini_engelle"();
