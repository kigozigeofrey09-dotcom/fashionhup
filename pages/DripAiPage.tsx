import { useState } from 'react';
import { PageTitle, ListingCard, Loading } from '../components/ui';
import { seedListings } from '../data/seed';
import { Sparkles, Sliders } from 'lucide-react';

const occasions = ['Campus Party', 'Sunday Service', 'Job Interview', 'Casual Sunday', 'Wedding Guest'];

export function DripAiPage() {
  const [budget, setBudget] = useState(100000);
  const [selectedOccasion, setSelectedOccasion] = useState('Campus Party');
  const [generating, setGenerating] = useState(false);
  const [curated, setCurated] = useState(seedListings.slice(0, 3));

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      const filtered = seedListings.filter(item => item.price <= budget);
      setCurated(filtered.length ? filtered : seedListings.slice(0, 2));
      setGenerating(false);
    }, 600);
  }

  return (
    <div className="content-page">
      <PageTitle eyebrow="DRIP AI STYLIST" title={<>Your personal <em>outfit curator.</em></>}>
        Select your budget in UGX and occasion, and let Drip AI curate the perfect local look for you.
      </PageTitle>

      <div style={{ background: '#fff', padding: '25px', border: '1px solid #e5e2da', margin: '20px 0', display: 'grid', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, marginBottom: '8px' }}>
            Maximum Budget: <strong>UGX {budget.toLocaleString()}</strong>
          </label>
          <input type="range" min="20000" max="300000" step="10000" value={budget} onChange={e => setBudget(Number(e.target.value))} style={{ width: '100%', accentColor: '#496a4d' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, marginBottom: '8px' }}>Select Occasion</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {occasions.map(occ => (
              <button key={occ} onClick={() => setSelectedOccasion(occ)} style={{ padding: '8px 14px', border: `1px solid ${selectedOccasion === occ ? '#496a4d' : '#e5e2da'}`, background: selectedOccasion === occ ? '#496a4d' : '#fff', color: selectedOccasion === occ ? '#fff' : '#20251f', fontSize: '10px', cursor: 'pointer', borderRadius: '99px' }}>
                {occ}
              </button>
            ))}
          </div>
        </div>

        <button className="button button-dark" onClick={handleGenerate} style={{ background: '#496a4d', color: '#fff', padding: '12px', border: 0, fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Sparkles size={16} /> Curate Outfit Bundle
        </button>
      </div>

      <div className="section-heading compact">
        <div><p className="eyebrow">CURATED FOR YOU</p><h2>AI Outfit Matches for <em>{selectedOccasion}</em></h2></div>
      </div>
      {generating ? <Loading label="Drip AI is matching styles and prices…" /> : (
        <div className="product-grid" style={{ marginTop: '20px' }}>
          {curated.map(listing => <ListingCard key={listing.id} listing={listing} />)}
        </div>
      )}
    </div>
  );
}
