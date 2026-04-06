import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { FORM_SELECT_CLASS } from "./styles";

export function FormSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(FORM_SELECT_CLASS, className)}>
      {children}
    </select>
  );
}
