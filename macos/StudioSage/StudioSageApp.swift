import SwiftUI

@main
struct StudioSageApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        MenuBarExtra("StudioSage", systemImage: "camera.fill") {
            MenuBarView().environmentObject(app)
        }
        Window("Dashboard", id: "dashboard") {
            DashboardView().environmentObject(app).frame(minWidth: 800, minHeight: 560)
        }
        Window("Inbox", id: "inbox") {
            InboxView().environmentObject(app).frame(minWidth: 600, minHeight: 480)
        }
        Settings {
            SettingsView().environmentObject(app)
        }
    }
}
