import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { FORM_TEXTAREA_CLASS } from "./styles";

export function FormTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(FORM_TEXTAREA_CLASS, className)} />;
}
