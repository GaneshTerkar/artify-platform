package orders

// Portrait sketch catalog derived from DB enums and pricing trigger (007).

type ProductOption struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	PriceFactor float64 `json:"price_factor,omitempty"`
}

type Product struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	BasePrice   float64         `json:"base_price"`
	Currency    string          `json:"currency"`
	Categories  []ProductOption `json:"categories"`
	Sizes       []ProductOption `json:"sizes"`
	Subjects    []ProductOption `json:"subjects"`
}

func DefaultPortraitProduct() Product {
	return Product{
		ID:          "portrait-sketch",
		Name:        "Portrait Sketch",
		Description: "Custom hand-drawn portrait from your reference photo.",
		BasePrice:   1550,
		Currency:    "INR",
		Categories: []ProductOption{
			{ID: "PENCIL", Label: "Pencil", PriceFactor: 1.0},
			{ID: "CHARCOAL", Label: "Charcoal", PriceFactor: 1.2},
			{ID: "WATERCOLOR", Label: "Watercolor", PriceFactor: 1.3},
			{ID: "ACRYLIC", Label: "Acrylic", PriceFactor: 1.5},
			{ID: "OIL", Label: "Oil", PriceFactor: 1.8},
		},
		Sizes: []ProductOption{
			{ID: "A4", Label: "A4", PriceFactor: 1.0},
			{ID: "A3", Label: "A3", PriceFactor: 2.0},
			{ID: "A2", Label: "A2", PriceFactor: 3.0},
		},
		Subjects: []ProductOption{
			{ID: "SINGLE", Label: "Single person", PriceFactor: 1.0},
			{ID: "COUPLE", Label: "Couple", PriceFactor: 1.3},
			{ID: "FAMILY", Label: "Family", PriceFactor: 1.6},
		},
	}
}

// EstimatePrice mirrors DB trigger calculate_order_total_price (1500 * factors + 50, cap 5000).
func EstimatePrice(category, size, persons string) float64 {
	catFactor := map[string]float64{
		"PENCIL": 1.0, "CHARCOAL": 1.2, "OIL": 1.8, "ACRYLIC": 1.5, "WATERCOLOR": 1.3,
	}
	sizeFactor := map[string]float64{"A4": 1.0, "A3": 2.0, "A2": 3.0}
	personFactor := map[string]float64{"SINGLE": 1.0, "COUPLE": 1.3, "FAMILY": 1.6}

	cf := catFactor[category]
	if cf == 0 {
		cf = 1
	}
	sf := sizeFactor[size]
	if sf == 0 {
		sf = 1
	}
	pf := personFactor[persons]
	if pf == 0 {
		pf = 1
	}

	total := 1500.0*cf*sf*pf + 50.0
	if total > 5000 {
		total = 5000
	}
	return total
}
