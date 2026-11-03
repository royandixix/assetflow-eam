package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("token tidak valid")
	ErrUnavailable  = errors.New("layanan autentikasi tidak tersedia")
)

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type Client struct {
	baseURL        string
	publishableKey string
	httpClient     *http.Client
}

func NewClient(baseURL, publishableKey string) *Client {
	return &Client{
		baseURL:        strings.TrimRight(baseURL, "/"),
		publishableKey: publishableKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (a *Client) Verify(
	ctx context.Context,
	token string,
) (User, error) {
	var user User

	if strings.TrimSpace(token) == "" {
		return user, ErrInvalidToken
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		a.baseURL+"/auth/v1/user",
		nil,
	)
	if err != nil {
		return user, ErrUnavailable

	}

	req.Header.Set("apikey", a.publishableKey)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return user, ErrUnavailable
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return user, ErrInvalidToken
	default:
		return user, ErrUnavailable
	}

	decoder := json.NewDecoder(io.LimitReader(resp.Body, 1<<20))

	if err := decoder.Decode(&user); err != nil {
		return User{}, ErrUnavailable
	}

	if user.ID == "" {
		return User{}, ErrInvalidToken
	}

	return user, nil
}
