BEGIN;

-- Create url_recommendation_tmp table
CREATE TABLE IF NOT EXISTS public.url_recommendation_tmp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    meta_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate URLs
ALTER TABLE public.url_recommendation_tmp ADD CONSTRAINT url_recommendation_tmp_url_unique UNIQUE(url);

-- Create index for faster queries on created_at
CREATE INDEX IF NOT EXISTS idx_url_recommendation_tmp_created_at ON public.url_recommendation_tmp(created_at);

-- Create function to update updated_at timestamp if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_url_recommendation_tmp_updated_at ON public.url_recommendation_tmp;
CREATE TRIGGER update_url_recommendation_tmp_updated_at
    BEFORE UPDATE ON public.url_recommendation_tmp
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.url_recommendation_tmp IS 'Temporary table for storing recommended URLs';
COMMENT ON COLUMN public.url_recommendation_tmp.id IS 'Unique identifier for each URL record';
COMMENT ON COLUMN public.url_recommendation_tmp.url IS 'The HTML link URL';
COMMENT ON COLUMN public.url_recommendation_tmp.meta_info IS 'Additional metadata for the URL in JSON format';
COMMENT ON COLUMN public.url_recommendation_tmp.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN public.url_recommendation_tmp.updated_at IS 'Timestamp when the record was last updated';

COMMIT;