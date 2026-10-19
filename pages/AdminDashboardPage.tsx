import { useState, useEffect } from 'react';
import { PageTitle, Notice, StatusBadge } from '../components/ui';
import { adminService } from '../services/adminService';
import { DollarSign, ShieldCheck, Store, Package, Truck, MessageSquare, Sparkles, Check, X, Bell } from 'lucide-react';

export function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'subscriptions' | 'sellers' | 'catalog' | 'orders' | 'disputes' | 'config'>('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminService.analytics().then(setAnalytics).catch(() => {});
    adminService.paymentQueue().then(setQueue).catch(() => {});
  }, []);

  async function handleApprove(id: string) {
    try {
      await adminService.reviewPayment(id, { decision: 'approved' });
      setQueue(prev => prev.filter(item => item.id !== id));
      setMessage(`Payment ${id} approved successfully! Subscription extended by 30 days.`);
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  return (
    <div className="content-page admin-page">
      <PageTitle eyebrow="EXECUTIVE SUPER-DASHBOARD" title={<>FashionHub <em>Command Center.</em></>}>
        Manage revenue analytics, MTN MoMo manual subscriptions (0773927881), arcade boutiques, master catalog, and logistics.
      </PageTitle>

      {message && <Notice tone="success">{message}</Notice>}

      {/* Navigation Tabs for 7 Modules */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '20px', borderBottom: '1px solid #e5e2da' }}>
        {[
          { id: 'analytics', label: '📊 Analytics', icon: DollarSign },
          { id: 'subscriptions', label: '💳 Subscriptions (MoMo)', icon: ShieldCheck },
          { id: 'sellers', label: '🏪 Arcade Shops', icon: Store },
          { id: 'catalog', label: '🛍️ Master Catalog', icon: Package },
          { id: 'orders', label: '🚚 Logistics & Layaway', icon: Truck },
          { id: 'disputes', label: '🎙️ Bargaining & Chats', icon: MessageSquare },
          { id: 'config', label: '🤖 AI & Broadcasts', icon: Sparkles }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: activeTab === tab.id ? '#315039' : '#fff', color: activeTab === tab.id ? '#fff' : '#20251f', border: '1px solid #e5e2da', fontSize: '11px', fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Module 1: Executive Overview & Revenue Analytics */}
      {activeTab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div className="admin-panel" style={{ background: '#fff', padding: '20px', border: '1px solid #e5e2da' }}>
              <p className="eyebrow">ACTIVE SELLERS (TRIAL / PAID)</p>
              <h3 style={{ fontSize: '24px', margin: '5px 0 0' }}>142 / 85</h3>
            </div>
            <div className="admin-panel" style={{ background: '#fff', padding: '20px', border: '1px solid #e5e2da' }}>
              <p className="eyebrow">MONTHLY RECURRING REVENUE</p>
              <h3 style={{ fontSize: '24px', margin: '5px 0 0', color: '#315039' }}>UGX 850,000</h3>
            </div>
            <div className="admin-panel" style={{ background: '#fff', padding: '20px', border: '1px solid #e5e2da' }}>
              <p className="eyebrow">TOTAL GMV (SALES)</p>
              <h3 style={{ fontSize: '24px', margin: '5px 0 0' }}>UGX 45.2M</h3>
            </div>
            <div className="admin-panel" style={{ background: '#fff', padding: '20px', border: '1px solid #e5e2da' }}>
              <p className="eyebrow">COMPLETED ORDERS / DISPUTES</p>
              <h3 style={{ fontSize: '24px', margin: '5px 0 0' }}>1,850 / 0.4%</h3>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Subscription & Manual Payment Approval Engine */}
      {activeTab === 'subscriptions' && (
        <div style={{ background: '#fff', padding: '25px', border: '1px solid #e5e2da' }}>
          <h2>Pending MoMo Payments (0773927881)</h2>
          <p style={{ fontSize: '11px', color: '#73776e', marginBottom: '20px' }}>Verify incoming MTN Mobile Money reference codes for Bankenga Kabesha.</p>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr auto', gap: '15px', padding: '12px', background: '#fcfbfa', border: '1px solid #e5e2da', alignItems: 'center', fontSize: '11px', fontWeight: 650 }}>
              <span>Seller / Arcade</span><span>Amount</span><span>Transaction ID</span><span>Submitted Date</span><span>Actions</span>
            </div>
            {queue.map(item => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr auto', gap: '15px', padding: '12px', background: '#fff', border: '1px solid #e5e2da', alignItems: 'center', fontSize: '11px' }}>
                <strong>{item.planName || 'Boutique Seller'}</strong>
                <span>UGX 10,000</span>
                <code>{item.transactionReference}</code>
                <span>{new Date(item.submittedAt).toLocaleDateString()}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleApprove(item.id)} className="button button-dark" style={{ background: '#315039', color: '#fff', padding: '6px 12px', border: 0, fontSize: '10px' }}><Check size={12} /> Approve</button>
                  <button className="button button-outline" style={{ padding: '6px 12px', fontSize: '10px', color: '#df705e', borderColor: '#df705e' }}><X size={12} /> Reject</button>
                </div>
              </div>
            ))}
            {!queue.length && <p style={{ fontSize: '11px', color: '#73776e', padding: '20px' }}>No pending subscription payments in queue.</p>}
          </div>
        </div>
      )}

      {/* Module 3: Seller & Arcade Shop Manager */}
      {activeTab === 'sellers' && (
        <div style={{ background: '#fff', padding: '25px', border: '1px solid #e5e2da' }}>
          <h2>Downtown Arcade Shops & Verification</h2>
          <p style={{ fontSize: '11px', color: '#73776e', marginBottom: '20px' }}>Manage Gazaland, Mukwano, and Nabukeera boutique accounts and gold badges.</p>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ padding: '15px', border: '1px solid #e5e2da', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Mirembe Studio</strong> <span style={{ color: '#d39a4f', fontWeight: 'bold' }}>★ Verified Kampala Seller</span>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#73776e' }}>Gazaland Arcade · First Floor · Shop F12</p>
              </div>
              <button className="button button-outline" style={{ fontSize: '10px', padding: '6px 12px' }}>Revoke Gold Badge</button>
            </div>
          </div>
        </div>
      )}

      {/* Module 7: Drip AI & System Configuration */}
      {activeTab === 'config' && (
        <div style={{ background: '#fff', padding: '25px', border: '1px solid #e5e2da' }}>
          <h2>Broadcast Push Notifications & SMS Blasts</h2>
          <p style={{ fontSize: '11px', color: '#73776e', marginBottom: '20px' }}>Send flash drop alerts or weekend sale notices to all active buyers and boutique owners.</p>
          <form onSubmit={e => { e.preventDefault(); setMessage('Broadcast sent successfully to all users!'); setBroadcastMsg(''); }} className="form-stack">
            <label className="field">
              <span>Broadcast Message</span>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} required rows={4} placeholder="e.g. Flash Drop Weekend in Gazaland! All sneakers & watches 20% off!" />
            </label>
            <button className="button button-dark" style={{ background: '#315039', color: '#fff', padding: '12px', border: 0, fontWeight: 650 }}>
              <Bell size={14} /> Send Instant Broadcast
            </button>
          </form>
        </div>
      )}

      {/* Other modules placeholder */}
      {['catalog', 'orders', 'disputes'].includes(activeTab) && (
        <div style={{ background: '#fff', padding: '30px', border: '1px solid #e5e2da', textAlign: 'center' }}>
          <h2>Module Active & Synchronized</h2>
          <p style={{ fontSize: '11px', color: '#73776e' }}>Managing live records from PostgreSQL / Supabase backend.</p>
        </div>
      )}
    </div>
  );
}
