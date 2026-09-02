import React, { useState } from 'react';
import { Tag, Check, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Coupon } from '../types';
import { t } from "../shared/system-texts";

interface CouponInputProps {
  orderTotal: number;
  onApplyCoupon: (coupon: Coupon, discountAmount: number) => void;
  onRemoveCoupon: () => void;
  appliedCoupon?: { code: string; discountAmount: number } | null;
}

export const CouponInput: React.FC<CouponInputProps> = ({
  orderTotal,
  onApplyCoupon,
  onRemoveCoupon,
  appliedCoupon,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!couponCode.trim()) {
      setError(t("lutfen-kupon-kodu-giriniz"));
      return;
    }

    try {
      setIsValidating(true);
      setError('');

      const response = await apiRequest<{ valid: boolean; coupon: Coupon; discountAmount: number }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code: couponCode.toUpperCase(), orderTotal }),
        }
      );

      if (response.valid) {
        onApplyCoupon(response.coupon, response.discountAmount);
        setCouponCode('');
      }
    } catch (err: any) {
      setError(err.message || t("kupon-dogrulanamadi"));
    } finally {
      setIsValidating(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-2">
          <Check size={20} className="text-green-600" />
          <div>
            <div className="text-sm font-medium text-green-900">{appliedCoupon.code}</div>
            <div className="text-xs text-green-700">-{appliedCoupon.discountAmount.toFixed(2)} ₺ indirim</div>
          </div>
        </div>
        <button
          onClick={onRemoveCoupon}
          className="p-1 hover:bg-green-100 rounded-full transition-colors"
        >
          <X size={18} className="text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="Kupon kodu giriniz"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            onKeyPress={(e) => e.key === 'Enter' && handleValidate()}
          />
        </div>
        <button
          onClick={handleValidate}
          disabled={isValidating || !couponCode.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isValidating ? 'Kontrol ediliyor...' : 'Uygula'}
        </button>
      </div>
      {error && <div className="text-sm text-red-600 flex items-center gap-1">
        <X size={14} />
        {error}
      </div>}
    </div>
  );
};
