import { Globe2, LocateFixed, Minus, Moon, Plus, ScanSearch, Sun } from "lucide-react"
import { useTheme } from "@/lib/theme"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Camera } from "./camera"

type Props = {
  camera: Camera
  globe: boolean
  onGlobe: (g: boolean) => void
  onFitResults: () => void
  compact?: boolean
  className?: string
}

type CtlProps = { label: string; hint?: string; pressed?: boolean; onClick?: () => void; children: React.ReactNode }

function Ctl({ label, hint, pressed, onClick, children }: CtlProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className="size-9 rounded-lg aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        >
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

export function MapControls({ camera, globe, onGlobe, onFitResults, compact, className }: Props) {
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
        <Ctl label="Globe view" pressed={globe} onClick={() => onGlobe(!globe)}>
          <Globe2 />
        </Ctl>
        <Ctl label={dark ? "Light mode" : "Dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun /> : <Moon />}
        </Ctl>
      </div>
    </div>
  )
}
