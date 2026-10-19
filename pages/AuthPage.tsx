import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { errorMessage } from '../services/http';
import { authService } from '../services/authService';
import { FormError, Notice, PageTitle } from '../components/ui';
import type { AccountRole } from '../types';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password';
const modes: AuthMode[] = ['sign-in', 'sign-up', 'forgot-password', 'reset-password'];

export function AuthPage() {
  const { mode: routeMode = 'sign-in' } = useParams();
  const mode = modes.includes(routeMode as AuthMode) ? routeMode as AuthMode : 'sign-in';
  const navigate = useNavigate();
  const { countries, countriesError, countriesLoading, refreshCountries, refreshSession } = useAppContext();
  const [role, setRole] = useState<AccountRole>('buyer');
  const [countryCode, setCountryCode] = useState('UG');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const countryOptions = countries;
  const isRecovery = mode === 'forgot-password' || mode === 'reset-password';
  const title = mode === 'sign-up' ? 'Make yourself at home.' : mode === 'forgot-password' ? 'Find your way back.' : mode === 'reset-password' ? 'Choose a new password.' : 'Welcome back.';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setFieldError(''); setBusy(true);
    try {
      if (mode === 'sign-up') {
        const result = await authService.signUp({ name: name.trim(), email: email.trim(), password, role, countryCode });
        setMessage(result.message || 'Check your email to confirm your account, then sign in with your password.');
      } else if (mode === 'sign-in') {
        const result = await authService.signIn({ email: email.trim(), password, role });
        await refreshSession();
        const destination = result.user.role === 'admin' ? '/admin' : result.user.role === 'seller' ? '/seller/dashboard' : '/account';
        navigate(destination, { replace: true });
      } else if (mode === 'forgot-password') {
        const result = await authService.requestPasswordReset(email.trim());
        setMessage(result.message || 'If this address is registered, recovery instructions will be sent by email.');
      } else {
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const result = await authService.confirmPasswordReset(password);
        setMessage(result.message || 'Your password has been updated. Sign in with your new password.');
      }
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'The passwords do not match.') setFieldError(caught.message);
      else setError(errorMessage(caught));
    } finally { setBusy(false); }
  }

  return <section className="auth-page">
    <div className="auth-aside"><p className="eyebrow">FASHIONHUB ACCOUNTS</p><h1>Good style.<br /><em>Good people.</em></h1><p>Buyer and seller accounts connect securely through FashionHub.</p><div className="auth-aside-image"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85" alt="Friends browsing independent fashion" /></div></div>
    <div className="auth-form-wrap"><Link className="back-link" to="/"><ArrowLeft size={14} /> Back to discover</Link><PageTitle eyebrow={isRecovery ? 'ACCOUNT RECOVERY' : 'YOUR FASHIONHUB'} title={<>{title}</>}>
      {mode === 'sign-up' ? 'Create a buyer or seller profile with an email address and password.' : mode === 'sign-in' ? 'Choose your account type and sign in with your email and password.' : mode === 'forgot-password' ? 'We’ll email you a secure link to choose a new password.' : 'Set a new password for your FashionHub account.'}
    </PageTitle>
      <Notice tone="warning" title="Keep your password private">Enter it only in this sign-in form. FashionHub support will never ask for your password, mobile-money PIN, or OTP.</Notice>
      {error && <Notice tone="error" title="Request not completed">{error}</Notice>}{message && <Notice tone="success" title="Account status">{message}</Notice>}
      {mode === 'sign-up' && countriesLoading && !countryOptions.length && <Notice tone="info" title="Loading live countries">Connecting to FashionHub’s country list…</Notice>}
      {mode === 'sign-up' && !countriesLoading && !countryOptions.length && <Notice tone="warning" title="Live country list unavailable">{countriesError || 'The account service returned no enabled countries.'} <button className="text-button" type="button" onClick={() => void refreshCountries()}>Retry country list</button></Notice>}
      <form className="form-stack" onSubmit={submit}>
        {(mode === 'sign-up' || mode === 'sign-in') && <label className="field"><span>Account type</span><div className="segmented">{(['buyer', 'seller'] as const).map((item) => <label key={item}><input type="radio" name="role" value={item} checked={role === item} onChange={() => setRole(item)} /><span>{item === 'buyer' ? 'Buyer' : 'Seller'}</span></label>)}</div></label>}
        {mode === 'sign-up' && <label className="field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="name" /></label>}
        {(mode === 'sign-up' || mode === 'sign-in' || mode === 'forgot-password') && <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>}
        {mode === 'sign-up' && <label className="field"><span>Country</span><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} required disabled={!countryOptions.length}><option value="" disabled>{countryOptions.length ? 'Choose a country' : 'Waiting for live countries…'}</option>{countryOptions.map((country) => <option value={country.code} key={country.code}>{country.name}</option>)}</select></label>}
        {(mode === 'sign-up' || mode === 'sign-in' || mode === 'reset-password') && <label className="field"><span>{mode === 'reset-password' ? 'New password' : 'Password'}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></label>}
        {mode === 'reset-password' && <label className="field"><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /></label>}
        <FormError message={fieldError} />
        <button className="button button-dark" type="submit" disabled={busy || (mode === 'sign-up' && !countryOptions.length)}>{busy ? 'Contacting account service…' : <>{mode === 'sign-up' ? 'Create account' : mode === 'forgot-password' ? 'Request recovery link' : mode === 'reset-password' ? 'Save new password' : 'Sign in'} <Mail size={15} /></>}</button>
      </form>
      <div className="auth-switches">{mode !== 'sign-in' && <Link to="/auth/sign-in">Sign in</Link>}{mode !== 'sign-up' && <Link to="/auth/sign-up">Create account</Link>}{mode !== 'forgot-password' && mode !== 'reset-password' && <Link to="/auth/forgot-password">Forgot password?</Link>}{mode === 'forgot-password' && <Link to="/auth/reset-password">Already opened a recovery email? Confirm link</Link>}</div>
    </div>
  </section>;
}

