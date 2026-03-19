import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import LanguageSwitcher from "../layout/LanguageSwitcher";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t('auth.passwordMin'));
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password, fullName);
      toast.success(t('auth.registerSuccess'));
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || t('auth.registerFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-[#1B4F72] mb-6">
          {t('app.fullTitle')}
        </h1>
        <p className="text-center text-gray-500 mb-8">{t('auth.createAccount')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.fullName')}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1B4F72] focus:border-transparent"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1B4F72] focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1B4F72] focus:border-transparent"
              placeholder={t('auth.minChars')}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-[#1B4F72] text-white rounded-md hover:bg-[#154360] disabled:opacity-50 transition-colors"
          >
            {submitting ? t('auth.creatingAccount') : t('auth.register')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {t('auth.hasAccount')}{" "}
          <Link to="/login" className="text-[#1B4F72] font-medium hover:underline">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
      <div className="mt-4">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
