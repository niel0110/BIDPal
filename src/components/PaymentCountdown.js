'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import styles from './PaymentCountdown.module.css';

export default function PaymentCountdown({ deadline, onExpired }) {
    const [timeLeft, setTimeLeft] = useState(null);
    const [expired, setExpired] = useState(false);
    const onExpiredRef = useRef(onExpired);
    const firedRef = useRef(false);

    // Keep ref current without re-running the effect
    useEffect(() => { onExpiredRef.current = onExpired; }, [onExpired]);

    useEffect(() => {
        firedRef.current = false; // reset if deadline changes

        const calculateTimeLeft = () => {
            const diff = new Date(deadline) - new Date();

            if (diff <= 0) {
                setExpired(true);
                // Only fire onExpired once
                if (!firedRef.current) {
                    firedRef.current = true;
                    if (onExpiredRef.current) onExpiredRef.current();
                }
                return null;
            }

            return {
                hours: Math.floor(diff / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000),
                total: diff
            };
        };

        const initial = calculateTimeLeft();
        setTimeLeft(initial);

        if (initial === null) return; // already expired, no interval needed

        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            if (remaining === null) clearInterval(timer); // stop once expired
        }, 1000);

        return () => clearInterval(timer);
    }, [deadline]); // only deadline — onExpired handled via ref

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
