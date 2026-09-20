ALTER TABLE transactions ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
