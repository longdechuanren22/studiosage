import Foundation

struct Message: Codable, Identifiable {
    let id: String
    let fromAddress: String
    let subject: String
    let body: String
    let category: CategoryType
    let status: StatusType
    let aiReply: String?
    let clientName: String?
    let clientStage: String?
    let createdAt: String

    enum CategoryType: String, Codable { case urgent, normal, spam }
    enum StatusType: String, Codable { case pending, replied, archived }
}

struct DashboardData: Codable {
    let today: TodayStats
    struct TodayStats: Codable {
        let newMessages, autoReplied, urgent, pendingReview, draftInvoices: Int
    }
}

struct Invoice: Codable, Identifiable {
    let id: String
    let clientName: String
    let clientEmail: String?
    let amount: Double
    let currency: String
    let description: String
    let status: String
    let retainerType: String?
    let paymentSchedule: String
    let items: [InvoiceItem]?
    let createdAt: String
}

struct InvoiceItem: Codable { let description: String; let quantity: Int; let unitPrice: Double }
