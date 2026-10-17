package files

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/google/uuid"
)

type Service struct {
	cfg      *config.Config
	s3Client *s3.Client
	localDir string
}

func NewService(cfg *config.Config) *Service {
	localDir := "./uploads"
	if err := os.MkdirAll(localDir, 0755); err != nil {
		slog.Error("failed to create local uploads directory", "error", err)
	}

	var s3Client *s3.Client
	if cfg.S3.Endpoint != "" {
		creds := credentials.NewStaticCredentialsProvider(cfg.S3.AccessKey, cfg.S3.SecretKey, "")
		s3Client = s3.New(s3.Options{
			Region:       cfg.S3.Region,
			Credentials:  creds,
			BaseEndpoint: aws.String(cfg.S3.Endpoint),
			UsePathStyle: true,
		})

		ctx := context.Background()
		ensureBucket(ctx, s3Client, cfg.S3.Bucket)
	}

	return &Service{
		cfg:      cfg,
		s3Client: s3Client,
		localDir: localDir,
	}
}

func ensureBucket(ctx context.Context, client *s3.Client, bucketName string) {
	if client == nil || bucketName == "" {
		return
	}

	_, err := client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		slog.Info("S3 bucket not found, creating...", "bucket", bucketName)
		_, err = client.CreateBucket(ctx, &s3.CreateBucketInput{
			Bucket: aws.String(bucketName),
		})
		if err != nil {
			slog.Warn("could not create S3 bucket", "bucket", bucketName, "error", err)
			return
		}
		slog.Info("S3 bucket created", "bucket", bucketName)
	}

	// Set public read policy for downloads
	policy := fmt.Sprintf(`{
		"Version": "2012-10-17",
		"Statement": [
			{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetBucketLocation", "s3:ListBucket"],
				"Resource": ["arn:aws:s3:::%s"]
			},
			{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetObject"],
				"Resource": ["arn:aws:s3:::%s/*"]
			}
		]
	}`, bucketName, bucketName)

	_, err = client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
		Bucket: aws.String(bucketName),
		Policy: aws.String(policy),
	})
	if err != nil {
		slog.Warn("could not set public read policy on bucket", "bucket", bucketName, "error", err)
	}
}

var allowedExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".gif":  true,
	".heic": true,
	".bmp":  true,
}

func (s *Service) UploadBytes(ctx context.Context, fileBytes []byte, filename string, contentType string, baseURL string) (string, error) {
	sanitizedBase := strings.ReplaceAll(filepath.Base(filename), " ", "_")
	localPath := filepath.Join(s.localDir, sanitizedBase)
	if err := os.WriteFile(localPath, fileBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to save local file: %w", err)
	}

	s3Key := fmt.Sprintf("uploads/%s", sanitizedBase)
	var s3Uploaded bool
	if s.s3Client != nil && s.cfg.S3.Bucket != "" {
		_, err := s.s3Client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(s.cfg.S3.Bucket),
			Key:         aws.String(s3Key),
			Body:        bytes.NewReader(fileBytes),
			ContentType: aws.String(contentType),
		})
		if err == nil {
			s3Uploaded = true
			slog.Info("file successfully uploaded to S3/MinIO", "bucket", s.cfg.S3.Bucket, "key", s3Key)
		} else {
			slog.Warn("failed to upload to S3, fallback to local storage", "error", err)
		}
	}

	var publicURL string
	if s3Uploaded {
		if s.cfg.S3.PublicDomain != "" {
			publicURL = fmt.Sprintf("%s/%s", strings.TrimRight(s.cfg.S3.PublicDomain, "/"), s3Key)
		} else {
			publicURL = fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.cfg.S3.Endpoint, "/"), s.cfg.S3.Bucket, s3Key)
		}
	} else {
		publicURL = fmt.Sprintf("%s/uploads/%s", strings.TrimRight(baseURL, "/"), sanitizedBase)
	}

	return publicURL, nil
}

func (s *Service) UploadFile(ctx context.Context, fileHeader *multipart.FileHeader, baseURL string) (string, string, error) {
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedExtensions[ext] {
		return "", "", fmt.Errorf("unsupported file extension: %s. Please upload JPG, PNG, WEBP, GIF, or HEIC image", ext)
	}

	src, err := fileHeader.Open()
	if err != nil {
		return "", "", fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return "", "", fmt.Errorf("failed to read file content: %w", err)
	}

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = "image/" + strings.TrimPrefix(ext, ".")
	}

	uniqueID := uuid.New().String()
	sanitizedBase := strings.ReplaceAll(filepath.Base(fileHeader.Filename), " ", "_")
	filename := fmt.Sprintf("%s_%s", uniqueID, sanitizedBase)

	publicURL, err := s.UploadBytes(ctx, fileBytes, filename, contentType, baseURL)
	if err != nil {
		return "", "", err
	}

	return publicURL, filename, nil
}
