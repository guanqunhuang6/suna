#!/usr/bin/env python3
"""
Test script to insert a URL into the url_recommendation_tmp table
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, '/Users/guanqunhuang/Desktop/Reality/suna/backend')

from services.url_feed import insert_url, get_all_urls


async def main():
    url = "https://vibe-creation-9ae10c73.s3.us-east-1.amazonaws.com/contents/04c764c8-5b0d-49f1-bb08-ac046975206c/index.html"
    
    try:
        # Insert the URL
        print(f"Inserting URL: {url}")
        result = await insert_url(
            url=url,
            meta_info={
                "source": "s3",
                "bucket": "vibe-creation-9ae10c73",
                "type": "html_content"
            }
        )
        print(f"✅ Successfully inserted URL with ID: {result['id']}")
        print(f"   Full record: {result}")
        
        # Verify by getting all URLs
        print("\n📋 Current URLs in database:")
        all_urls = await get_all_urls()
        for idx, url_record in enumerate(all_urls, 1):
            print(f"   {idx}. {url_record['url'][:80]}... (ID: {url_record['id']})")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)