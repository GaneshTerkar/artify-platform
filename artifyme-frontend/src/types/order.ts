export type Product = {
  id: string;
  name: string;
  description: string;
  base_price: number;
  currency: string;
  categories: { id: string; label: string }[];
  sizes: { id: string; label: string }[];
  subjects: { id: string; label: string }[];
};

export type Order = {
  order_id: string;
  user_id?: string;
  artist_id?: string;
  status: string;
  lifecycle_label: string;
  painting_category: string;
  size: string;
  persons_included: string;
  reference_image_url: string;
  delivery_address: string;
  total_price: number;
  customer_notes?: string;
  final_image_url?: string;
  created_at: string;
  updated_at?: string;
};

export type VerifiedArtist = {
  artist_id: string;
  full_name: string;
  email: string;
  experience_years: number;
  bio: string;
};

export type ArtistReviewItem = {
  artist_id: string;
  full_name: string;
  user_name: string;
  bio: string;
  experience_years: number;
  paintings_count: number;
  created_at: string;
};

export type Painting = {
  id: string;
  title: string;
  category: "PENCIL" | "CHARCOAL" | "WATERCOLOR" | "ACRYLIC" | "OIL";
  category_label: string;
  description: string;
  image_url: string;
  starting_price: number;
  artist_name?: string;
  source?: string;
};


