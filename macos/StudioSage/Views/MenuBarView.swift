import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("StudioSage").font(.headline)
                Spacer()
                if app.unreadCount > 0 {
                    Text("\(app.unreadCount)").font(.caption2).padding(4)
                        .background(Circle().fill(.red)).foregroundColor(.white)
                }
            }
            Divider()
            if app.urgentCount > 0 {
                Label("\(app.urgentCount) urgent", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
            }
            Label("\(app.dashboard?.today.autoReplied ?? 0) auto-replied", systemImage: "checkmark.circle")
            Divider()
            Button("Open Dashboard") { NSApp.activate(ignoringOtherApps: true); NSApp.windows.first?.makeKeyAndOrderFront(nil) }
            Button("Settings...") { NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil) }
            Divider()
            Button("Quit") { NSApp.terminate(nil) }
        }
        .padding().frame(width: 280)
        .onAppear { app.refresh() }
    }
}
