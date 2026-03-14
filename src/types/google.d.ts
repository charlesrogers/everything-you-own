declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string
    token_type: string
    expires_in: number
    scope: string
    error?: string
    error_description?: string
    error_uri?: string
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message: string }) => void
  }

  interface TokenClient {
    requestAccessToken(overrideConfig?: { prompt?: string }): void
  }

  function initTokenClient(config: TokenClientConfig): TokenClient
}
