-- Fix users table with plaintext passwords for development
-- Run this in Supabase SQL Editor

DELETE FROM users WHERE email IN ('admin@zai.com', 'supervisor@zai.com', 'inventory@zai.com', 'cashier@zai.com');

INSERT INTO users (name, email, password, role) VALUES
  ('Admin User', 'admin@zai.com', 'Admin@1234', 'admin'),
  ('Supervisor', 'supervisor@zai.com', 'Super@1234', 'supervisor'),
  ('Inventory Officer', 'inventory@zai.com', 'Inv@1234', 'inventory'),
  ('Cashier One', 'cashier@zai.com', 'Cash@1234', 'cashier');

-- Verify the users were inserted
SELECT id, name, email, role, password FROM users;
