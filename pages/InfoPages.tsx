import { Link } from 'react-router-dom';
import { PageTitle } from '../components/ui';

const faqs = [
  ['Are these sellers and prices live?', 'No. Any listing marked SAMPLE is development seed data bundled with the front end. Live data must come from the marketplace API.'],
  ['Do I need a subscription to view a shop?', 'Marketplace previews can be browsed without a subscription. Under the current development access policy, buyers need active Mega Buyer access for full seller storefronts, listing details, enquiries and order requests. The backend access policy is authoritative and admins can change required roles.'],
  ['Which subscription plans are available?', 'The UI previews Basic Seller at UGX 10,000/month, Premium Seller at UGX 20,000/month and Mega Buyer at UGX 35,000/month for Uganda. These seed plans are not purchasable until configured plans and local prices are returned by the backend.'],
  ['Does Premium guarantee sales?', 'No. Premium seller and listing placements are labelled Featured or Sponsored. Promotion does not guarantee views, enquiries or sales.'],
  ['What does the Mega Member badge mean?', 'It indicates paid Mega Buyer membership only. It is not an identity-verification badge.'],
  ['Can I pay through this app?', 'No payment is processed by this front end. Subscription payment instructions are country-specific, and payment submissions stay pending until a backend-authorized administrator reviews them.'],
  ['Is 0773927881 used in other countries?', 'No. It is shown only as the Uganda manual payment instruction. Instructions for other countries are awaiting country-specific configuration.'],
  ['Does this create an order?', 'No. Enquiries and order status are separate. An enquiry requires an API response; this app does not reserve goods, take payment, or arrange delivery.'],
  ['What information should I never submit?', 'Never share a mobile-money PIN, password, or OTP. The account UI uses email-link authentication and does not collect passwords.'],
  ['Are prices converted between currencies?', 'No. Each listing is displayed with the currency code returned by its country configuration. No exchange rate is calculated in the front end.'],
];

export function SupportPage() {
  return <section className="content-page support-page"><PageTitle eyebrow="FASHIONHUB SUPPORT" title={<>Good questions, <em>answered.</em></>}><span>Support details are a launch checklist until a contact endpoint is connected.</span></PageTitle><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div><div className="support-actions"><Link className="button button-dark" to="/auth/sign-in">Account help</Link><Link className="button button-outline" to="/policies">Read policies</Link></div></section>;
}

export function InformationPage() {
  return <section className="content-page"><PageTitle eyebrow="FASHIONHUB" title={<>The important <em>details.</em></>}><span>These are implementation notes, not final legal terms. Obtain reviewed policy text before launch.</span></PageTitle><div className="policy-grid"><article><h2>Privacy</h2><p>Authentication, saved listings, shop data and enquiries are expected to be handled by the backend. The front end does not store passwords, PINs, OTPs, or authentication credentials in local storage.</p></article><article><h2>Marketplace terms</h2><p>Development seed listings are labelled as sample-only. They are not live offers, and no contract is formed through sample content.</p></article><article><h2>Subscriptions & refunds</h2><p>Payer eligibility, price, renewal interval, cancellation and refund terms remain awaiting confirmation. A submitted transaction reference remains pending until admin review through the backend.</p></article><article><h2>Safety</h2><p>Never request or share a mobile-money PIN, password or OTP. The Uganda number 0773927881 is not a general regional payment number.</p></article><article><h2>Admin permissions</h2><p>The UI checks the role returned in an authenticated session. The backend must authorize every administrative action independently.</p></article><article><h2>Orders & delivery</h2><p>Order states and delivery tracking are displayed only when supplied by their future services. This front end does not submit an order or delivery request.</p></article></div><Link className="button button-outline" to="/support">Back to support</Link></section>;
}
