package auth

import "time"

type UserDTO struct {
	UserID      string    `json:"user_id" example:"550e8400-e29b-41d4-a716-446655440000"`
	UserName    string    `json:"user_name" example:"ganesh123"`
	FullName    string    `json:"full_name" example:"Ganesh Terkar"`
	Email       string    `json:"email" example:"ganesh@example.com"`
	Address     string    `json:"address" example:"Pune, India"`
	PhoneNumber string    `json:"phone_number" example:"+91XXXXXXXXXX"`
	Role        string    `json:"role" example:"CUSTOMER"`
	Status      string    `json:"status" example:"ACTIVE"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func ToUserDTO(u *User) UserDTO {
	address := ""
	if u.Address.Valid {
		address = u.Address.String
	}

	return UserDTO{
		UserID:      u.UserID.String(),
		UserName:    u.UserName,
		FullName:    u.FullName,
		Email:       u.Email,
		Address:     address,
		PhoneNumber: u.PhoneNumber,
		Role:        string(u.Role),
		Status:      string(u.Status),
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}