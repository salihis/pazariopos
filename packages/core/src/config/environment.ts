export interface EnvironmentConfig {
  apiUrl: string
  wsUrl: string
  environment: 'development' | 'staging' | 'production'
}

const getApiUrl = (): string => {
  // Varsayılan (geliştirme ortamı)
  return 'http://localhost:3000'
}

export const environment: EnvironmentConfig = {
  apiUrl: getApiUrl(),
  wsUrl: getApiUrl().replace(/^http/, 'ws'),
  environment: 'development'
}
