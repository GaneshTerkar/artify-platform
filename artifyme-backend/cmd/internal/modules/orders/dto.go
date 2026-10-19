package orders

import "time"

type orderDTO struct {
	OrderID               string     `json:"order_id"`
	UserID                string     `json:"user_id"`
	ArtistID              *string    `json:"artist_id,omitempty"`
	DeliveryAgentID       *string    `json:"delivery_agent_id,omitempty"`
	CustomerName          string     `json:"customer_name,omitempty"`
	CustomerPhone         string     `json:"customer_phone,omitempty"`
	ArtistName            *string    `json:"artist_name,omitempty"`
	ArtistPhone           *string    `json:"artist_phone,omitempty"`
	DeliveryAgentName     *string    `json:"delivery_agent_name,omitempty"`
	DeliveryAgentPhone    *string    `json:"delivery_agent_phone,omitempty"`
	PaintingCategory      string     `json:"painting_category"`
	ReferenceImageURL     string     `json:"reference_image_url"`
	FinalImageURL         *string    `json:"final_image_url,omitempty"`
	CollageImageURL       *string    `json:"collage_image_url,omitempty"`
	OriginalFinalImageURL *string    `json:"original_final_image_url,omitempty"`
	IsPublishedToGallery  bool       `json:"is_published_to_gallery"`
	Size                  string     `json:"size"`
	PersonsIncluded       string     `json:"persons_included"`
	Status                string     `json:"status"`
	LifecycleLabel        string     `json:"lifecycle_label"`
	DeliveryAddress       string     `json:"delivery_address"`
	DeliveryAttempts      int        `json:"delivery_attempts"`
	DeliveryFailureReason *string    `json:"delivery_failure_reason,omitempty"`
	LastDeliveryAttemptAt *time.Time `json:"last_delivery_attempt_at,omitempty"`
	TotalPrice            float64    `json:"total_price"`
	CustomerNotes         *string    `json:"customer_notes,omitempty"`
	CourierPartner        *string    `json:"courier_partner,omitempty"`
	TrackingNumber        *string    `json:"tracking_number,omitempty"`
	EstimatedDeliveryAt   *time.Time `json:"estimated_delivery_at,omitempty"`
	AdminDispatchNotes    *string    `json:"admin_dispatch_notes,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	Version               int        `json:"version"`
}

type UpdateLogisticsInput struct {
	CourierPartner      *string    `json:"courier_partner"`
	TrackingNumber      *string    `json:"tracking_number"`
	EstimatedDeliveryAt *time.Time `json:"estimated_delivery_at"`
	AdminDispatchNotes  *string    `json:"admin_dispatch_notes"`
}

func lifecycleLabel(status OrderStatus) string {
	switch status {
	case StatusPlaced:
		return "pending_payment"
	case StatusConfirmed:
		return "paid"
	case StatusAssignedArtist:
		return "assigned_artist"
	case StatusInProgress:
		return "in_progress"
	case StatusCompleted:
		return "completed"
	case StatusAssignedDeliveryAgent:
		return "assigned_delivery"
	case StatusInTransit:
		return "in_transit"
	case StatusOutForDelivery:
		return "out_for_delivery"
	case StatusDeliveryFailed:
		return "delivery_failed"
	case StatusDelivered:
		return "delivered"
	case StatusCancelled:
		return "cancelled"
	default:
		return string(status)
	}
}

func toOrderDTO(o *Order) orderDTO {
	d := orderDTO{
		OrderID:               o.OrderID.String(),
		UserID:                o.UserID.String(),
		CustomerName:          o.CustomerName,
		CustomerPhone:         o.CustomerPhone,
		ArtistName:            o.ArtistName,
		ArtistPhone:           o.ArtistPhone,
		DeliveryAgentName:     o.DeliveryAgentName,
		DeliveryAgentPhone:    o.DeliveryAgentPhone,
		PaintingCategory:      string(o.PaintingCategory),
		ReferenceImageURL:     o.ReferenceImageURL,
		FinalImageURL:         o.FinalImageURL,
		CollageImageURL:       o.CollageImageURL,
		OriginalFinalImageURL: o.OriginalFinalImageURL,
		IsPublishedToGallery:  o.IsPublishedToGallery,
		Size:                  string(o.Size),
		PersonsIncluded:       string(o.PersonsIncluded),
		Status:                string(o.Status),
		LifecycleLabel:        lifecycleLabel(o.Status),
		DeliveryAddress:       o.DeliveryAddress,
		DeliveryAttempts:      o.DeliveryAttempts,
		DeliveryFailureReason: o.DeliveryFailureReason,
		LastDeliveryAttemptAt: o.LastDeliveryAttemptAt,
		TotalPrice:            o.TotalPrice,
		CustomerNotes:         o.CustomerNotes,
		CourierPartner:        o.CourierPartner,
		TrackingNumber:        o.TrackingNumber,
		EstimatedDeliveryAt:   o.EstimatedDeliveryAt,
		AdminDispatchNotes:    o.AdminDispatchNotes,
		CreatedAt:             o.CreatedAt,
		UpdatedAt:             o.UpdatedAt,
		Version:               o.Version,
	}
	if o.ArtistID != nil {
		s := o.ArtistID.String()
		d.ArtistID = &s
	}
	if o.DeliveryAgentID != nil {
		s := o.DeliveryAgentID.String()
		d.DeliveryAgentID = &s
	}
	return d
}

type UserItemDTO struct {
	UserID              string    `json:"user_id"`
	FullName            string    `json:"full_name"`
	UserName            string    `json:"user_name"`
	Email               string    `json:"email"`
	Address             string    `json:"address"`
	PhoneNumber         string    `json:"phone_number"`
	Role                string    `json:"role"`
	Status              string    `json:"status"`
	IsVerifiedArtist    bool      `json:"is_verified_artist"`
	ExperienceYears     int       `json:"experience_years"`
	Bio                 string    `json:"bio"`
	OrdersCount         int       `json:"orders_count"`
	AssignedOrdersCount int       `json:"assigned_orders_count"`
	CreatedAt           time.Time `json:"created_at"`
}
