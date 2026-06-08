import SwiftUI

struct InvoiceListView: View {
    @EnvironmentObject var app: AppState
    @State private var showForm = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Invoices").font(.title2).fontWeight(.semibold)
                Spacer()
                Button("+ New") { showForm = true }
            }.padding()

            if app.invoices.isEmpty {
                Spacer()
                Text("No invoices yet").foregroundStyle(.secondary)
                Spacer()
            } else {
                List(app.invoices) { inv in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(inv.clientName).font(.headline)
                            Text(inv.description).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(inv.currency) \(String(format: "%.0f", inv.amount))").font(.title3).foregroundStyle(.teal)
                    }.padding(.vertical, 4)
                }
            }
        }
        .onAppear { Task { app.invoices = (try? await app.api.getInvoices()) ?? [] } }
        .sheet(isPresented: $showForm) { InvoiceFormView() }
    }
}

struct InvoiceFormView: View {
    @EnvironmentObject var app: AppState
    @State private var clientName = ""; @State private var clientEmail = ""
    @State private var packageType = "wedding"; @State private var amount = ""
    @State private var schedule = "three-phase"
    @Environment(\.dismiss) var dismiss

    var body: some View {
        Form {
            TextField("Client Name", text: $clientName)
            TextField("Client Email", text: $clientEmail)
            Picker("Package", selection: $packageType) {
                Text("Wedding").tag("wedding"); Text("Portrait").tag("portrait")
                Text("Event").tag("event"); Text("Commercial").tag("commercial")
            }
            TextField("Amount (USD)", text: $amount)
            Picker("Schedule", selection: $schedule) {
                Text("Single Payment").tag("single")
                Text("3-Phase (50/25/25)").tag("three-phase")
            }
            HStack {
                Spacer()
                Button("Generate") {
                    guard let amt = Double(amount) else { return }
                    Task {
                        _ = try? await app.api.generateInvoice(client: clientName, email: clientEmail, pkg: packageType, amount: amt, schedule: schedule)
                        app.invoices = (try? await app.api.getInvoices()) ?? []
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(clientName.isEmpty || clientEmail.isEmpty || amount.isEmpty)
            }
        }
        .padding().frame(width: 420, height: 360)
    }
}
