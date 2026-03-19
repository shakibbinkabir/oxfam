import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-600 mb-2">{t('notFound.title')}</h2>
        <p className="text-gray-400 mb-6">{t('notFound.message')}</p>
        <Link
          to="/dashboard"
          className="px-4 py-2 bg-[#1B4F72] text-white rounded-md hover:bg-[#154360] transition-colors"
        >
          {t('notFound.goToDashboard')}
        </Link>
      </div>
    </div>
  );
}
