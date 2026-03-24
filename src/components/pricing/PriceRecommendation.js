'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, AlertCircle, CheckCircle, Loader2, Lightbulb } from 'lucide-react';
import styles from './PriceRecommendation.module.css';

export default function PriceRecommendation({ productData, onApplyRecommendation }) {
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchRecommendation = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('bidpal_token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

            const response = await fetch(`${apiUrl}/api/price-recommendation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });

            const data = await response.json();

            if (response.ok) {
                setRecommendation(data);
            } else {
                setError(data.error || 'Failed to get recommendation');
            }
        } catch (err) {
            console.error('Price recommendation error:', err);
            setError('Unable to connect to AI service. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyPrices = () => {
        if (recommendation && onApplyRecommendation) {
            onApplyRecommendation({
                reservePrice: recommendation.suggestedReservePrice,
                startingBid: recommendation.suggestedStartingBid,
                bidIncrement: recommendation.suggestedBidIncrement
            });
        }
    };

    const formatCurrency = (amount) => {
        return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className={styles.container}>
            {!recommendation ? (
                <div className={styles.promptSection}>
                    <div className={styles.promptIcon}>
                        <Sparkles size={32} />
                    </div>
                    <h3>AI-Powered Price Recommendation</h3>
                    <p>Let our ML engine analyze market data and suggest optimal pricing for your auction</p>
                    <button
                        onClick={fetchRecommendation}
                        disabled={loading || !productData.name || !productData.category}
                        className={styles.generateBtn}
                    >
                        {loading ? (
                            <>
                                <Loader2 className={styles.spinner} size={18} />
                                Analyzing market data...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Get Price Recommendation
                            </>
                        )}
                    </button>
                    {error && (
                        <div className={styles.errorBox}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.recommendationSection}>
                    <div className={styles.header}>
                        <div className={styles.headerIcon}>
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <h3>Price Recommendation Ready</h3>
                            <p className={styles.confidence}>
                                Confidence: <span className={styles[`confidence${recommendation.confidence}`]}>
                                    {recommendation.confidence}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className={styles.pricesGrid}>
                        <div className={styles.priceCard}>
                            <div className={styles.priceLabel}>Reserve Price</div>
                            <div className={styles.priceValue}>{formatCurrency(recommendation.suggestedReservePrice)}</div>
                            <div className={styles.priceDesc}>Minimum acceptable price</div>
                        </div>

                        <div className={styles.priceCard}>
                            <div className={styles.priceLabel}>Starting Bid</div>
                            <div className={styles.priceValue}>{formatCurrency(recommendation.suggestedStartingBid)}</div>
                            <div className={styles.priceDesc}>Initial bid to attract buyers</div>
                        </div>

                        <div className={styles.priceCard}>
                            <div className={styles.priceLabel}>Bid Increment</div>
                            <div className={styles.priceValue}>{formatCurrency(recommendation.suggestedBidIncrement)}</div>
                            <div className={styles.priceDesc}>Minimum bid increase</div>
                        </div>
                    </div>

                    <div className={styles.priceRange}>
                        <TrendingUp size={18} />
                        <span>Expected Price Range: {formatCurrency(recommendation.priceRange.min)} - {formatCurrency(recommendation.priceRange.max)}</span>
                    </div>

                    {recommendation.reasoning && (
                        <div className={styles.reasoning}>
                            <h4>AI Analysis</h4>
                            <p>{recommendation.reasoning}</p>
                        </div>
                    )}

                    {recommendation.marketInsights && recommendation.marketInsights.length > 0 && (
                        <div className={styles.insights}>
                            <h4><Lightbulb size={18} /> Market Insights</h4>
                            <ul>
                                {recommendation.marketInsights.map((insight, idx) => (
                                    <li key={idx}>{insight}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {recommendation.warning && (
                        <div className={styles.warningBox}>
                            <AlertCircle size={16} />
                            {recommendation.warning}
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button onClick={handleApplyPrices} className={styles.applyBtn}>
                            Apply Recommended Prices
                        </button>
                        <button onClick={() => setRecommendation(null)} className={styles.retryBtn}>
                            Get New Recommendation
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
