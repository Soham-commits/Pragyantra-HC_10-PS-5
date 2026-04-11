import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t border-gray-200/60 bg-inherit pt-3 pb-4">
      <div className="max-w-md md:max-w-6xl mx-auto px-5 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-[#94a3b8]">
          <Link to="/privacy" className="hover:text-gray-600 transition-colors">
            {t('footer.privacy_policy')}
          </Link>
          <span>·</span>
          <Link to="/trust" className="hover:text-gray-600 transition-colors">
            {t('footer.trust_center')}
          </Link>
          <span>·</span>
          <Link to="/grievance" className="hover:text-gray-600 transition-colors">
            {t('footer.grievance')}
          </Link>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70"></span>
            {t('footer.abdm')}
          </span>
          <span>·</span>
          <span>{t('footer.copyright', { year: currentYear })}</span>
        </div>
      </div>
    </footer>
  );
}
