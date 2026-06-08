import SwiftUI

struct MessageRow: View {
    let msg: Message
    @EnvironmentObject var app: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(msg.category == .urgent ? Color.red : Color.orange).frame(width: 8, height: 8)
                Text(msg.clientName ?? msg.fromAddress).font(.headline)
                Spacer()
                Text(timeAgo(iso: msg.createdAt)).font(.caption).foregroundStyle(.secondary)
            }
            Text(msg.body).font(.body).lineLimit(2).foregroundStyle(.secondary)
            if let reply = msg.aiReply {
                HStack {
                    Image(systemName: "bubble.left.and.bubble.right").foregroundStyle(.teal)
                    Text(reply).font(.callout).lineLimit(3)
                }
                .padding(8).background(RoundedRectangle(cornerRadius: 8).fill(Color.teal.opacity(0.1)))
            }
            if msg.status == .pending {
                HStack(spacing: 12) {
                    Button { Task { try? await app.api.sendReply(id: msg.id); app.refresh() } } label: {
                        Label("Send", systemImage: "paperplane.fill")
                    }
                    .buttonStyle(.borderedProminent).controlSize(.small)
                    Button("Edit") {}.buttonStyle(.bordered).controlSize(.small)
                }
            }
        }
        .padding().background(RoundedRectangle(cornerRadius: 12).fill(.primary.opacity(0.03)))
    }

    func timeAgo(iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fmt.date(from: iso) else { return iso }
        let diff = Int(Date().timeIntervalSince(date))
        if diff < 60 { return "now" }
        if diff < 3600 { return "\(diff/60)m ago" }
        if diff < 86400 { return "\(diff/3600)h ago" }
        return "\(diff/86400)d ago"
    }
}
