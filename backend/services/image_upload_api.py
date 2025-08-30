"""
Image Upload API Endpoints

This module provides REST API endpoints for image upload operations:
- POST /api/images/upload-base64 - Upload a base64 encoded image
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.s3_upload_utils import upload_base64_image
from utils.auth_utils import get_current_user_id_from_jwt
from utils.logger import logger

router = APIRouter()


class Base64ImageUploadRequest(BaseModel):
    """Request model for uploading base64 encoded images"""
    base64_data: str


class ImageUploadResponse(BaseModel):
    """Response model for image upload operations"""
    url: str
    success: bool = True
    message: str = "Image uploaded successfully"


@router.post("/images/upload-base64", response_model=ImageUploadResponse)
async def upload_base64_image_endpoint(
    request: Base64ImageUploadRequest,
    user_id: str = Depends(get_current_user_id_from_jwt),
):
    """
    Upload a base64 encoded image to storage
    
    Args:
        request: Base64 image upload request containing the base64 data and optional bucket name
        user_id: Authenticated user ID from JWT
    
    Returns:
        ImageUploadResponse: The public URL of the uploaded image
    """
    try:
        logger.debug(f"User {user_id} is uploading a base64 image to bucket browser-screenshots")
        
        # Upload the image using the utility function with fixed bucket name
        public_url = await upload_base64_image(
            base64_data=request.base64_data,
            bucket_name="browser-screenshots"
        )
        
        return ImageUploadResponse(
            url=public_url,
            success=True,
            message="Image uploaded successfully"
        )
        
    except RuntimeError as e:
        logger.error(f"Failed to upload image for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error uploading image for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")