type PromptAttributeValue = string | number | boolean | null | undefined;

export type PromptSectionInput = {
  tag: string;
  content: string | null | undefined;
  attributes?: Record<string, PromptAttributeValue>;
};

function renderAttributes(attributes?: Record<string, PromptAttributeValue>) {
  if (!attributes) {
    return "";
  }

  const pairs = Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, "'")}"`);

  return pairs.length > 0 ? ` ${pairs.join(" ")}` : "";
}

export function xmlSection(input: PromptSectionInput) {
  const content = input.content?.trim();
  if (!content) {
    return null;
  }

  const attrs = renderAttributes(input.attributes);
  return `<${input.tag}${attrs}>\n${content}\n</${input.tag}>`;
}

export function joinPromptSections(
  sections: Array<PromptSectionInput | string | null | undefined>
) {
  return sections
    .map((section) => {
      if (!section) {
        return null;
      }

      if (typeof section === "string") {
        const value = section.trim();
        return value.length > 0 ? value : null;
      }

      return xmlSection(section);
    })
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}

export function promptBullets(items: Array<string | null | undefined>) {
  return items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .map((item) => `- ${item}`)
    .join("\n");
}

export function promptNumbered(items: Array<string | null | undefined>) {
  return items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

export function promptQuotedText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) {
    return null;
  }

  return ['"""', text, '"""'].join("\n");
}

export function isoDateContext(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
