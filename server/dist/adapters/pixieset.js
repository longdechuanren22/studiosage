// Pixieset API adapter
// Docs: https://pixieset.com/api/docs/
export class PixiesetAdapter {
    apiKey;
    baseUrl = 'https://api.pixieset.com/v1';
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async request(path, options) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        if (!res.ok)
            throw new Error(`Pixieset API ${res.status}: ${await res.text()}`);
        return res.json();
    }
    async getGalleries() {
        return this.request('/galleries');
    }
    async getGallery(id) {
        return this.request(`/galleries/${id}`);
    }
    async getOrders(clientEmail) {
        return this.request(`/orders?clientEmail=${encodeURIComponent(clientEmail)}`);
    }
    async resetGalleryPassword(galleryId, newPassword) {
        await this.request(`/galleries/${galleryId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword }),
        });
    }
    // Check gallery progress for AI context
    async getProgress(galleryId) {
        const g = await this.getGallery(galleryId);
        return { uploaded: g.totalImages, total: g.totalImages }; // Pixieset API returns total as uploaded count
    }
}
