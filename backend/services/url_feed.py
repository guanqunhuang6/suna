"""
URL Feed Service

This module provides functions to interact with the url_recommendation_tmp table
"""

from typing import List, Dict, Any, Optional
from services.supabase import DBConnection
from utils.logger import logger


async def get_all_urls() -> List[Dict[str, Any]]:
    """
    Retrieve all URLs from the url_recommendation_tmp table
    
    Returns:
        List[Dict[str, Any]]: List of all URL records with their metadata
    """
    try:
        db = DBConnection()
        await db.initialize()
        client = await db.client
        
        # Query all records from url_recommendation_tmp table
        result = await client.table("url_recommendation_tmp").select("*").order("created_at", desc=True).execute()
        
        if result.data:
            logger.debug(f"Retrieved {len(result.data)} URLs from url_recommendation_tmp")
            return result.data
        else:
            logger.debug("No URLs found in url_recommendation_tmp")
            return []
            
    except Exception as e:
        logger.error(f"Error retrieving URLs from url_recommendation_tmp: {e}")
        raise RuntimeError(f"Failed to retrieve URLs: {str(e)}")


async def insert_url(url: str, meta_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Insert a new URL into the url_recommendation_tmp table
    
    Args:
        url (str): The URL string to insert
        meta_info (Optional[Dict[str, Any]]): Optional metadata for the URL
    
    Returns:
        Dict[str, Any]: The inserted record data
        
    Raises:
        RuntimeError: If the insertion fails or URL already exists
    """
    try:
        db = DBConnection()
        await db.initialize()
        client = await db.client
        
        # Prepare the data to insert
        data = {
            "url": url,
            "meta_info": meta_info or {}
        }
        
        # Insert the new URL record
        result = await client.table("url_recommendation_tmp").insert(data).execute()
        
        if result.data:
            logger.debug(f"Successfully inserted URL: {url}")
            return result.data[0]
        else:
            raise RuntimeError("No data returned after insertion")
            
    except Exception as e:
        error_message = str(e)
        
        # Check if it's a unique constraint violation
        if "duplicate key value violates unique constraint" in error_message:
            logger.warning(f"URL already exists: {url}")
            raise RuntimeError(f"URL already exists in the database: {url}")
        else:
            logger.error(f"Error inserting URL into url_recommendation_tmp: {e}")
            raise RuntimeError(f"Failed to insert URL: {error_message}")