import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var app: AppState
    @State private var tab = 0

    var body: some View {
        NavigationSplitView {
            List(selection: $tab) {
                Label("Dashboard", systemImage: "rectangle.grid.1x2").tag(0)
                Label("Inbox", systemImage: "tray").tag(1).badge(app.unreadCount)
                Label("Invoices", systemImage: "doc.text").tag(2).badge(app.dashboard?.today.draftInvoices ?? 0)
            }.listStyle(.sidebar).frame(minWidth: 160)
        } detail: {
            switch tab {
            case 0: dashboardContent
            case 1: InboxView()
            case 2: InvoiceListView()
            default: EmptyView()
            }
        }
        .onAppear { app.refresh() }
    }

    var dashboardContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())]) {
                    StatCard(title: "New", value: app.dashboard?.today.newMessages ?? 0, color: .teal)
                    StatCard(title: "Auto-Replied", value: app.dashboard?.today.autoReplied ?? 0, color: .green)
                    StatCard(title: "Urgent", value: app.dashboard?.today.urgent ?? 0, color: .red)
                    StatCard(title: "Draft", value: app.dashboard?.today.draftInvoices ?? 0, color: .orange)
                }
                let urgent = app.messages.filter { $0.category == .urgent && $0.status == .pending }
                if !urgent.isEmpty {
                    Section("Needs Your Attention") {
                        ForEach(urgent) { msg in MessageRow(msg: msg) }
                    }
                }
            }.padding()
        }
    }
}

struct StatCard: View {
    let title: String; let value: Int; let color: Color
    var body: some View {
        VStack {
            Text("\(value)").font(.largeTitle).fontWeight(.bold).foregroundStyle(color)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(.primary.opacity(0.05)))
    }
}
