import * as React from "react"
import { cn } from "../../../lib/utils"

export interface ToggleProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, checked, onCheckedChange, label, ...props }, ref) => {
    return (
      <div className="flex items-center space-x-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            ref={ref}
            {...props}
          />
          <div className={cn(
            "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-transform after:duration-300 after:ease-in-out peer-checked:bg-blue-600 transition-colors duration-300 ease-in-out",
            checked && "bg-blue-600 after:translate-x-full",
            className
          )} />
        </label>
        {label && (
          <span className="text-sm font-medium text-foreground">
            {label}
          </span>
        )}
      </div>
    )
  }
)
Toggle.displayName = "Toggle"

export { Toggle }
