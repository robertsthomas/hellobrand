import Link from "next/link";
import { ArrowRight, Boxes, Braces, FileJson, Layers3, Palette } from "lucide-react";

import { EmptyState } from "@/components/patterns/empty-state";
import { SectionIntro } from "@/components/patterns/section-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  designSystemColorTokens,
  designSystemLayers,
  designSystemRules,
  designSystemShapeTokens,
  designSystemTypeRoles,
  patternComponentNames,
  primitiveComponentNames,
} from "@/lib/design-system/foundation";

function tokenColor(variable: string) {
  return `rgb(var(${variable}))`;
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground lg:px-10 lg:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="app-surface overflow-hidden border-black/8 px-8 py-8 dark:border-white/10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <SectionIntro
              eyebrow="HelloBrand"
              title="Design system foundation"
              description="The system is now split into semantic tokens, strict primitives, and reusable app patterns. This page is the public overview; the JSON endpoint is the machine-readable contract."
              titleClassName="text-4xl tracking-[-0.06em] sm:text-5xl"
              descriptionClassName="max-w-2xl text-base leading-7"
              actions={(
                <>
                  <Button asChild>
                    <Link href="/api/design-system">
                      Open JSON contract
                      <FileJson className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/app/help">
                      View product usage
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="shadow-panel">
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Palette className="h-4 w-4 text-primary" />
                    Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-6 text-sm text-muted-foreground">
                  <p>{designSystemColorTokens.length} semantic color tokens</p>
                  <p>{designSystemShapeTokens.length} shared shape and motion tokens</p>
                </CardContent>
              </Card>
              <Card className="shadow-panel">
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers3 className="h-4 w-4 text-primary" />
                    Layers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-6 text-sm text-muted-foreground">
                  <p>{primitiveComponentNames.length} primitives in `components/ui`</p>
                  <p>{patternComponentNames.length} initial patterns in `components/patterns`</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-xl tracking-[-0.04em]">Semantic color tokens</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {designSystemColorTokens.map((token) => (
                <div key={token.name} className="rounded-lg border border-border bg-background p-4">
                  <div
                    className="h-16 rounded-md border border-black/5 dark:border-white/10"
                    style={{ backgroundColor: tokenColor(token.cssVariable) }}
                  />
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium">{token.name}</p>
                    <p className="text-xs text-muted-foreground">{token.tailwindToken}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{token.usage}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-xl tracking-[-0.04em]">Typography and shape</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {designSystemTypeRoles.map((role) => (
                <div key={role.name} className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {role.name}
                  </p>
                  <p className="mt-2 text-sm font-medium">{role.className}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{role.usage}</p>
                </div>
              ))}
              {designSystemShapeTokens.map((token) => (
                <div key={token.name} className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm font-medium">{token.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {token.token} · {token.value}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{token.usage}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-[-0.04em]">
                <Braces className="h-5 w-5 text-primary" />
                Layer rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {designSystemLayers.map((layer) => (
                <div key={layer.name} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{layer.name}</p>
                    <Badge variant="outline">{layer.path}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{layer.purpose}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {layer.rules.map((rule) => (
                      <p key={rule} className="text-xs leading-5 text-muted-foreground">
                        {rule}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="shadow-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl tracking-[-0.04em]">
                  <Boxes className="h-5 w-5 text-primary" />
                  Current inventory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Primitives
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {primitiveComponentNames.map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Patterns
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {patternComponentNames.map((name) => (
                      <Badge key={name} variant="outline">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Rules
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {designSystemRules.map((rule) => (
                      <p key={rule} className="text-sm text-muted-foreground">
                        {rule}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <EmptyState
              title="Pattern layer seeded"
              description="EmptyState and SectionIntro are the first canonical app-level patterns. Repeated feature headers, empty states, and panel shells should move here next."
            />
          </div>
        </section>
      </div>
    </main>
  );
}
