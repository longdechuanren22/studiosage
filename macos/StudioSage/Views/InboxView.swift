import SwiftUI

struct InboxView: View {
    @EnvironmentObject var app: AppState
    @State private var filter: Message.CategoryType? = nil

    var filtered: [Message] {
        guard let f = filter else { return app.messages }
        return app.messages.filter { $0.category == f }
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Filter", selection: $filter) {
                Text("All").tag(nil as Message.CategoryType?)
                Text("Urgent").tag(Message.CategoryType.urgent)
                Text("Normal").tag(Message.CategoryType.normal)
            }
            .pickerStyle(.segmented).padding()

            if filtered.isEmpty {
                Spacer()
                Text("No messages").foregroundStyle(.secondary)
                Spacer()
            } else {
                List(filtered) { msg in MessageRow(msg: msg) }
            }
        }
        .onAppear { Task { app.messages = (try? await app.api.getInbox()) ?? [] } }
    }
}
