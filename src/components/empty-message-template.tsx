import { FaTshirt } from "react-icons/fa";
import type { IconType } from "react-icons";

interface EmptyMessageTemplateProps {
  title: string;
  subtitle: string;
  buttonText?: string;
  onButtonClick?: () => void;
  icon?: IconType;
}

const EmptyMessageTemplate = ({
  title,
  subtitle,
  buttonText,
  onButtonClick,
  icon: Icon = FaTshirt,
}: EmptyMessageTemplateProps) => {
  return (
    <div className="relative mx-auto w-full max-w-md flex items-center justify-center h-full">
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <Icon className="text-8xl text-gray-400" />
        <p className="text-gray-500 text-lg">{title}</p>
        <p className="text-gray-400 text-sm">{subtitle}</p>
        {buttonText && onButtonClick && (
          <button
            onClick={onButtonClick}
            className="vera-btn-primary px-6 py-3 text-base font-semibold mt-2"
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyMessageTemplate;
