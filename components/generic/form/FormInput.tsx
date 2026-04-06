import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { FORM_FIXED_HEIGHT_CLASS, FORM_INPUT_CLASS } from "./styles";

export function FormInput({
  className,
  fixedHeight = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  fixedHeight?: boolean;
}) {
  return (
    <input
      {...props}
      className={cn(FORM_INPUT_CLASS, fixedHeight && FORM_FIXED_HEIGHT_CLASS, className)}
    />
  );
}
