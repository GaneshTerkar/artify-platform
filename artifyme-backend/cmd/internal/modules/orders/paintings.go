package orders

import (
	"strings"
	"time"
)

type PaintingItem struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Category      string    `json:"category"`
	CategoryLabel string    `json:"category_label"`
	Description   string    `json:"description"`
	ImageURL      string    `json:"image_url"`
	StartingPrice float64   `json:"starting_price"`
	ArtistName    string    `json:"artist_name,omitempty"`
	Source        string    `json:"source,omitempty"`
	CreatedAt     time.Time `json:"created_at,omitempty"`
}

func CategoryLabel(cat string) string {
	switch strings.ToUpper(strings.TrimSpace(cat)) {
	case "PENCIL":
		return "Pencil Sketch"
	case "CHARCOAL":
		return "Charcoal Portrait"
	case "WATERCOLOR":
		return "Watercolor Artwork"
	case "ACRYLIC":
		return "Acrylic Painting"
	case "OIL":
		return "Oil Painting"
	default:
		return cat
	}
}

func CategoryStartingPrice(cat string) float64 {
	switch strings.ToUpper(strings.TrimSpace(cat)) {
	case "PENCIL":
		return 1550
	case "CHARCOAL":
		return 1850
	case "WATERCOLOR":
		return 2000
	case "ACRYLIC":
		return 2300
	case "OIL":
		return 2750
	default:
		return 1550
	}
}

