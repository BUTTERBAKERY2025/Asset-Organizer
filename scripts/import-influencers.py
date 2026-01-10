#!/usr/bin/env python3
"""
Import influencers data from Excel file to database
"""
import openpyxl
import psycopg2
import os
import re

def parse_followers(value):
    """Parse follower count from text like '133k', '1.2M', '296k'"""
    if value is None:
        return 0, None
    
    text = str(value).strip().lower()
    original_text = str(value).strip()
    
    # Remove any non-alphanumeric characters except . and k/m
    text = text.replace(',', '').replace(' ', '')
    
    try:
        if 'k' in text:
            num = float(text.replace('k', '').replace('f', ''))
            return int(num * 1000), original_text
        elif 'm' in text:
            num = float(text.replace('m', ''))
            return int(num * 1000000), original_text
        elif 'f' in text:
            # Handle cases like '5f' or '646f' (likely typos)
            num = float(text.replace('f', ''))
            return int(num), original_text
        else:
            return int(float(text)), original_text
    except:
        return 0, original_text

def map_platform(platform_text):
    """Map Arabic platform name to English code"""
    if platform_text is None:
        return None
    
    text = str(platform_text).strip().lower()
    
    mappings = {
        'تيك توك': 'tiktok',
        'تيكتوك': 'tiktok',
        'tiktok': 'tiktok',
        'انستقرام': 'instagram',
        'انستغرام': 'instagram',
        'instagram': 'instagram',
        'تويتر': 'twitter',
        'twitter': 'twitter',
        'x': 'twitter',
        'يوتيوب': 'youtube',
        'youtube': 'youtube',
        'سناب': 'snapchat',
        'سناب شات': 'snapchat',
        'snapchat': 'snapchat',
        'فيسبوك': 'facebook',
        'facebook': 'facebook',
    }
    
    for ar, en in mappings.items():
        if ar in text:
            return en
    
    return 'other'

def clean_text(value):
    """Clean and normalize text value"""
    if value is None:
        return None
    text = str(value).strip()
    # Remove invisible characters
    text = ''.join(c for c in text if c.isprintable() or c in '\n\r\t')
    return text if text else None

def clean_phone(value):
    """Clean phone number"""
    if value is None:
        return None
    phone = str(value).strip()
    # Remove any non-digit characters except +
    phone = re.sub(r'[^\d+]', '', phone)
    return phone if phone else None

def main():
    # Database connection
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        return
    
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    # Load Excel file
    wb = openpyxl.load_workbook('attached_assets/معلنين_الرياض_(1)_1768040948465.xlsx')
    ws = wb.active
    
    rows = list(ws.iter_rows(values_only=True))
    headers = rows[0]
    data_rows = rows[1:]
    
    print(f"Found {len(data_rows)} influencer records to import")
    
    imported = 0
    skipped = 0
    
    for row in data_rows:
        if not row[0]:  # Skip empty rows
            skipped += 1
            continue
        
        name = clean_text(row[0])
        account_url = clean_text(row[1])
        coverage_url = clean_text(row[2])
        region = clean_text(row[3])
        platform = map_platform(row[4])
        follower_count, follower_text = parse_followers(row[5])
        view_rating = int(row[6]) if row[6] else None
        phone = clean_phone(row[7])
        bank_account = clean_text(row[8])
        bank_holder = clean_text(row[9])
        bank_name = clean_text(row[10])
        
        # Check if already exists by name and account_url
        cur.execute("""
            SELECT id FROM marketing_influencers 
            WHERE name = %s OR account_url = %s
        """, (name, account_url))
        
        existing = cur.fetchone()
        
        if existing:
            # Update existing record
            cur.execute("""
                UPDATE marketing_influencers SET
                    account_url = COALESCE(%s, account_url),
                    coverage_url = COALESCE(%s, coverage_url),
                    region = COALESCE(%s, region),
                    platforms = ARRAY[%s],
                    follower_count = %s,
                    follower_count_text = %s,
                    view_rating = COALESCE(%s, view_rating),
                    phone = COALESCE(%s, phone),
                    bank_account_number = COALESCE(%s, bank_account_number),
                    bank_account_holder = COALESCE(%s, bank_account_holder),
                    bank_name = COALESCE(%s, bank_name),
                    updated_at = NOW()
                WHERE id = %s
            """, (
                account_url, coverage_url, region, platform,
                follower_count, follower_text, view_rating,
                phone, bank_account, bank_holder, bank_name,
                existing[0]
            ))
            print(f"  Updated: {name}")
        else:
            # Insert new record
            cur.execute("""
                INSERT INTO marketing_influencers (
                    name, name_ar, account_url, coverage_url, region, city,
                    platforms, specialty, follower_count, follower_count_text,
                    view_rating, phone, bank_account_number, bank_account_holder,
                    bank_name, is_active, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    ARRAY[%s], %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, true, NOW(), NOW()
                )
            """, (
                name, name, account_url, coverage_url, region, region,
                platform, 'food',  # Default specialty for bakery
                follower_count, follower_text,
                view_rating, phone, bank_account, bank_holder,
                bank_name
            ))
            print(f"  Imported: {name}")
        
        imported += 1
    
    conn.commit()
    print(f"\nImport complete!")
    print(f"  Imported/Updated: {imported}")
    print(f"  Skipped (empty): {skipped}")
    
    # Show count
    cur.execute("SELECT COUNT(*) FROM marketing_influencers")
    total = cur.fetchone()[0]
    print(f"  Total influencers in database: {total}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
