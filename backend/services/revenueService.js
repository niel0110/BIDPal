const PRICE_TIERS = [
  { min: 50000, rate: 0.06 },
  { min: 20000, rate: 0.07 },
  { min: 10000, rate: 0.08 },
  { min: 5000, rate: 0.09 },
  { min: 0, rate: 0.10 }
];

const VOLUME_DISCOUNTS = [
  { minSales: 100, discount: 0.02 },
  { minSales: 50, discount: 0.015 },
  { minSales: 20, discount: 0.01 },
  { minSales: 10, discount: 0.005 },
  { minSales: 0, discount: 0 }
];

export const PREMIUM_SELLER_MONTHLY_FEES = {
  basic: 0,
  growth: 199,
  pro: 499
};

export const VALUE_ADDED_SERVICE_FEES = {
  shipping_label_generation: 25,
  insurance_rate: 0.015,
  professional_photography_tips: 99,
  seller_training_workshop: 499,
  featured_listing: 99,
  highlighted_auction: 149
};

const roundMoney = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

export const getBaseCommissionRate = (saleAmount) => {
  const amount = Number(saleAmount || 0);
  return PRICE_TIERS.find(tier => amount >= tier.min)?.rate || 0.10;
};

export const getVolumeDiscount = (salesCount) => {
  const count = Number(salesCount || 0);
  return VOLUME_DISCOUNTS.find(tier => count >= tier.minSales)?.discount || 0;
};

export const calculateCommission = ({ saleAmount, sellerSalesCount = 0 }) => {
  const grossSaleAmount = roundMoney(saleAmount);
  const baseRate = getBaseCommissionRate(grossSaleAmount);
  const volumeDiscount = getVolumeDiscount(sellerSalesCount);
  const commissionRate = Math.max(0.05, roundMoney(baseRate - volumeDiscount));
  const commissionAmount = roundMoney(grossSaleAmount * commissionRate);
  const sellerNetAmount = roundMoney(grossSaleAmount - commissionAmount);

  return {
    grossSaleAmount,
    commissionRate,
    commissionAmount,
    sellerNetAmount,
    baseRate,
    volumeDiscount
  };
};

export const getSellerRecentSalesCount = async (supabase, sellerId) => {
  if (!sellerId) return 0;

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { count, error } = await supabase
    .from('Orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .in('status', ['processing', 'shipped', 'completed'])
    .gte('placed_at', since.toISOString());

  if (error) {
    console.warn('Revenue service could not read seller sales count:', error.message);
    return 0;
  }

  return count || 0;
};

export const calculateSellerCommission = async (supabase, { sellerId, saleAmount }) => {
  const sellerSalesCount = await getSellerRecentSalesCount(supabase, sellerId);
  return {
    ...calculateCommission({ saleAmount, sellerSalesCount }),
    sellerSalesCount
  };
};

export const recordPlatformEarning = async (
  supabase,
  { orderId, sellerId, totalAmount, commissionRate, commissionAmount, earningType = 'transaction_commission' }
) => {
  if (!orderId || !sellerId || !commissionAmount) return;

  const earningRecord = {
    order_id: orderId,
    seller_id: sellerId,
    total_amount: roundMoney(totalAmount),
    commission_rate: commissionRate,
    commission_amount: roundMoney(commissionAmount),
    earning_type: earningType
  };

  const { data: existing, error: existingError } = await supabase
    .from('Platform_Earnings')
    .select('*')
    .eq('order_id', orderId)
    .eq('earning_type', earningType)
    .maybeSingle();

  if (!existingError && existing) {
    const { error } = await supabase
      .from('Platform_Earnings')
      .update(earningRecord)
      .eq('order_id', orderId)
      .eq('earning_type', earningType);
    if (error) console.warn('Platform earning update failed:', error.message);
    return;
  }

  const { error } = await supabase
    .from('Platform_Earnings')
    .insert([earningRecord]);

  if (error) console.warn('Platform earning insert failed:', error.message);
};

export const getSubscriptionPlanFee = (plan) => {
  const normalizedPlan = String(plan || '').toLowerCase();
  return PREMIUM_SELLER_MONTHLY_FEES[normalizedPlan] ?? null;
};

export const getValueAddedServiceFee = ({ serviceType, insuredAmount = 0 }) => {
  if (serviceType === 'insurance') {
    return roundMoney(Number(insuredAmount || 0) * VALUE_ADDED_SERVICE_FEES.insurance_rate);
  }
  return VALUE_ADDED_SERVICE_FEES[serviceType] ?? null;
};

export const recordValueAddedEarning = async (
  supabase,
  { sellerId, orderId = null, serviceType, amount }
) => {
  if (!sellerId || !serviceType || !amount) return;

  const { error } = await supabase
    .from('Value_Added_Earnings')
    .insert([{
      seller_id: sellerId,
      order_id: orderId,
      service_type: serviceType,
      amount: roundMoney(amount)
    }]);

  if (error) console.warn('Value-added earning insert failed:', error.message);
};
