import { useTranslation } from "react-i18next";

export default function LanguageSwitcher({ variant = "sidebar" }) {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === "bn" ? "en" : "bn";
    i18n.changeLanguage(next);
  };

  const styles =
    variant === "auth"
      ? "px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
      : "w-full text-sm px-3 py-1.5 mb-2 rounded-md bg-[#154360] hover:bg-[#0E2F44] transition-colors flex items-center justify-center gap-2";

  return (
    <button onClick={toggleLanguage} className={styles}>
      {i18n.language === "bn" ? "English" : "বাংলা"}
    </button>
  );
}
