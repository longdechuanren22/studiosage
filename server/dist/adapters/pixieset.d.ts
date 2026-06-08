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
    items: {
        name: string;
        quantity: number;
        price: number;
    }[];
    total: number;
    createdAt: string;
}
export declare class PixiesetAdapter {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string);
    private request;
    getGalleries(): Promise<PixiesetGallery[]>;
    getGallery(id: string): Promise<PixiesetGallery>;
    getOrders(clientEmail: string): Promise<PixiesetOrder[]>;
    resetGalleryPassword(galleryId: string, newPassword: string): Promise<void>;
    getProgress(galleryId: string): Promise<{
        uploaded: number;
        total: number;
    }>;
}
export {};
