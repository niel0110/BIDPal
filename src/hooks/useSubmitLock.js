'use client';

import { useRef, useState } from 'react';

export function useSubmitLock() {
    const lockRef = useRef(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const runWithLock = async (task) => {
        if (lockRef.current) return false;

        lockRef.current = true;
        setIsSubmitting(true);
        try {
            await task();
            return true;
        } finally {
            lockRef.current = false;
            setIsSubmitting(false);
        }
    };

    return { isSubmitting, runWithLock };
}

