'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HeroBanner.module.css';

const slides = [
    {
        image: '/Banners/Banner 1.png',
        alt: 'Find Your Next Treasure',
        title: 'Find Your Next Treasure',
        subtitle: 'Browse live auctions on quality secondhand items',
        cta: 'Browse Auctions',
        href: '/auctions',
        objectPosition: 'center bottom',
    },
    {
        image: '/Banners/Banner 2.png',
        alt: 'Live Now. Bid Now.',
        title: 'Live Now. Bid Now.',
        subtitle: 'Join ongoing livestream auctions and win great deals in real time',
        cta: 'Join a Live Auction',
        href: '/live',
        objectPosition: 'center 30%',
    },
    {
        image: '/Banners/Banner 3.png',
        alt: 'Bid with Confidence',
        title: 'Bid with Confidence',
        subtitle: 'Verified sellers, secure payments, and buyer protection — every auction',
        cta: 'Learn More',
        href: '/buyer-protection',
        id: 'buyer-protection',
        objectPosition: 'center 20%',
    },
];

const slideActionIds = ['browse-auctions', 'join-live-auction', 'buyer-protection'];

export default function HeroBanner() {
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const [bannerActions, setBannerActions] = useState({});
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);

    const next = useCallback(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
    }, []);

    const prev = useCallback(() => {
        setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
    }, []);

    useEffect(() => {
        if (paused) return;
        const timer = setInterval(next, 5000);
        return () => clearInterval(timer);
    }, [paused, next]);

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        fetch(`${apiUrl}/api/banner/buttons`)
            .then(res => (res.ok ? res.json() : null))
            .then(json => {
                const actions = {};
                (json?.data || []).forEach(action => {
                    actions[action.id] = action;
                });
                setBannerActions(actions);
            })
            .catch(() => {});
    }, []);

    const trackClick = (id) => {
        if (!id) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        fetch(`${apiUrl}/api/banner/buttons/${id}/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'home-hero' }),
            keepalive: true,
        }).catch(() => {});
    };

    const onTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchEndX.current = null;
    };

    const onTouchMove = (e) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const onTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) return;
        const delta = touchStartX.current - touchEndX.current;
        if (Math.abs(delta) > 50) {
            delta > 0 ? next() : prev();
        }
        touchStartX.current = null;
        touchEndX.current = null;
    };

    return (
        <div className={styles.heroContainer}>
            <div
                className={styles.slider}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Track that slides horizontally */}
                <div
                    className={styles.track}
                    style={{ transform: `translateX(-${current * 100}%)` }}
                >
                    {slides.map((slide, i) => {
                        const actionId = slide.id || slideActionIds[i];
                        const action = bannerActions[actionId] || {};
                        const href = action.href || slide.href;
                        const label = action.label || slide.cta;

                        return (
                        <div key={i} className={styles.slide}>
                            <Image
                                src={slide.image}
                                alt={slide.alt}
                                fill
                                sizes="(max-width: 768px) 100vw, 1440px"
                                className={styles.slideImage}
                                style={{ objectPosition: slide.objectPosition }}
                                priority={i === 0}
                                quality={100}
                            />
                            <div className={styles.overlay} />
                            <div className={styles.content}>
                                <h1 className={styles.title}>{slide.title}</h1>
                                <p className={styles.subtitle}>{slide.subtitle}</p>
                                <Link href={href} className={styles.cta} onClick={() => trackClick(actionId)}>
                                    {label}
                                </Link>
                            </div>
                        </div>
                    )})}
                </div>

                {/* Arrows */}
                <button className={`${styles.arrow} ${styles.arrowLeft}`} onClick={prev} aria-label="Previous slide">
                    &#8249;
                </button>
                <button className={`${styles.arrow} ${styles.arrowRight}`} onClick={next} aria-label="Next slide">
                    &#8250;
                </button>

                {/* Dots */}
                <div className={styles.dots}>
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
                            onClick={() => setCurrent(i)}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
