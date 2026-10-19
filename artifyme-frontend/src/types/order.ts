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
  delivery_agent_id?: string;
  customer_name?: string;
  customer_phone?: string;
  artist_name?: string;
  artist_phone?: string;
  delivery_agent_name?: string;
  delivery_agent_phone?: string;
  status: string;
  lifecycle_label: string;
  painting_category: string;
  size: string;
  persons_included: string;
  reference_image_url: string;
  delivery_address: string;
  delivery_attempts?: number;
  delivery_failure_reason?: string;
  last_delivery_attempt_at?: string;
  total_price: number;
  customer_notes?: string;
  courier_partner?: string;
  tracking_number?: string;
  estimated_delivery_at?: string;
  admin_dispatch_notes?: string;
  final_image_url?: string;
  collage_image_url?: string;
  original_final_image_url?: string;
  is_published_to_gallery?: boolean;
  created_at: string;
  updated_at?: string;
  version?: number;
};

export type Review = {
  review_id: string;
  order_id: string;
  customer_id: string;
  customer_name?: string;
  artist_id?: string;
  artist_name?: string;
  painting_category?: string;
  final_image_url?: string;
  rating: number;
  title: string;
  comment: string;
  unboxing_photo_url?: string;
  is_featured: boolean;
  is_approved: boolean;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
};

export type ReviewStats = {
  total_reviews: number;
  average_rating: number;
  csat_score_percent: number;
  rating_distribution: Record<string, number>;
  quality_alerts_count: number;
  artist_leaderboard: {
    artist_id: string;
    artist_name: string;
    total_reviews: number;
    average_rating: number;
  }[];
};

export type ActiveDeliveryAgent = {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  status: string;
};

export type VerifiedArtist = {
  artist_id: string;
  full_name: string;
  email: string;
  phone_number?: string;
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

export type PlatformUser = {
  user_id: string;
  full_name: string;
  user_name: string;
  email: string;
  address: string;
  phone_number: string;
  role: "CUSTOMER" | "ARTIST" | "ADMIN" | "DELIVERY_AGENT";
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  is_verified_artist: boolean;
  experience_years: number;
  bio: string;
  orders_count: number;
  assigned_orders_count: number;
  created_at: string;
};


