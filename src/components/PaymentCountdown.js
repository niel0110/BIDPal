'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import styles from './PaymentCountdown.module.css';

export default function PaymentCountdown({ deadline, onExpired }) {
    const [timeLeft, setTimeLeft] = useState(null);
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const deadlineDate = new Date(deadline);
            const diff = deadlineDate - now;

            if (diff <= 0) {
                setExpired(true);
                if (onExpired) onExpired();
                return null;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            return { hours, minutes, seconds, total: diff };
        };

        // Initial calculation
        const initial = calculateTimeLeft();
        setTimeLeft(initial);

        // Update every second
        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
        }, 1000);

        return () => clearInterval(timer);
    }, [deadline, onExpired]);

    if (expired) {
        return (
            <div className={`${styles.countdown} ${styles.expired}`}>
                <Clock size={16} />
                <span>Payment window expired</span>
            </div>
        );
    }

    if (!timeLeft) {
        return null;
    }

    const isUrgent = timeLeft.total < 3 * 60 * 60 * 1000; // Less than 3 hours
    const isCritical = timeLeft.total < 1 * 60 * 60 * 1000; // Less than 1 hour

    return (
        <div className={`${styles.countdown} ${isUrgent ? styles.urgent : ''} ${isCritical ? styles.critical : ''}`}>
            <Clock size={16} />
            <span>
                {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s remaining
            </span>
        </div>
    );
}
