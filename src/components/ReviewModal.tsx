import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, X } from 'lucide-react';
import { Order } from '../types';
import { apiRequest } from '../lib/api';
import { t } from "../shared/system-texts";

interface ReviewModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ order, onClose, onSuccess }) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [staffRating, setStaffRating] = useState(0);
  const [staffComment, setStaffComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Submit reviews for each product
      for (const item of order.items) {
        const rating = ratings[item.product.id];
        if (rating && rating > 0) {
          await apiRequest('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({
              orderId: order.id,
              productId: item.product.id,
              productName: item.product.name,
              rating,
              comment: comments[item.product.id] || '',
              staffRating: staffRating || null,
              staffComment: staffComment || '',
            }),
          });
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Review submission error:', error);
      alert(error.message || t("degerlendirme-gonderilirken-hata-olustu"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const RatingStars = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-0 border-0 bg-transparent cursor-pointer"
        >
          <Star
            size={24}
            className={star <= value ? 'fill-yellow-400 stroke-yellow-400' : 'stroke-gray-300'}
          />
        </button>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{t("siparisi-degerlendir")}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Product Ratings */}
          {order.items.map((item) => (
            <div key={item.product.id} className="space-y-2">
              <h3 className="font-medium">{item.product.name}</h3>
              <RatingStars
                value={ratings[item.product.id] || 0}
                onChange={(v) => setRatings({ ...ratings, [item.product.id]: v })}
              />
              <textarea
                placeholder={t("yorumunuz-istege-bagli")}
                value={comments[item.product.id] || ''}
                onChange={(e) => setComments({ ...comments, [item.product.id]: e.target.value })}
                className="w-full p-2 border rounded-lg resize-none"
                rows={2}
              />
            </div>
          ))}

          {/* Staff Rating */}
          <div className="border-t pt-4 space-y-2">
            <h3 className="font-medium">{t("personel-degerlendirmesi-istege-bagli")}</h3>
            <RatingStars value={staffRating} onChange={setStaffRating} />
            <textarea
              placeholder={t("personel-hakkinda-yorumunuz")}
              value={staffComment}
              onChange={(e) => setStaffComment(e.target.value)}
              className="w-full p-2 border rounded-lg resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(ratings).length === 0}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {isSubmitting ? t("gonderiliyor") : t("degerlendirmeyi-gonder")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
