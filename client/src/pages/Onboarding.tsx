import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto pt-8 pb-20">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition ${s <= step ? 'bg-sage-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <span className="text-4xl">📸</span>
            <h1 className="text-xl font-bold mt-3">Welcome to StudioSage</h1>
            <p className="text-sm text-gray-500 mt-1">Your AI photography studio manager. Connect your tools, we handle the rest.</p>
          </div>

          <div className="space-y-3">
            <ToolCard icon="🧠" name="AI Engine" desc="Claude AI — classifies messages, drafts replies, generates invoices" />
            <ToolCard icon="📅" name="Google Calendar" desc="Checks your availability and auto-schedules shoots" />
            <ToolCard icon="💳" name="Stripe" desc="Creates professional invoices with payment links" />
            <ToolCard icon="🖼️" name="Pixieset" desc="Tracks gallery progress and helps with client delivery" />
          </div>

          <button onClick={() => setStep(2)} className="w-full py-3 bg-sage-500 text-white rounded-full font-medium text-sm">
            Get Started
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Connect your tools</h2>
          <p className="text-sm text-gray-500">StudioSage works on top of what you already use. No switching required.</p>

          <div className="space-y-3">
            <ConnectButton label="Connect Google Calendar" active />
            <ConnectButton label="Connect Stripe" active />
            <ConnectButton label="Connect Pixieset" />
          </div>

          <button onClick={() => setStep(3)} className="w-full py-3 bg-sage-500 text-white rounded-full font-medium text-sm">
            Continue
          </button>
          <button onClick={() => setStep(1)} className="w-full py-2 text-gray-400 text-xs">← Back</button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 text-center">
          <span className="text-5xl">🎉</span>
          <div>
            <h2 className="text-lg font-semibold">You're all set!</h2>
            <p className="text-sm text-gray-500 mt-1">
              StudioSage will now automatically classify incoming messages, draft replies, and generate invoices. You focus on shooting — we handle the rest.
            </p>
          </div>

          <div className="bg-sage-50 rounded-xl p-4 text-left text-sm space-y-2">
            <p className="font-medium text-sage-700">What happens next:</p>
            <ul className="text-gray-600 space-y-1 list-disc list-inside text-xs">
              <li>New client messages appear in your Inbox with AI suggestions</li>
              <li>Urgent messages are flagged immediately</li>
              <li>You review and send with one tap</li>
              <li>Invoices are generated with photography-specific details</li>
            </ul>
          </div>

          <button onClick={() => navigate('/')} className="w-full py-3 bg-sage-500 text-white rounded-full font-medium text-sm">
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function ToolCard({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-100">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function ConnectButton({ label, active }: { label: string; active?: boolean }) {
  return (
    <button className={`w-full py-3 rounded-full text-sm font-medium border transition ${active ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-gray-400 border-gray-200'}`}>
      {label} {active ? '→' : '(Soon)'}
    </button>
  );
}
