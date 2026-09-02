import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MessageSquare, DollarSign, HelpCircle, AlertTriangle, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { t } from "../shared/system-texts";

interface WaiterCallButtonProps {
  tableNumber: string;
  tableSessionToken?: string;
  className?: string;
}

export const WaiterCallButton: React.FC<WaiterCallButtonProps> = ({
  tableNumber,
  tableSessionToken,
  className,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'bill' | 'help' | 'complaint' | 'order' | null>(null);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callTypes = [
    { type: 'bill' as const, label: t("hesap-iste"), icon: DollarSign, color: 'bg-blue-500' },
    { type: 'help' as const, label: t("yardim"), icon: HelpCircle, color: 'bg-green-500' },
    { type: 'order' as const, label: t("ek-siparis"), icon: MessageSquare, color: 'bg-purple-500' },
    { type: 'complaint' as const, label: t("sikayet"), icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const handleSubmit = async () => {
    if (!selectedType) return;

    try {
      setIsSubmitting(true);

      await apiRequest('/api/waiter-calls', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber,
          tableSessionToken: tableSessionToken || '',
          type: selectedType,
          message,
          priority,
        }),
      });

      alert(t("garson-cagriniz-iletildi"));
      setShowModal(false);
      setSelectedType(null);
      setMessage('');
      setPriority('normal');
    } catch (error: any) {
      alert(error.message || t("cagri-gonderilemedi"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-medium shadow-lg hover:bg-amber-600 transition-colors ${className}`}
      >
        <Bell size={20} />
        {t("garson-cagir")}
      </motion.button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold">{t("garson-cagir")}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t("cagri-turu")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {callTypes.map(({ type, label, icon: Icon, color }) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          selectedType === type
                            ? `${color} text-white border-transparent`
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon size={24} className="mx-auto mb-1" />
                        <div className="text-sm font-medium">{label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t("mesaj-istege-bagli")}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("ek-bilgi-veya-aciklama-giriniz")}
                    className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={priority === 'urgent'}
                      onChange={(e) => setPriority(e.target.checked ? 'urgent' : 'normal')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Acil</span>
                  </label>
                </div>
              </div>

              <div className="p-4 border-t">
                <button
                  onClick={handleSubmit}
                  disabled={!selectedType || isSubmitting}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? t("gonderiliyor") : t("cagriyi-gonder")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
