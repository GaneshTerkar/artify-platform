CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE user_role AS ENUM ('ADMIN', 'ARTIST', 'CUSTOMER', 'DELIVERY_AGENT');
CREATE TYPE account_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE painting_size AS ENUM ('A4', 'A3', 'A2');
CREATE TYPE person_included AS ENUM ('SINGLE', 'COUPLE', 'FAMILY');
CREATE TYPE painting_category AS ENUM ('PENCIL','CHARCOAL','OIL','ACRYLIC','WATERCOLOR');
CREATE TYPE order_status AS ENUM (
  'PLACED','CONFIRMED','ASSIGNED_ARTIST','IN_PROGRESS','COMPLETED',
  'ASSIGNED_DELIVERY_AGENT','OUT_FOR_DELIVERY','DELIVERED',
  'REQUESTED_CANCELLATION','CANCELLED'
);

-- USERS
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(150) NOT NULL,
  user_name VARCHAR(100) UNIQUE,
  email VARCHAR(150) UNIQUE NOT NULL,
  address TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  status account_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ARTIST PROFILES
CREATE TABLE artist_profiles (
  artist_prof_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  bio TEXT,
  experience_years INT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ARTIST PAINTINGS
CREATE TABLE artist_paintings (
  painting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category painting_category NOT NULL DEFAULT 'PENCIL',
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS
CREATE TABLE orders (
  order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  artist_id UUID REFERENCES users(user_id),
  painting_category painting_category NOT NULL DEFAULT 'PENCIL',
  reference_image_url TEXT NOT NULL,
  final_image_url TEXT,
  size painting_size NOT NULL DEFAULT 'A4',
  persons_included person_included NOT NULL DEFAULT 'SINGLE',
  status order_status NOT NULL DEFAULT 'PLACED',
  delivery_address TEXT NOT NULL,
  delivery_agent_id UUID REFERENCES users(user_id),
  total_price NUMERIC(10,2) NOT NULL DEFAULT 1349.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES users(user_id)
);

-- ORDER STATUS HISTORY
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  old_status order_status NOT NULL,
  new_status order_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(user_id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
  sent_by UUID REFERENCES users(user_id),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FILES
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  file_type VARCHAR(50),
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
