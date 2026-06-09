import Foundation

final class APIClient: Sendable {
    private var baseURL = ""
    private let session = URLSession.shared
    private let decoder = { let d = JSONDecoder(); d.keyDecodingStrategy = .convertFromSnakeCase; return d }()
    private let encoder = { let e = JSONEncoder(); e.keyEncodingStrategy = .convertToSnakeCase; return e }()

    func configure(url: String) { baseURL = url.hasSuffix("/") ? String(url.dropLast()) : url }

    func checkHealth() async throws -> Bool {
        let (_, r) = try await session.data(from: URL(string: "\(baseURL)/api/health")!)
        return (r as? HTTPURLResponse)?.statusCode == 200
    }

    func getDashboard() async throws -> DashboardData {
        let (data, _) = try await session.data(from: URL(string: "\(baseURL)/api/dashboard")!)
        return try decoder.decode(DashboardData.self, from: data)
    }

    func getInbox() async throws -> [Message] {
        let (data, _) = try await session.data(from: URL(string: "\(baseURL)/api/messages/inbox")!)
        return try decoder.decode([Message].self, from: data)
    }

    func classifyMessage(body: String, subject: String, from: String) async throws -> Message {
        var req = URLRequest(url: URL(string: "\(baseURL)/api/messages/incoming")!)
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(["body": body, "subject": subject, "from": from])
        let (data, _) = try await session.data(for: req)
        return try decoder.decode(Message.self, from: data)
    }

    func sendReply(id: String) async throws {
        var req = URLRequest(url: URL(string: "\(baseURL)/api/messages/\(id)/reply")!)
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(["customText": Optional<String>.none as Any])
        _ = try await session.data(for: req)
    }

    func getInvoices() async throws -> [Invoice] {
        let (data, _) = try await session.data(from: URL(string: "\(baseURL)/api/invoices")!)
        return try decoder.decode([Invoice].self, from: data)
    }

    func generateInvoice(client: String, email: String, pkg: String, amount: Double, schedule: String) async throws -> Invoice {
        var req = URLRequest(url: URL(string: "\(baseURL)/api/invoices/generate")!)
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(["clientName": client, "clientEmail": email, "packageType": pkg, "amount": String(amount), "paymentSchedule": schedule])
        let (data, _) = try await session.data(for: req)
        return try decoder.decode(Invoice.self, from: data)
    }
}
