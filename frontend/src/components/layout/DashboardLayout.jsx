import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import LanguageSwitcher from "../../components/layout/LanguageSwitcher";

const INDICATOR_SUBITEMS = [
  {
    to: "/dashboard/indicators",
    label: "Indicators",
    labelKey: "nav.indicators",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    to: "/dashboard/submit-risk-index",
    label: "Data Entry Wizard",
    labelKey: "nav.dataEntryWizard",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    adminOnly: true,
  },
  {
    to: "/dashboard/submit-indicator",
    label: "Submit Value",
    labelKey: "nav.submitValue",
    icon: "M12 4v16m8-8H4",
    adminOnly: true,
  },
  {
    to: "/dashboard/indicator-values",
    label: "List of Values",
    labelKey: "nav.listOfValues",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
  },
  {
    to: "/dashboard/value-uploader",
    label: "Value Uploader",
    labelKey: "nav.valueUploader",
    icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
    adminOnly: true,
  },
  {
    to: "/dashboard/units",
    label: "Units",
    labelKey: "nav.units",
    icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
  },
  {
    to: "/dashboard/sources",
    label: "Sources",
    labelKey: "nav.sources",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
];

const INDICATOR_PATHS = INDICATOR_SUBITEMS.map((item) => item.to);

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Check if current path is under indicators section
  const isIndicatorSection = INDICATOR_PATHS.some(
    (path) => location.pathname === path || location.pathname.startsWith(path + "/")
  );

  const [indicatorOpen, setIndicatorOpen] = useState(isIndicatorSection);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? "bg-[#154360] text-white"
        : "text-blue-100 hover:bg-[#154360] hover:text-white"
    }`;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#1B4F72] text-white flex flex-col transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-[#154360] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{t('app.title')}</h1>
            <p className="text-xs text-blue-200">{t('app.subtitle')}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-[#154360] rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Dashboard (Map) */}
          <NavLink
            to="/dashboard"
            end
            onClick={() => setSidebarOpen(false)}
            className={linkClass}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {t('nav.dashboard')}
          </NavLink>

          {/* Indicator section - collapsible */}
          <div>
            <button
              onClick={() => setIndicatorOpen((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                isIndicatorSection
                  ? "bg-[#154360] text-white"
                  : "text-blue-100 hover:bg-[#154360] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t('nav.indicator')}
              </div>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${indicatorOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Submenu items */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                indicatorOpen ? "max-h-96 mt-1" : "max-h-0"
              }`}
            >
              <div className="ml-4 pl-3 border-l border-[#2C6E94] space-y-0.5">
                {INDICATOR_SUBITEMS.filter(
                  (item) => !item.adminOnly || isAdmin
                ).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-[#154360] text-white"
                          : "text-blue-200 hover:bg-[#154360] hover:text-white"
                      }`
                    }
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <NavLink
            to="/dashboard/scenarios"
            onClick={() => setSidebarOpen(false)}
            className={linkClass}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {t('nav.scenarios')}
          </NavLink>

          {/* Audit Log (admin only) */}
          {isAdmin && (
            <NavLink
              to="/dashboard/audit-log"
              onClick={() => setSidebarOpen(false)}
              className={linkClass}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('nav.auditLog')}
            </NavLink>
          )}

          {/* Users (superadmin only) */}
          {user?.role === "superadmin" && (
            <NavLink
              to="/dashboard/users"
              onClick={() => setSidebarOpen(false)}
              className={linkClass}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              {t('nav.users')}
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t border-[#154360]">
          <div className="text-sm text-blue-200 mb-1">{user?.full_name}</div>
          <div className="text-xs text-blue-300 mb-3">{t('roles.' + user?.role)}</div>
          <LanguageSwitcher />
          <button
            onClick={logout}
            className="w-full text-sm px-3 py-1.5 rounded-md bg-[#154360] hover:bg-[#0E2F44] transition-colors"
          >
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-[#1B4F72]">{t('app.mobileTitle')}</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
