import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ShoppingCart } from 'lucide-react';
import { Order, Product } from '../types';
import { t } from "../shared/system-texts";

interface FrequentOrdersProps {
  orders: Order[];
  products: Product[];
  onAddToCart: (productId: string) => void;
  className?: string;
}

export const FrequentOrders: React.FC<FrequentOrdersProps> = ({ orders, products, onAddToCart, className }) => {
  // Calculate frequency
  const productFrequency: Record<string, { count: number; product: Product }> = {};

  orders
    .filter((o) => o.status === 'completed')
    .forEach((order) => {
      order.items.forEach((item) => {
        const productId = item.product.id;
        if (!productFrequency[productId]) {
          productFrequency[productId] = { count: 0, product: item.product };
        }
        productFrequency[productId].count += item.quantity;
      });
    });

  const frequentProducts = Object.values(productFrequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  if (frequentProducts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <TrendingUp size={20} />
        {t("sik-siparis-ettikleriniz")}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {frequentProducts.map(({ product, count }) => (
          <motion.div
            key={product.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
            onClick={() => onAddToCart(product.id)}
          >
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-20 object-cover rounded-lg mb-2"
              />
            )}
            <div className="text-sm font-medium mb-1 line-clamp-1">{product.name}</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{count}x sipariş</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">{product.price} ₺</span>
                <ShoppingCart size={14} className="text-blue-600" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
