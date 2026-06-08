import SwiftUI

@MainActor
class AppState: ObservableObject {
    @Published var serverURL = ""
    @Published var isConnected = false
    @Published var dashboard: DashboardData?
    @Published var messages: [Message] = []
    @Published var invoices: [Invoice] = []
    @Published var unreadCount = 0
    @Published var urgentCount = 0

    let api = APIClient()
    private var timer: Timer?

    func connect(url: String) {
        serverURL = url
        api.configure(url: url)
        Task {
            isConnected = (try? await api.checkHealth()) ?? false
            if isConnected { startPolling(); refresh() }
        }
    }

    func refresh() {
        Task {
            dashboard = try? await api.getDashboard()
            messages = (try? await api.getInbox()) ?? []
            invoices = (try? await api.getInvoices()) ?? []
            unreadCount = messages.filter { $0.status == .pending }.count
            urgentCount = messages.filter { $0.category == .urgent && $0.status == .pending }.count
        }
    }

    private func startPolling() {
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }
}
