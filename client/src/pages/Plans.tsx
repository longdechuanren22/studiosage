import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { t } from '../i18n';

interface PlanInfo {
  plan: string;
  planName: string;
  limits: { projects: number; photos: number };
  usage: { projects: number; photos: number };
  hasAI: boolean;
  stripeSubscriptionId: string | null;
}

interface PlanCard {
  key: string;
  name: string;
  price: string;
  period: string;
  projects: string;
  photos: string;
  ai: boolean;
  popular: boolean;
  stripePlan: string;
}

const PLANS: PlanCard[] = [
  { key: 'trial', name: 'Free', price: '$0', period: '', projects: '1', photos: '500', ai: false, popular: false, stripePlan: '' },
  { key: 'starter', name: 'Starter', price: '$9', period: '/mo', projects: '5', photos: '5,000', ai: true, popular: false, stripePlan: 'starter' },
  { key: 'pro', name: 'Pro', price: '$19', period: '/mo', projects: 'Unlimited', photos: 'Unlimited', ai: true, popular: true, stripePlan: 'pro' },
  { key: 'pro_annual', name: 'Pro Annual', price: '$15', period: '/mo', projects: 'Unlimited', photos: 'Unlimited', ai: true, popular: false, stripePlan: 'pro_annual' },
];

export default function Plans() {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    api.get<PlanInfo>('/api/billing/plan')
      .then(setPlanInfo)
      .catch(() => {})
      .finally(() => setLoading(false));

    // Handle Stripe redirect
    if (searchParams.get('checkout') === 'success') {
      toast('Subscription activated! Welcome aboard 🎉', 'success');
    } else if (searchParams.get('checkout') === 'cancelled') {
      toast('Upgrade cancelled — your current plan is unchanged', 'info');
    }
  }, []);

  const handleUpgrade = async (stripePlan: string) => {
    if (!stripePlan) return;
    setUpgrading(stripePlan);
    try {
      const data = await api.post<{ url: string }>('/api/billing/create-checkout', { plan: stripePlan });
      window.location.href = data.url;
    } catch (err: any) {
      toast(err.message || 'Stripe checkout failed — please try again', 'error');
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const data = await api.post<{ url: string }>('/api/billing/portal');
      window.location.href = data.url;
    } catch (err: any) {
      toast(err.message || 'Billing portal unavailable', 'error');
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#AEAEB2' }}>{t('shared.loading')}</div>;
  }

  const currentPlan = planInfo?.plan || 'trial';
  const isSubscribed = !!planInfo?.stripeSubscriptionId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>Choose Your Plan</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '8px 0 0' }}>
          All plans include 14-day free trial. No credit card required to start.
        </p>
      </div>

      {/* Current plan badge */}
      {planInfo && (
        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 20,
            background: 'rgba(0,122,255,.08)', color: '#007AFF',
          }}>
            Current: {planInfo.planName}
            {isSubscribed && ' · Subscribed'}
          </span>
          {isSubscribed && (
            <button onClick={handleManageBilling} style={{
              marginLeft: 8, background: 'none', border: 'none', color: '#007AFF',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
            }}>
              Manage Billing
            </button>
          )}
        </div>
      )}

      {/* Usage bar */}
      {planInfo && planInfo.limits.projects !== Infinity && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#86868B' }}>Projects used</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{planInfo.usage.projects} / {planInfo.limits.projects}</span>
          </div>
          <div style={{ background: '#E5E5EA', borderRadius: 4, height: 4 }}>
            <div style={{
              width: `${Math.min(100, (planInfo.usage.projects / Math.max(1, planInfo.limits.projects)) * 100)}%`,
              height: 4, borderRadius: 4, background: planInfo.usage.projects >= planInfo.limits.projects ? '#FF3B30' : '#007AFF',
            }} />
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.key;
          const isProcessing = upgrading === plan.stripePlan;

          return (
            <div key={plan.key} style={{
              background: plan.popular ? 'linear-gradient(135deg, #F0F7FF, #F5F0FF)' : '#fff',
              borderRadius: 16, padding: '20px 18px',
              border: isCurrent ? '2px solid #007AFF' : plan.popular ? '1px solid #AF52DE' : '1px solid rgba(0,0,0,.06)',
              boxShadow: plan.popular ? '0 4px 20px rgba(0,122,255,.08)' : '0 1px 3px rgba(0,0,0,.04)',
              position: 'relative',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: '#AF52DE', color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '3px 12px', borderRadius: 10, letterSpacing: '.3px',
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.1px' }}>{plan.name}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800 }}>{plan.price}</span>
                  <span style={{ fontSize: 13, color: '#86868B' }}>{plan.period}</span>
                </div>
                {plan.key === 'pro_annual' && (
                  <div style={{ fontSize: 11, color: '#34C759', fontWeight: 600 }}>$180/yr — save 21%</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Feature icon="📸" text={`${plan.projects} project${plan.projects === '1' ? '' : 's'}`} />
                <Feature icon="🖼" text={`${plan.photos} photos`} />
                <Feature icon="🤖" text={plan.ai ? 'AI classification & replies' : 'Manual only'} ok={plan.ai} />
                <Feature icon="💳" text="Stripe payments" ok={true} />
                <Feature icon="📬" text="Email integration" ok={true} />
                {plan.key === 'pro' || plan.key === 'pro_annual' ? (
                  <Feature icon="⭐" text="Priority support" ok={true} />
                ) : null}
              </div>

              <div style={{ marginTop: 'auto' }}>
                {isCurrent ? (
                  <button disabled style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: '#E5E5EA', color: '#86868B', fontSize: 14, fontWeight: 600, cursor: 'default',
                  }}>
                    ✓ Current Plan
                  </button>
                ) : plan.key === 'trial' ? (
                  <button disabled style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: '#E5E5EA', color: '#86868B', fontSize: 14, fontWeight: 600, cursor: 'default',
                  }}>
                    Free Forever
                  </button>
                ) : (
                  <button onClick={() => handleUpgrade(plan.stripePlan)} disabled={isProcessing} style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: plan.popular ? 'linear-gradient(135deg, #007AFF, #5856D6)' : '#007AFF',
                    color: '#fff', fontSize: 14, fontWeight: 600, cursor: isProcessing ? 'default' : 'pointer',
                    opacity: isProcessing ? .6 : 1,
                  }}>
                    {isProcessing ? 'Redirecting…' : isCurrent ? 'Current' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', padding: 16 }}>
        <button onClick={() => navigate('/settings')} style={{
          background: 'none', border: 'none', color: '#86868B', fontSize: 13, cursor: 'pointer',
        }}>
          ← Back to Settings
        </button>
      </div>
    </div>
  );
}

function Feature({ icon, text, ok = true }: { icon: string; text: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ok ? '#1D1D1F' : '#C7C7CC' }}>
      <span>{ok ? '✓' : '—'}</span>
      <span>{text}</span>
    </div>
  );
}
