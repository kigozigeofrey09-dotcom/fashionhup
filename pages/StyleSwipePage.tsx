import { useState } from 'react';
import { PageTitle, Notice } from '../components/ui';
import { seedListings } from '../data/seed';
import { Heart, X, ShoppingBag, Sparkles } from 'lucide-react';

export function StyleSwipePage() {
  const [items, setItems] = useState(seedListings);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const currentItem = items[currentIndex];

  function handleSwipe(action: 'drip' | 'pass') {
    if (!currentItem) return;
    if (action === 'drip') {
      setLiked(prev => [...prev, currentItem.id]);
      setMessage(`Added "${currentItem.name}" to your Wishlist (Drip) ✨`);
    } else {
      setMessage(`Passed on item.`);
    }
    setTimeout(() => setMessage(''), 1500);
    setCurrentIndex(prev => (prev + 1) % items.length);
  }

  return (
    <div className="content-page" style={{ maxWidth: '500px', margin: '30px auto', textAlign: 'center' }}>
      <PageTitle eyebrow="STYLE SWIPE FEED" title={<>Drip or <em>Pass.</em></>}>
        Swipe right to save items to your wishlist, or swipe left to browse the next look across Kampala fashion boutiques.
      </PageTitle>

      {message && <Notice tone="success">{message}</Notice>}

      {currentItem ? (
        <div style={{ background: '#fff', border: '1px solid #e5e2da', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', position: 'relative', marginTop: '20px' }}>
          <div style={{ height: '420px', background: '#e9e5da', position: 'relative' }}>
            <img src={currentItem.image} alt={currentItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <span style={{ position: 'absolute', top: '15px', left: '15px', background: '#315039', color: '#fff', padding: '6px 12px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', borderRadius: '99px' }}>
              {currentItem.category}
            </span>
          </div>
          <div style={{ padding: '20px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 5px', font: '500 22px var(--serif)' }}>{currentItem.name}</h3>
            <p style={{ color: '#496a4d', fontSize: '18px', fontWeight: 700, margin: '0 0 10px' }}>UGX {currentItem.price.toLocaleString()}</p>
            <p style={{ color: '#73776e', fontSize: '11px', margin: '0 0 20px' }}>{currentItem.shopName} · {currentItem.city}</p>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={() => handleSwipe('pass')} style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #df705e', background: '#fff', color: '#df705e', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <X size={28} />
              </button>
              <button onClick={() => handleSwipe('drip')} style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #496a4d', background: '#496a4d', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Heart size={28} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', background: '#fff', border: '1px solid #e5e2da', marginTop: '20px' }}>
          <h2>You've caught all the drops!</h2>
          <p style={{ color: '#73776e', fontSize: '11px' }}>Check back soon for more fresh Kampala style feeds.</p>
          <button className="button button-dark" onClick={() => setCurrentIndex(0)} style={{ background: '#315039', color: '#fff', marginTop: '15px' }}>Start Over</button>
        </div>
      )}
    </div>
  );
}
