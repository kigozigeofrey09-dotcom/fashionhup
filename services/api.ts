import type { AccountRole, AdminSettings, Country, Enquiry, Listing, Session, Shop, SubscriptionAccess, SubscriptionPlan, SubscriptionRecord, User } from '../types';
import { accountService } from './accountService';
import { adminService } from './adminService';
import { authService } from './authService';
import { countryService } from './countryService';
import { enquiryService } from './enquiryService';
import { errorMessage } from './http';
import { listingService } from './listingService';
import { marketplaceService } from './marketplaceService';
import { notificationService } from './notificationService';
import { orderService } from './orderService';
import { paymentSubmissionService } from './paymentSubmissionService';
import { shopService } from './shopService';
import { subscriptionService } from './subscriptionService';

export { ApiError } from './http';
export { errorMessage } from './http';

export const api = {
  getSession: (): Promise<Session> => authService.getSession(),
  signIn: authService.signIn,
  signUp: authService.signUp,
  requestPasswordReset: authService.requestPasswordReset,
  confirmPasswordReset: authService.confirmPasswordReset,
  whoAmI: authService.whoAmI,
  signOut: authService.signOut,
  listCountries: countryService.list,
  listListings: marketplaceService.searchListings,
  listShops: marketplaceService.searchShops,
  getListing: listingService.get,
  getShop: shopService.get,
  getShopListings: listingService.forShop,
  createShop: shopService.create,
  getMyShop: shopService.getMine,
  getMyListings: listingService.mine,
  updateShop: shopService.update,
  createListing: listingService.create,
  updateListing: listingService.update,
  deleteListing: listingService.remove,
  createEnquiry: enquiryService.create,
  listMyEnquiries: enquiryService.mine,
  listSellerEnquiries: enquiryService.sellerInbox,
  replyToEnquiry: enquiryService.reply,
  listMyOrders: orderService.mine,
  listSellerOrders: orderService.sellerOrders,
  createOrder: orderService.create,
  updateOrderStatus: orderService.updateStatus,
  listSaved: accountService.savedListings,
  saveListing: accountService.saveListing,
  unsaveListing: accountService.removeSavedListing,
  getAccountSettings: accountService.settings,
  updateAccountSettings: accountService.updateSettings,
  deleteAccount: accountService.deleteAccount,
  listNotifications: notificationService.mine,
  unreadNotifications: notificationService.unreadCount,
  markNotificationRead: notificationService.markRead,
  markAllNotificationsRead: notificationService.markAllRead,
  listPlans: subscriptionService.plans,
  listSubscriptions: subscriptionService.mine,
  getSubscriptionAccessRules: subscriptionService.accessRules,
  getSubscriptionAccess: subscriptionService.access,
  cancelSubscription: subscriptionService.cancel,
  requestRenewal: subscriptionService.requestRenewal,
  getSubscription: subscriptionService.status,
  submitSubscription: paymentSubmissionService.submit,
  listPaymentSubmissions: adminService.paymentQueue,
  reviewPayment: adminService.reviewPayment,
  getAdminSettings: adminService.settings,
  updateAdminSettings: adminService.updateSettings,
  updateSubscriptionAccess: adminService.updateSubscriptionAccess,
  getSellersReport: adminService.sellersReport,
  getListingsReport: adminService.listingsReport,
  updateCountryInstructions: adminService.updatePaymentInstructions,
  addCountry: adminService.createCountry,
};

export type {
  AccountRole,
  AdminSettings,
  Country,
  Enquiry,
  Listing,
  Session,
  Shop,
  SubscriptionAccess,
  SubscriptionPlan,
  SubscriptionRecord,
  User,
};
