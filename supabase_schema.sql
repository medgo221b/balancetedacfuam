-- Table for storing bank transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_id TEXT, 
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT DEFAULT 'Geral',
  type TEXT DEFAULT 'transaction', 
  source_file TEXT,
  sequence INTEGER DEFAULT 0, -- To maintain order within the same day
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operation_id, date, amount, description)
);

-- Enable Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows everyone to read (for now, during development)
CREATE POLICY "Allow public read access" ON transactions FOR SELECT USING (true);

-- Create a policy that allows everyone to insert (for now, during development)
CREATE POLICY "Allow public insert access" ON transactions FOR INSERT WITH CHECK (true);
