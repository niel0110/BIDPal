"""
Train Random Forest on full 1.4M Mercari dataset using scikit-learn.
Exports a compact JSON that Node.js loads for prediction.

Usage:
    python backend/scripts/trainModelPython.py
"""

import csv
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
DATA_TSV   = ROOT / "backend" / "data" / "train.tsv"
OUTPUT     = ROOT / "backend" / "data" / "models" / "price_rf_model.json"

USD_TO_PHP = 56.0

# ── Feature constants (mirror mlModelService.js V3) ─────────────────────────
CATEGORIES = [
    'Smartphones', 'Laptops', 'TVs', 'Tablets', 'Cameras', 'Gaming Consoles',
    'Headphones', 'Electronics', 'Fashion', 'Home & Garden', 'Sports',
    'Collectibles', 'Smartwatches', 'Other'
]

CONDITION_MAP = {1: 6, 2: 5, 3: 4, 4: 3, 5: 2}  # id → score

CATEGORY_MAP = {
    'Electronics': 'Electronics', 'Men': 'Fashion', 'Women': 'Fashion',
    'Beauty': 'Fashion', 'Kids': 'Fashion', 'Home': 'Home & Garden',
    'Sports & Outdoors': 'Sports', 'Handmade': 'Collectibles',
    'Vintage & Collectibles': 'Collectibles',
}

PREMIUM_BRANDS = {'Apple', 'Samsung', 'Sony', 'LG', 'Bose', 'Canon', 'Nikon', 'Dell', 'HP', 'Lenovo'}
LUXURY_BRANDS  = {'Gucci', 'Louis Vuitton', 'Prada', 'Chanel', 'Hermes', 'Dior', 'Burberry', 'Rolex', 'Omega'}


def stable_hash(value: str) -> int:
    if not value:
        return 0
    h = 0
    for c in value:
        h = (h * 31 + ord(c)) % 1000
    return h


def has_any(text: str, terms) -> bool:
    return any(t in text for t in terms)


def extract_screen_size(text: str) -> float:
    m = re.search(r'(\d{2,3}(?:\.\d+)?)\s*(?:inch|"|in\b)', text, re.I)
    return float(m.group(1)) if m else 0.0


def extract_year(text: str) -> int:
    m = re.search(r'\b(20\d{2})\b', text)
    return int(m.group(1)) if m else 0


def get_category(category_name: str) -> str:
    if not category_name:
        return 'Other'
    parts = category_name.split('/')
    return CATEGORY_MAP.get(parts[0], parts[0])


def encode_features(name, desc, brand, category, category_name, condition_id, shipping) -> list:
    cat = get_category(category_name)
    cat_idx = CATEGORIES.index(cat) if cat in CATEGORIES else len(CATEGORIES) - 1
    cond_score = CONDITION_MAP.get(int(condition_id or 3), 3)
    brand = brand.strip() if brand else ''
    has_brand = 1 if brand else 0
    text = ' '.join([name or '', desc or '', brand, cat, category_name or '']).lower()
    year = extract_year(text)
    age  = max(0, 2025 - year) if year else 0

    return [
        cat_idx / 5,
        cond_score / 6,
        has_brand,
        stable_hash(brand) / 1000,
        0,                                    # modelHash (not in TSV)
        min((len(name) if name else 0) / 100, 2),
        min((len(desc) if desc else 0) / 800, 2),
        1 if str(shipping) == '1' else 0,
        1 if has_any(text, ['electronics', 'cell phone', 'smartphone', 'laptop', 'computer', 'camera']) else 0,
        1 if has_any(text, ['fashion', 'women', 'men', 'shoes', 'bag', 'handbag', 'jewelry']) else 0,
        1 if has_any(text, ['home', 'furniture', 'decor', 'kitchen']) else 0,
        1 if has_any(text, ['tv', 'television', 'smart tv', 'oled', 'qled', 'uhd']) else 0,
        1 if has_any(text, ['phone', 'iphone', 'galaxy', 'smartphone']) else 0,
        1 if has_any(text, ['laptop', 'macbook', 'notebook', 'computer']) else 0,
        1 if has_any(text, ['pro', 'max', 'ultra', 'plus', 'air', 'series']) else 0,
        1 if has_any(text, ['new', 'sealed', 'unopened', 'original box']) else 0,
        1 if has_any(text, ['broken', 'crack', 'parts only', 'not working', 'fix']) else 0,
        1 if has_any(text, ['oled', 'qled', '4k', 'uhd']) else 0,
        min(extract_screen_size(text) / 100, 1.5),
        min(age / 10, 2),
        1 if brand in PREMIUM_BRANDS else 0,
        1 if brand in LUXURY_BRANDS else 0,
        1 if has_any(text, ['case', 'cover', 'charger', 'cable', 'adapter',
                            'screen protector', 'earbud', 'earphone',
                            'remote', 'mount', 'strap', 'box only']) else 0,
        0,   # subCategoryHash (not stored in flat TSV)
        0,   # leafCategoryHash
    ]


