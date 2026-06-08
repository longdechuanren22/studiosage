import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var app: AppState
    @State private var urlInput = ""
    @State private var statusText = ""
    @State private var statusColor: Color = .secondary

    var body: some View {
        Form {
            Section("Server Connection") {
                TextField("API Server URL", text: $urlInput)
                    .textFieldStyle(.roundedBorder)
                HStack {
                    Button("Connect") {
                        statusText = "Connecting..."
                        app.connect(url: urlInput)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            statusText = app.isConnected ? "Connected" : "Failed"
                            statusColor = app.isConnected ? .green : .red
                        }
                    }
                    Text(statusText).foregroundStyle(statusColor)
                }
            }
            Section("Notifications") {
                Toggle("Menu bar badge count", isOn: .constant(true))
                Toggle("Urgent message alerts", isOn: .constant(true))
            }
            Section("About") {
                Text("StudioSage v1.0").foregroundStyle(.secondary)
                Text("AI Photography Studio Manager").foregroundStyle(.secondary)
            }
        }
        .padding().frame(width: 450, height: 300)
        .onAppear { urlInput = app.serverURL.isEmpty ? "https://hzlmagent.com/sage/api" : app.serverURL }
    }
}
