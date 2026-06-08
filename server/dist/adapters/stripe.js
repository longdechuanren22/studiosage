// Stripe API adapter — payment links for photography invoices
export class StripeAdapter {
    secretKey;
    baseUrl = 'https://api.stripe.com/v1';
    constructor(secretKey) {
        this.secretKey = secretKey;
    }
    async request(path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: body ? 'POST' : 'GET',
            headers: {
                'Authorization': `Bearer ${this.secretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body?.toString(),
        });
        if (!res.ok)
            throw new Error(`Stripe ${res.status}: ${await res.text()}`);
        return res.json();
    }
    async createInvoice(params) {
        // Create a Stripe Payment Link via a Price + Product
        const productParams = new URLSearchParams({
            'name': `Photography — ${params.clientName}`,
        });
        const product = await this.request('/products', productParams);
        // Create price for total
        const total = params.items.reduce((sum, i) => sum + i.amount * i.quantity, 0);
        const priceParams = new URLSearchParams({
            'currency': 'usd',
            'unit_amount': String(Math.round(total * 100)),
            'product': product.id,
        });
        const price = await this.request('/prices', priceParams);
        // Create payment link
        const linkParams = new URLSearchParams({
            'line_items[0][price]': price.id,
            'line_items[0][quantity]': '1',
            'metadata[client]': params.clientName,
            'metadata[schedule]': params.paymentSchedule,
        });
        if (params.retainerLabel) {
            linkParams.set('metadata[retainer]', params.retainerLabel);
        }
        const link = await this.request('/payment_links', linkParams);
        return {
            id: link.id,
            paymentLink: link.url,
            status: 'active',
            subtotal: total,
            total,
        };
    }
    async getPaymentStatus(linkId) {
        const link = await this.request(`/payment_links/${linkId}`);
        return link.active ? 'pending' : 'paid';
    }
}
