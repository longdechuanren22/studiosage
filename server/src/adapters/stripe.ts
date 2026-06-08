// Stripe API adapter — payment links for photography invoices

interface CreateInvoiceParams {
  clientName: string;
  clientEmail: string;
  items: { description: string; amount: number; quantity: number }[];
  paymentSchedule: 'single' | 'three-phase';
  retainerLabel?: string;
}

interface StripeInvoiceResult {
  id: string;
  paymentLink: string;
  status: string;
  subtotal: number;
  total: number;
}

export class StripeAdapter {
  private secretKey: string;
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request<T>(path: string, body?: URLSearchParams): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body?.toString(),
    });
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async createInvoice(params: CreateInvoiceParams): Promise<StripeInvoiceResult> {
    // Create a Stripe Payment Link via a Price + Product
    const productParams = new URLSearchParams({
      'name': `Photography — ${params.clientName}`,
    });
    const product = await this.request<{ id: string }>('/products', productParams);

    // Create price for total
    const total = params.items.reduce((sum, i) => sum + i.amount * i.quantity, 0);
    const priceParams = new URLSearchParams({
      'currency': 'usd',
      'unit_amount': String(Math.round(total * 100)),
      'product': product.id,
    });
    const price = await this.request<{ id: string }>('/prices', priceParams);

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

    const link = await this.request<{ id: string; url: string }>('/payment_links', linkParams);

    return {
      id: link.id,
      paymentLink: link.url,
      status: 'active',
      subtotal: total,
      total,
    };
  }

  async getPaymentStatus(linkId: string): Promise<'paid' | 'pending'> {
    const link = await this.request<{ active: boolean }>(`/payment_links/${linkId}`);
    return link.active ? 'pending' : 'paid';
  }
}
