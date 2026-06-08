export declare class GmailAdapter {
    private oauth2Client;
    constructor(accessToken: string, refreshToken?: string);
    private gmail;
    getRecentMessages(maxResults?: number): Promise<import("googleapis").gmail_v1.Schema$Message[]>;
    getMessage(messageId: string): Promise<{
        id: string;
        from: string;
        subject: string;
        body: string;
        snippet: string | null | undefined;
    }>;
    sendReply(messageId: string, replyText: string): Promise<void>;
    private decodeBody;
}
