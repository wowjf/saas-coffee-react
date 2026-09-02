import React from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Plus } from 'lucide-react';
import { Order, Product } from '../types';
import { t } from "../shared/system-texts";

interface QuickReorderProps {
  recentOrders: Order[];
  onReorder: (items: { product: Product; quantity: number }[]) => void;
  className?: string;
}

export const QuickReorder: React.FC<QuickReorderProps> = ({ recentOrders, onReorder, className }) => {
  const completedOrders = recentOrders
    .filter((o) => o.status === 'completed')
    .slice(0, 3);

  if (completedOrders.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <RotateCcw size={20} />
        {t("tekrar-siparis-et")}
      </h3>
      <div className="space-y-2">
        {completedOrders.map((order) => (
          <motion.button
            key={order.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onReorder(order.items)}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">
                  {new Date(order.timestamp).toLocaleDateString('tr-TR')}
                </div>
                <div className="font-medium text-sm mb-1">
                  {order.items.slice(0, 2).map((item) => item.product.name).join(', ')}
                  {order.items.length > 2 && ` +${order.items.length - 2} ürün`}
                </div>
                <div className="text-sm text-gray-600">{order.total.toFixed(2)} ₺</div>
              </div>
              <Plus size={20} className="text-blue-600 mt-1" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
