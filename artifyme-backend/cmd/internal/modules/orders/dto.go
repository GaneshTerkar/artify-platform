package orders

import "time"

type orderDTO struct {
	OrderID           string    `json:"order_id"`
	UserID            string    `json:"user_id"`
	ArtistID          *string   `json:"artist_id,omitempty"`
	PaintingCategory  string    `json:"painting_category"`
	ReferenceImageURL string    `json:"reference_image_url"`
	FinalImageURL         *string   `json:"final_image_url,omitempty"`
	CollageImageURL       *string   `json:"collage_image_url,omitempty"`
	OriginalFinalImageURL *string   `json:"original_final_image_url,omitempty"`
	IsPublishedToGallery  bool      `json:"is_published_to_gallery"`
	Size                  string    `json:"size"`
	PersonsIncluded   string    `json:"persons_included"`
	Status            string    `json:"status"`
	LifecycleLabel    string    `json:"lifecycle_label"`
	DeliveryAddress   string    `json:"delivery_address"`
	TotalPrice        float64   `json:"total_price"`
	CustomerNotes     *string   `json:"customer_notes,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func lifecycleLabel(status OrderStatus) string {
	switch status {
	case StatusPlaced:
		return "pending_payment"
	case StatusConfirmed:
		return "paid"
	case StatusInProgress:
		return "in_progress"
	case StatusCompleted:
		return "completed"
	case StatusCancelled:
		return "cancelled"
	default:
		return string(status)
	}
}

func toOrderDTO(o *Order) orderDTO {
	d := orderDTO{
		OrderID:           o.OrderID.String(),
		UserID:            o.UserID.String(),
		PaintingCategory:  string(o.PaintingCategory),
		ReferenceImageURL: o.ReferenceImageURL,
		FinalImageURL:         o.FinalImageURL,
		CollageImageURL:       o.CollageImageURL,
		OriginalFinalImageURL: o.OriginalFinalImageURL,
		IsPublishedToGallery:  o.IsPublishedToGallery,
		Size:                  string(o.Size),
		PersonsIncluded:   string(o.PersonsIncluded),
		Status:            string(o.Status),
		LifecycleLabel:    lifecycleLabel(o.Status),
		DeliveryAddress:   o.DeliveryAddress,
		TotalPrice:        o.TotalPrice,
		CustomerNotes:     o.CustomerNotes,
		CreatedAt:         o.CreatedAt,
		UpdatedAt:         o.UpdatedAt,
	}
	if o.ArtistID != nil {
		s := o.ArtistID.String()
		d.ArtistID = &s
	}
	return d
}
