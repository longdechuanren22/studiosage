// Pixieset API adapter
// Docs: https://pixieset.com/api/docs/

interface PixiesetGallery {
  id: string;
  name: string;
  status: 'draft' | 'published';
  totalImages: number;
  passwordProtected: boolean;
  clientEmail?: string;
}

interface PixiesetOrder {
  id: string;
  status: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  createdAt: string;
}

export class PixiesetAdapter {
  private apiKey: string;
  private baseUrl = 'https://api.pixieset.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`Pixieset API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async getGalleries(): Promise<PixiesetGallery[]> {
    return this.request('/galleries');
  }

  async getGallery(id: string): Promise<PixiesetGallery> {
    return this.request(`/galleries/${id}`);
  }

  async getOrders(clientEmail: string): Promise<PixiesetOrder[]> {
    return this.request(`/orders?clientEmail=${encodeURIComponent(clientEmail)}`);
  }

  async resetGalleryPassword(galleryId: string, newPassword: string): Promise<void> {
    await this.request(`/galleries/${galleryId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPassword }),
    });
  }

  // Check gallery progress for AI context
  async getProgress(galleryId: string): Promise<{ uploaded: number; total: number }> {
    const g = await this.getGallery(galleryId);
    return { uploaded: g.totalImages, total: g.totalImages }; // Pixieset API returns total as uploaded count
  }
}