// Fallback authentic paintings in case of offline DB
var fallbackPaintings = []PaintingItem{
	// PENCIL
	{
		ID:            "paint-pencil-1",
		Title:         "Mother & Daughter Bond",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Delicate graphite pencil artwork capturing the heartfelt bond between mother and daughter, drawn with fine tonal grades on archival paper.",
		ImageURL:      "/paintings/FotoGrid_20230705_151914628.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-2",
		Title:         "Traditional Couple Celebration Sketch",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Intricately detailed graphite portrait in traditional Indian wedding attire with ornate vest and saree embroidery.",
		ImageURL:      "/paintings/PhotoGrid_1580669157513.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-3",
		Title:         "Wedding Couple Graphite Portrait",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Soft graphite pencil portrait capturing warm smiles and wedding attire details.",
		ImageURL:      "/paintings/PhotoGrid_1581055303423.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-4",
		Title:         "Modern Woman Portrait",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Contemporary graphite portrait capturing sparkling expression, glasses, and denim jacket texture.",
		ImageURL:      "/paintings/PhotoGrid_1581056490239.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-5",
		Title:         "Golden Anniversary Couple Sketch",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Loving tribute portrait of an elderly couple rendered with fine graphite pencils and realistic facial contours.",
		ImageURL:      "/paintings/PhotoGrid_1581056666012.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-6",
		Title:         "Charming Baby with Cap",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Adorable pencil sketch of a baby with big curious eyes and a backwards cap, hand-shaded with 2B-6B pencils.",
		ImageURL:      "/paintings/PhotoGrid_1581058907670.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-7",
		Title:         "Joyful Smiling Woman Sketch",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Clean and vibrant pencil shading highlighting a natural glowing smile and flowing hair.",
		ImageURL:      "/paintings/Screenshot_20211223-215639__01.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-8",
		Title:         "Traditional Saree Portrait",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Graceful graphite study portraying traditional Indian attire with intricate polka saree motifs.",
		ImageURL:      "/paintings/Screenshot_20211223-215655__01.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-pencil-9",
		Title:         "Confident Gentleman Portrait",
		Category:      "PENCIL",
		CategoryLabel: "Pencil Sketch",
		Description:   "Bold graphite pencil sketch of a gentleman with folded arms and striped polo shirt, highlighting realistic shading.",
		ImageURL:      "/paintings/Screenshot_20211223-215703__01.jpg",
		StartingPrice: 1550,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},

	// CHARCOAL
	{
		ID:            "paint-charcoal-1",
		Title:         "Serene Woman in Black Saree",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Deep velvety charcoal portrait emphasizing rich shadows, embroidered pallu patterns, and meditative expression.",
		ImageURL:      "/paintings/PhotoGrid_1581055403972.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-2",
		Title:         "Girl in Summer Hat",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Expressive charcoal sketch with dark smudged background and vivid tonal depth on sun hat and smiling expression.",
		ImageURL:      "/paintings/PhotoGrid_1581056344798.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-3",
		Title:         "Thoughtful Gentleman Study",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Dramatic charcoal study depicting beard and spectacles with bold tonal contrast and smudged gradients.",
		ImageURL:      "/paintings/PhotoGrid_1581056549765.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-4",
		Title:         "Young Couple Duo in Charcoal",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Masterful willow and compressed charcoal portrait capturing a loving couple with crisp clothing text and realistic lighting.",
		ImageURL:      "/paintings/PhotoGrid_1581058556583.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-5",
		Title:         "Affectionate Couple Portrait",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Atmospheric charcoal drawing with nuanced tonal transitions and heartfelt warmth.",
		ImageURL:      "/paintings/PhotoGrid_1581059479847.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-6",
		Title:         "Contemporary Couple Portrait",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "High-contrast charcoal piece rendering textures of patterned apparel, eyeglasses, and expressive eyes.",
		ImageURL:      "/paintings/PhotoGrid_1581222315784.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-7",
		Title:         "Romantic Evening Portrait",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Intense charcoal artwork capturing rich black fabric folds, henna tattoo details, and gentle companionship.",
		ImageURL:      "/paintings/PhotoGrid_1581278322620.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-8",
		Title:         "Playful Back-to-Back Couple",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Dynamic charcoal composition featuring textured clothing folds, smudged vignette background, and shared laughter.",
		ImageURL:      "/paintings/PhotoGrid_1581625154697.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-charcoal-9",
		Title:         "Indira Gandhi Historical Tribute",
		Category:      "CHARCOAL",
		CategoryLabel: "Charcoal Portrait",
		Description:   "Historic charcoal and white chalk portrait of Prime Minister Indira Gandhi detailing the iconic saree and focused gaze.",
		ImageURL:      "/paintings/PhotoGrid_1590847935658.jpg",
		StartingPrice: 1850,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},

	// WATERCOLOR
	{
		ID:            "paint-watercolor-1",
		Title:         "Pastel Toned Watercolor Portrait",
		Category:      "WATERCOLOR",
		CategoryLabel: "Watercolor Artwork",
		Description:   "Luminous color portrait rendered with soft watercolor and gouache washes on textured cold-press paper with mint green background.",
		ImageURL:      "/paintings/PhotoGrid_1581056422304.jpg",
		StartingPrice: 2000,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},

	// ACRYLIC
	{
		ID:            "paint-acrylic-1",
		Title:         "Radiant Woman in Lime Green",
		Category:      "ACRYLIC",
		CategoryLabel: "Acrylic Painting",
		Description:   "Vibrant acrylic portrait painted on primed canvas board with warm burnt sienna background and rich color blending.",
		ImageURL:      "/paintings/PhotoGrid_1581055639136.jpg",
		StartingPrice: 2300,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
	{
		ID:            "paint-acrylic-2",
		Title:         "Birds of Harmony on Sunrise Branch",
		Category:      "ACRYLIC",
		CategoryLabel: "Acrylic Painting",
		Description:   "Vivid colorful acrylic canvas art featuring rainbow sunset sponge-dabbing, silhouette branches, and 3D sculpted clay birds and leaves.",
		ImageURL:      "/paintings/PhotoGrid_1581058790907.jpg",
		StartingPrice: 2300,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},

	// OIL
	{
		ID:            "paint-oil-1",
		Title:         "Heirloom Oil Portrait on Stretched Canvas",
		Category:      "OIL",
		CategoryLabel: "Oil Painting",
		Description:   "Classic oil on canvas portrait of a woman in emerald green against a serene azure sky, signed Ganesh Terkar.",
		ImageURL:      "/paintings/PhotoGrid_1581055541054.jpg",
		StartingPrice: 2750,
		ArtistName:    "Ganesh Terkar",
		Source:        "SHOWCASE",
	},
}

func FallbackGalleryPaintings(category string) []PaintingItem {
	category = strings.ToUpper(strings.TrimSpace(category))
	if category == "" || category == "ALL" {
		return fallbackPaintings
	}

	var filtered []PaintingItem
	for _, p := range fallbackPaintings {
		if p.Category == category {
			filtered = append(filtered, p)
		}
	}
	return filtered
}
