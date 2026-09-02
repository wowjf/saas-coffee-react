import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../AppContext';
import { 
  Coffee, 
  ShoppingBag, 
  Bell, 
  User as UserIcon, 
  LayoutDashboard, 
  ClipboardList, 
  Users,
  Settings,
  Gift,
  Search,
  Utensils
} from 'lucide-react';
import { t } from "../shared/system-texts";

interface NavItemProps {
  id: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon: Icon, active, onClick }) => (
  <button 
    onClick={onClick}
    aria-label={label}
    className="flex flex-col items-center justify-center flex-1 py-2 relative"
  >
    <motion.div
      whileTap={{ scale: 0.8 }}
      className={`p-1 rounded-xl transition-colors ${active ? 'text-black' : 'text-text-secondary'}`}
    >
      <Icon size={26} strokeWidth={active ? 2.5 : 2} />
    </motion.div>
    {active && (
      <motion.div 
        layoutId="nav-indicator"
        className="absolute -top-0.5 w-1 h-1 bg-black rounded-full"
      />
    )}
  </button>
);

export const BottomNav: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
  const { role, isTableMode } = useApp();

  const customerTabs = [
    { id: 'home', label: t("menu"), icon: Coffee },
    { id: 'campaigns', label: t("firsatlar"), icon: Gift },
    isTableMode 
      ? { id: 'table-session', label: 'Masa', icon: Utensils }
      : { id: 'orders', label: t("siparisler"), icon: ShoppingBag },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    { id: 'profile', label: 'Profil', icon: UserIcon },
  ];

  const staffTabs = [
    { id: 'live', label: t("canli"), icon: ClipboardList },
    { id: 'tables', label: 'Masalar', icon: Utensils },
    { id: 'query', label: 'Sorgu', icon: Search },
    { id: 'profile', label: 'Profil', icon: UserIcon },
  ];

  const managerTabs = [
    { id: 'dashboard', label: t("ozet"), icon: LayoutDashboard },
    { id: 'staff', label: 'Personel', icon: Users },
    { id: 'cms', label: t("icerik"), icon: Settings },
    { id: 'profile', label: 'Profil', icon: UserIcon },
  ];

  const tabs = role === 'customer' ? customerTabs : role === 'staff' ? staffTabs : managerTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass z-50 px-4 pb-safe flex items-center justify-around h-20 rounded-t-[24px] sm:rounded-t-[28px] border-t border-border shadow-[0_-6px_24px_rgba(0,0,0,0.05)]">
      {tabs.map((tab) => (
        <NavItem
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          active={activeTab === tab.id}
          onClick={() => setActiveTab(tab.id)}
        />
      ))}
    </nav>
  );
};
