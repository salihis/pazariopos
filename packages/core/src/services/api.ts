import AsyncStorage from '@react-native-async-storage/async-storage'

class ApiService {
  private async getBaseUrl(): Promise<string> {
    // Mobil cihazdan kaydedilen endpoint'i al
    const savedUrl = await AsyncStorage.getItem('apiUrl')
    return savedUrl || 'http://localhost:3000'
  }

  async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        }
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('API call failed:', error)
      throw error
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'DELETE' })
  }
}

export const apiService = new ApiService()