def export_forest(forest) -> list:
    trees = []
    for est in forest.estimators_:
        t = est.tree_
        trees.append({
            'feature':        t.feature.tolist(),
            'threshold':      t.threshold.tolist(),
            'children_left':  t.children_left.tolist(),
            'children_right': t.children_right.tolist(),
            'value':          t.value[:, 0, 0].tolist(),
        })
    return trees


def main():
    print(f"Reading {DATA_TSV} ...")
    t0 = time.time()

    X, y = [], []
    skipped = 0

    with open(DATA_TSV, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for i, row in enumerate(reader):
            try:
                price_usd = float(row['price'])
                if price_usd <= 0:
                    skipped += 1
                    continue
                price_php = price_usd * USD_TO_PHP
                feats = encode_features(
                    row.get('name', ''),
                    row.get('item_description', ''),
                    row.get('brand_name', ''),
                    '',
                    row.get('category_name', ''),
                    row.get('item_condition_id', 3),
                    row.get('shipping', 0),
                )
                X.append(feats)
                y.append(price_php)
            except Exception:
                skipped += 1
                continue
            if (i + 1) % 100_000 == 0:
                print(f"   Parsed {i+1:,} rows  ({len(X):,} valid) ...", flush=True)

    print(f"Loaded {len(X):,} valid rows ({skipped:,} skipped) in {time.time()-t0:.1f}s")

    n_estimators = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    max_depth    = int(sys.argv[2]) if len(sys.argv) > 2 else 12

    print(f"Training RandomForest: {n_estimators} trees, depth {max_depth}, {len(X):,} samples ...")
    t1 = time.time()

    X_arr = np.array(X, dtype=np.float32)
    y_arr = np.array(y, dtype=np.float32)

    rf = RandomForestRegressor(
        n_estimators=n_estimators,
        max_depth=max_depth,
        n_jobs=-1,        # use all CPU cores
        random_state=42,
        verbose=1,
    )
    rf.fit(X_arr, y_arr)

    elapsed = time.time() - t1
    print(f"RF fit complete in {elapsed:.1f}s")

    print("Exporting trees to JSON ...")
    trees = export_forest(rf)

    metadata = {
        "source": "Mercari Price Suggestion Challenge",
        "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "trainedSamples": len(X),
        "skippedRows": skipped,
        "fullDataset": True,
        "featureVersion": 3,
        "nEstimators": n_estimators,
        "maxDepth": max_depth,
        "targetCurrency": "PHP",
        "engine": "sklearn",
        "features": [
            "categoryIndex","conditionScore","hasBrand","brandHash","modelHash",
            "nameLength","descriptionLength","sellerPaysShipping","isElectronics",
            "isFashion","isHome","isTv","isPhone","isLaptop","isPremiumTier",
            "isNewCondition","isBroken","hasAdvancedDisplay","screenSize","age",
            "premiumElectronicsBrand","luxuryBrand","isAccessory",
            "subCategoryHash","leafCategoryHash"
        ]
    }

    output = {"metadata": metadata, "engine": "sklearn", "trees": trees}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w') as f:
        json.dump(output, f)

    size_mb = OUTPUT.stat().st_size / 1024 / 1024
    print(f"Saved to {OUTPUT} ({size_mb:.1f} MB)")
    print("Model training completed successfully.")


if __name__ == "__main__":
    main()
