import { Globe2, Layers, LocateFixed, Minus, Moon, Plus, ScanSearch, Sun } from "lucide-react"
import { useTheme } from "@/lib/theme"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Camera } from "./camera"

type Props = {
  camera: Camera
  layer: "points" | "density"
  globe: boolean
  onLayer: (l: "points" | "density") => void
  onGlobe: (g: boolean) => void
  onFitResults: () => void
  compact?: boolean
  className?: string
}

function Ctl({ label, hint, onClick, children }: { label: string; hint?: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} className="size-9 rounded-lg">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        {label}
        {hint && <Kbd>{hint}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

export function MapControls({ camera, layer, globe, onLayer, onGlobe, onFitResults, compact, className }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  const locate = () => {
    if (!("geolocation" in navigator)) return toast.error("Location isn't available in this browser")
    navigator.geolocation.getCurrentPosition(
      (p) => camera.flyTo(p.coords.longitude, p.coords.latitude, 7),
      () => toast.error("Couldn't get your location", { description: "Check the browser's location permission." }),
      { timeout: 8000 },
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!compact && (
        <div className="surface-float flex flex-col rounded-xl p-0.5">
          <Ctl label="Zoom in" hint="+" onClick={() => camera.zoomBy(1)}>
            <Plus />
          </Ctl>
          <Ctl label="Zoom out" hint="−" onClick={() => camera.zoomBy(-1)}>
            <Minus />
          </Ctl>
        </div>
      )}
      <div className="surface-float flex flex-col rounded-xl p-0.5">
        <Ctl label="Fit map to results" hint="F" onClick={onFitResults}>
          <ScanSearch />
        </Ctl>
        <Ctl label="Near me" onClick={locate}>
          <LocateFixed />
        </Ctl>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Map layers" className="size-9 rounded-lg">
                  <Layers />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">Map layers</TooltipContent>
          </Tooltip>
          <PopoverContent side="left" align="start" className="w-64 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Show positions as</div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={layer}
              onValueChange={(v) => v && onLayer(v as "points" | "density")}
              className="w-full"
            >
              <ToggleGroupItem value="points" className="flex-1 text-xs">
                Clusters
              </ToggleGroupItem>
              <ToggleGroupItem value="density" className="flex-1 text-xs">
                Density
              </ToggleGroupItem>
            </ToggleGroup>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-md text-sm">
              <span className="flex items-center gap-2">
                <Globe2 className="size-4 text-muted-foreground" /> Globe view
              </span>
              <Switch checked={globe} onCheckedChange={onGlobe} />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The globe flattens into a regular map as you zoom in.
            </p>
          </PopoverContent>
        </Popover>
        <Ctl label={dark ? "Light mode" : "Dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun /> : <Moon />}
        </Ctl>
      </div>
    </div>
  )
}
