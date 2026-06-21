import React from 'react';
import { Star, Flame, Tag, MapPin, Accessibility, LayoutGrid, HelpCircle, AlertCircle } from 'lucide-react';

interface IconMapperProps {
  iconName: string;
  className?: string;
}

export const IconMapper: React.FC<IconMapperProps> = ({ iconName, className }) => {
  // Normalize the icon name
  const name = iconName.toLowerCase();

  const props = { className };

  if (name.includes('star')) return <Star {...props} />;
  if (name.includes('flame') || name.includes('fire')) return <Flame {...props} />;
  if (name.includes('tag') || name.includes('money') || name.includes('price')) return <Tag {...props} />;
  if (name.includes('map') || name.includes('pin')) return <MapPin {...props} />;
  if (name.includes('access') || name.includes('wheelchair')) return <Accessibility {...props} />;
  if (name.includes('help')) return <HelpCircle {...props} />;
  
  // Defaults
  return <LayoutGrid {...props} />;
};