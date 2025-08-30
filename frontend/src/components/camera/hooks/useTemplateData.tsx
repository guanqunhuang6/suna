import { useState, useEffect } from 'react';

export interface Template {
  id: string;
  title: string;
  content: string;
}

export function useTemplateData() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customText, setCustomText] = useState('what is something happening');

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      
      // TODO: Replace with actual API call
      // const response = await fetch('/api/templates');
      // const data = await response.json();
      
      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      
      const mockTemplates: Template[] = [
        {
          id: '1',
          title: 'any one inside the image?',
          content: 'is there any one in the image and could you please tell me what is your model?'
        },
        {
          id: '2', 
          title: '模版2',
          content: '这是模版2的内容'
        }
      ];
      
      setTemplates(mockTemplates);
      console.log('📝 Templates loaded:', mockTemplates);
      
    } catch (error) {
      console.error('❌ Failed to fetch templates:', error);
      // Fallback to default templates
      setTemplates([
        { id: '1', title: '模版1', content: '默认模版1' },
        { id: '2', title: '模版2', content: '默认模版2' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    templates,
    isLoading,
    customText,
    setCustomText,
    fetchTemplates
  };
}