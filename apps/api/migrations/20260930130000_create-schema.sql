-- Up Migration

CREATE TYPE description_variant AS ENUM ('short', 'medium', 'seo');
CREATE TYPE llm_call_status AS ENUM ('ok', 'invalid_output', 'error');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  title text NOT NULL,
  category text NOT NULL,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_user_id_created_at_idx ON products (user_id, created_at DESC);

CREATE TABLE descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  variant description_variant NOT NULL,
  content text NOT NULL,
  edited_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX descriptions_product_id_idx ON descriptions (product_id);

-- One row per LLM call, failures included, so real costs can be measured.
CREATE TABLE llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  product_id uuid REFERENCES products (id) ON DELETE SET NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6),
  latency_ms integer NOT NULL,
  status llm_call_status NOT NULL,
  error_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX llm_calls_user_id_idx ON llm_calls (user_id);
CREATE INDEX llm_calls_product_id_idx ON llm_calls (product_id);

-- Down Migration

DROP TABLE llm_calls;
DROP TABLE descriptions;
DROP TABLE products;
DROP TABLE users;
DROP TYPE llm_call_status;
DROP TYPE description_variant;
