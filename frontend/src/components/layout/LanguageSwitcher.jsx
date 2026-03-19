import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === "bn" ? "en" : "bn";
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="w-full text-sm px-3 py-1.5 mb-2 rounded-md bg-[#154360] hover:bg-[#0E2F44] transition-colors flex items-center justify-center gap-2"
    >
      {i18n.language === "bn" ? "English" : "বাংলা"}
    </button>
  );
}
