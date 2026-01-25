package artists

import (
	"context"

	"github.com/google/uuid"
)
type ArtistService struct {
	artistRepo *ArtistRepository
}

func NewService(artistRepo *ArtistRepository) *ArtistService {
	if artistRepo == nil || artistRepo.Pool == nil {
		panic("auth.NewService: repo or pool is nil")
	}
	return &ArtistService{artistRepo: artistRepo}
}

func (s *ArtistService) AddPainting(
	ctx context.Context,
	artistID uuid.UUID,
	req AddPaintingRequest,
) (*ArtistPainting, error) {

	return s.artistRepo.AddPainting(
		ctx,
		artistID,
		&req,
	)
}

func (s *ArtistService) ListMyPaintings(
	ctx context.Context,
	artistID uuid.UUID,
) ([]ArtistPainting, error) {

	return s.artistRepo.GetArtistPaintings(ctx, artistID)
}

func (s *ArtistService) GetProfile(
	ctx context.Context,
	artistID uuid.UUID,
) (*ArtistProfileResponse, error) {

	return s.artistRepo.GetArtistProfile(ctx, artistID)
}

func (s *ArtistService) CreateOrUpdateProfile(
	ctx context.Context,
	artistID uuid.UUID,
	req *ArtistProfileRequest,
) (*ArtistProfileResponse, error) {

	return s.artistRepo.CreateOrUpdateProfile(ctx, artistID, req)
}

func (s *ArtistService) VerifyArtist(
	ctx context.Context,
	artistID uuid.UUID,
) error {
	return s.artistRepo.VerifyArtist(ctx, artistID)
}

func (s *ArtistService) GetPublicArtistProfile(
	ctx context.Context,
	artistID uuid.UUID,
) (*ArtistProfileResponse, error) {
	return s.artistRepo.GetVerifiedArtistProfile(ctx, artistID)
}

func (s *ArtistService) GetArtistsForReview(
	ctx context.Context,
) ([]AdminArtistReviewItem, error) {
	return s.artistRepo.GetArtistsForReview(ctx)
}

func (s *ArtistService) RejectArtist(
	ctx context.Context,
	artistID uuid.UUID,
	reason string,
) error {
	return s.artistRepo.RejectArtist(ctx, artistID, reason)
}

func (s *ArtistService) GetMyReviewStatus(
	ctx context.Context,
	artistID uuid.UUID,
) (*ArtistReviewStatusResponse, error) {
	return s.artistRepo.GetMyReviewStatus(ctx, artistID)
}
