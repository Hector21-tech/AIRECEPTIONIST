-- Add Restaurant Scraper Integration Columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS restaurant_slug VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS knowledge_base_id VARCHAR(100);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_slug ON customers(restaurant_slug);
CREATE INDEX IF NOT EXISTS idx_customers_knowledge_base_id ON customers(knowledge_base_id);
