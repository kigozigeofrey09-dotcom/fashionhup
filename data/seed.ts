import type { AccountRole, Category, Country, Listing, Shop, SubscriptionPlan } from '../types';

export const categories: Category[] = ['Clothing', 'Shoes', 'Bags', 'Jewellery', 'Beauty', 'Tailoring', 'Accessories', 'Pet Fashion (PAW)', 'Other'];

export const seedPlans: SubscriptionPlan[] = [
  { id: 'basic-seller', name: 'Basic Seller', payerTypes: ['seller'], targetRoles: ['seller'], amount: 10000, currency: 'UGX', priceLabel: 'UGX 10,000 / month', renewalPeriod: 'Monthly', benefits: ['Standard storefront', 'Regular product and service listings', 'Normal marketplace placement'], countryPrices: { UG: { amount: 10000, currency: 'UGX' } }, isSeed: true },
  { id: 'premium-seller', name: 'Premium Seller', payerTypes: ['seller'], targetRoles: ['seller'], amount: 20000, currency: 'UGX', priceLabel: 'UGX 20,000 / month', renewalPeriod: 'Monthly', benefits: ['All Basic Seller benefits', 'Promoted seller and listing placement compared with Basic sellers', 'Paid placements are clearly labelled Featured or Sponsored'], countryPrices: { UG: { amount: 20000, currency: 'UGX' } }, promotionLabel: 'Featured', isSeed: true },
  { id: 'mega-buyer', name: 'Mega Buyer', payerTypes: ['buyer'], targetRoles: ['buyer'], amount: 35000, currency: 'UGX', priceLabel: 'UGX 35,000 / month', renewalPeriod: 'Monthly', benefits: ['Full seller storefront access', 'Blue Mega Member paid-membership badge', 'Promoted visibility for the buyer profile or enquiries'], countryPrices: { UG: { amount: 35000, currency: 'UGX' } }, accessLabel: 'full storefronts', isSeed: true },
];

export const seedSubscriptionRequiredRoles: AccountRole[] = ['buyer'];

export const seedCountries: Country[] = [
  { code: 'UG', name: 'Uganda', currency: 'UGX', cities: ['Kampala', 'Entebbe', 'Jinja', 'Mbarara', 'Gulu', 'Fort Portal', 'Mbale'], paymentInstructions: 'Uganda Mobile Money payment: 0773927881. Payment remains unverified until admin review. Never share a PIN or OTP.' }
];

const uganda = { code: 'UG', name: 'Uganda', currency: 'UGX' };

export const seedShops: Shop[] = [
  { id: 'seed-mirembe', name: 'Mirembe Studio', story: 'Easy shapes, thoughtful fabrics and small runs made in Kampala.', tagline: 'A softer take on everyday dressing.', categories: ['Clothing', 'Accessories'], sellType: 'products', countryCode: 'UG', countryName: 'Uganda', city: 'Kampala', accent: '#496a4d', isVerified: true, isSeed: true },
  { id: 'seed-nali', name: 'Nali Finds', story: 'Useful, colourful pieces made to move with you.', tagline: 'Carry a little colour.', categories: ['Bags', 'Accessories', 'Pet Fashion (PAW)'], sellType: 'products', countryCode: 'UG', countryName: 'Uganda', city: 'Jinja', accent: '#a94f47', isVerified: true, isSeed: true },
  { id: 'seed-sanyu', name: 'Sanyu Objects', story: 'Small objects and jewellery finished by hand.', tagline: 'Little things, made with care.', categories: ['Jewellery'], sellType: 'products', countryCode: 'UG', countryName: 'Uganda', city: 'Entebbe', accent: '#a37936', isVerified: false, isSeed: true },
  { id: 'seed-ayo', name: 'Ayo Atelier', story: 'Alterations and fitting sessions by appointment.', tagline: 'A better fit starts here.', categories: ['Tailoring', 'Clothing'], sellType: 'services', countryCode: 'UG', countryName: 'Uganda', city: 'Kampala', accent: '#426c83', isVerified: true, isSeed: true },
];

const image = (photo: string) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=85`;

export const seedListings: Listing[] = [
  { id: 'seed-shirt', shopId: 'seed-mirembe', shopName: 'Mirembe Studio', name: 'The Sunday Shirt', category: 'Clothing', type: 'product', description: 'An easy cotton shirt for slow Sundays and everything after.', price: 85000, currency: uganda.currency, countryCode: uganda.code, countryName: uganda.name, city: 'Kampala', image: image('photo-1598554747436-c9293d6a588f'), sizes: 'S, M, L', colour: 'Terracotta', isSeed: true },
  { id: 'seed-weekender', shopId: 'seed-nali', shopName: 'Nali Finds', name: 'Kitenge Weekender', category: 'Bags', type: 'product', description: 'Room for the essentials, lined with a little extra personality.', price: 120000, currency: uganda.currency, countryCode: uganda.code, countryName: uganda.name, city: 'Jinja', image: image('photo-1548036328-c9fa89d128fa'), colour: 'Indigo / ochre', isSeed: true },
  { id: 'seed-hoops', shopId: 'seed-sanyu', shopName: 'Sanyu Objects', name: 'Beaded Sun Hoops', category: 'Jewellery', type: 'product', description: 'Lightweight statement hoops finished by hand in Entebbe.', price: 45000, currency: uganda.currency, countryCode: uganda.code, countryName: uganda.name, city: 'Entebbe', image: image('photo-1535632066927-ab7c9ab60908'), colour: 'Gold / amber', isSeed: true },
  { id: 'seed-slides', shopId: 'seed-mirembe', shopName: 'Mirembe Studio', name: 'Everyday Leather Slide', category: 'Shoes', type: 'product', description: 'A clean leather slide made for the long way home.', price: 95000, currency: uganda.currency, countryCode: uganda.code, countryName: uganda.name, city: 'Kampala', image: image('photo-1543163521-1bf539c55dd2'), sizes: '36–42', colour: 'Cognac', isSeed: true },
  { id: 'seed-fitting', shopId: 'seed-ayo', shopName: 'Ayo Atelier', name: 'Made-for-you Fit Session', category: 'Tailoring', type: 'service', description: 'A fitting and measurement session to get your next piece just right.', price: 40000, currency: uganda.currency, countryCode: uganda.code, countryName: uganda.name, city: 'Kampala', image: image('photo-1590736969955-71cc94901144'), serviceDetails: 'By appointment', enquiryLabel: 'Ask about availability', isSeed: true },
  { id: 'seed-paw', shopId: 'seed-nali', shopName: 'Nali Finds', name: 'Kampala K9 Kitenge Hoodie', category: 'Pet Fashion (PAW)', type: 'product', description: 'Matching kitenge hoodie for your furry companion, handmade in Kampala.', price: 55000, currency: uganda.currency, countryCode: uganda.code, countryName: uganda.name, city: 'Kampala', image: image('photo-1583511655857-d19b40a7a54e'), sizes: 'XS, S, M, L', colour: 'Kitenge Print', isSeed: true },
];
