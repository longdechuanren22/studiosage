// Gmail API adapter — read client emails, send AI replies
import { google } from 'googleapis';
export class GmailAdapter {
    oauth2Client;
    constructor(accessToken, refreshToken) {
        this.oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        this.oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    }
    gmail() {
        return google.gmail({ version: 'v1', auth: this.oauth2Client });
    }
    async getRecentMessages(maxResults = 10) {
        const res = await this.gmail().users.messages.list({
            userId: 'me',
            maxResults,
            q: 'in:inbox -category:promotions -category:social',
        });
        return res.data.messages || [];
    }
    async getMessage(messageId) {
        const res = await this.gmail().users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });
        const headers = res.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const body = this.decodeBody(res.data.payload);
        return { id: messageId, from, subject, body, snippet: res.data.snippet };
    }
    async sendReply(messageId, replyText) {
        const original = await this.getMessage(messageId);
        const raw = Buffer.from(`From: me\r\nTo: ${original.from}\r\nSubject: Re: ${original.subject}\r\n` +
            `References: ${messageId}\r\nIn-Reply-To: ${messageId}\r\n\r\n${replyText}`).toString('base64url');
        await this.gmail().users.messages.send({
            userId: 'me',
            requestBody: { raw, threadId: messageId },
        });
    }
    decodeBody(payload) {
        if (payload?.body?.data)
            return Buffer.from(payload.body.data, 'base64').toString();
        if (payload?.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    return Buffer.from(part.body.data, 'base64').toString();
                }
            }
        }
        return '';
    }
}
