"""
URL Feed API Endpoints

This module provides REST API endpoints for URL feed operations:
- GET /api/url-feed - Get all URLs from the feed
- POST /api/url-feed - Insert a new URL into the feed
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from services.url_feed import get_all_urls, insert_url
from utils.auth_utils import get_current_user_id_from_jwt
from utils.logger import logger

router = APIRouter()


class URLInsertRequest(BaseModel):
    """Request model for inserting a URL"""
    url: str
    meta_info: Optional[Dict[str, Any]] = None


class URLResponse(BaseModel):
    """Response model for a single URL record"""
    id: str
    url: str
    meta_info: Dict[str, Any]
    created_at: str
    updated_at: str


class URLListResponse(BaseModel):
    """Response model for list of URLs"""
    urls: List[URLResponse]
    count: int


class URLInsertResponse(BaseModel):
    """Response model for URL insertion"""
    success: bool
    message: str
    data: URLResponse


@router.get("/url-feed", response_model=URLListResponse)
async def get_url_feed(
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Get all URLs from the recommendation feed
    
    Args:
        user_id: Authenticated user ID from JWT
    
    Returns:
        URLListResponse: List of all URLs with their metadata
    """
    try:
        logger.debug(f"User {user_id} is fetching URL feed")
        
        urls = await get_all_urls()
        
        return URLListResponse(
            urls=urls,
            count=len(urls)
        )
        
    except Exception as e:
        logger.error(f"Error fetching URL feed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch URL feed")


@router.post("/url-feed", response_model=URLInsertResponse)
async def add_url_to_feed(
    request: URLInsertRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Add a new URL to the recommendation feed
    
    Args:
        request: URL insertion request containing the URL and optional metadata
        user_id: Authenticated user ID from JWT
    
    Returns:
        URLInsertResponse: Confirmation of successful insertion with the created record
    """
    try:
        logger.debug(f"User {user_id} is adding URL to feed: {request.url}")
        
        # Add user_id to metadata for tracking
        meta_info = request.meta_info or {}
        meta_info["added_by"] = user_id
        
        result = await insert_url(
            url=request.url,
            meta_info=meta_info
        )
        
        return URLInsertResponse(
            success=True,
            message="URL added successfully to the feed",
            data=URLResponse(**result)
        )
        
    except RuntimeError as e:
        error_message = str(e)
        if "already exists" in error_message:
            logger.warning(f"User {user_id} tried to add duplicate URL: {request.url}")
            raise HTTPException(status_code=409, detail=error_message)
        else:
            logger.error(f"Error adding URL for user {user_id}: {e}")
            raise HTTPException(status_code=500, detail=error_message)
    except Exception as e:
        logger.error(f"Unexpected error adding URL for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add URL to feed")