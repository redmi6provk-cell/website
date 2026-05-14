cloudflared tunnel --config C:\Users\ashu\.cloudflared\fmcg.yml run fmcg
cloudflared tunnel --config C:\Users\ashu\.cloudflared\fmcgapi.yml run fmcgapi



BEGIN;

TRUNCATE TABLE
  carts,
  order_status_events,
  order_items,
  orders,
  purchase_items,
  purchases,
  offline_sale_items,
  offline_sales,
  expenses,
  finance_transactions,
  payments,
  invoice_items,
  invoices,
  party_contacts,
  parties,
  products,
  categories,
  brands
RESTART IDENTITY CASCADE;

DELETE FROM users
WHERE role = 'USER';

COMMIT;


reset bank 
UPDATE admin_settings
SET
  cash_balance = 0,
  bank_accounts_json = '[]',
  updated_at = now();
