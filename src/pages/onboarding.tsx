import * as React from "react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FaCamera, FaCheck, FaRegImage, FaTshirt } from "react-icons/fa";
import { MdAdd, MdCalendarToday, MdLockOutline, MdNotifications } from "react-icons/md";
import { PiPants, PiSneaker } from "react-icons/pi";
import {
  type ClothingItemCategory,
  type CreateClothingItem,
  categoryToNoun,
  subCategoryToCategory,
  subCategoryToNoun,
} from "../models/clothing-item.ts";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { uploadService } from "../services/remove-bg.ts";
import {
  fashionClassifier,
  type ClassificationResult,
} from "../services/fashion-classifier.ts";
import {
  dataURLToBlob,
  extractDominantColor,
  processImageToBase64,
} from "../services/image-processing.ts";
import { colorName } from "../utils/color.ts";
import { markOnboardingComplete } from "../storage/onboarding.ts";
import { useCalendar } from "../hooks/calendar.ts";
import { useNotifications } from "../hooks/notifications.ts";
import { GoogleCalendarError } from "../services/google-calendar.ts";
import "./onboarding.css";

// Value-first onboarding: Promise → add a top (1/2) → add a bottom (2/2) →
// your first outfit (the "aha") → optional level-up asks → exit to the closet.
// Background removal happens inline on the capture card; everything is skippable.
type Step =
  | "welcome"
  | "add-top"
  | "add-bottom"
  | "outfit"
  | "levelup"
  | "add-more"
  | "calendar"
  | "notifications";

// The kind of piece a capture screen handles — drives the glyph, colour and the
// default category when classification is unavailable.
type PieceKind = "top" | "bottom" | "shoes";

const KIND_CATEGORY: Record<PieceKind, ClothingItemCategory> = {
  top: "top",
  bottom: "bottom",
  shoes: "shoes",
};

// Debug mode (VITE_ENABLE_DEBUG=true): "Add my first piece" skips the two
// capture steps and jumps straight to the first-outfit screen so the later
// screens can be reviewed without snapping photos. Off in normal builds.
const DEBUG = import.meta.env.VITE_ENABLE_DEBUG === "true";

const capitalize = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// The five dots shown across the core path (welcome → add-top → add-bottom →
// outfit → levelup). The optional detours (add-more, calendar) show no dots.
const DOT_TOTAL = 5;

export const WelcomePage = (): React.JSX.Element => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("welcome");
  const [topImage, setTopImage] = useState<string | null>(null);
  const [bottomImage, setBottomImage] = useState<string | null>(null);
  const [addedMore, setAddedMore] = useState(false);
  const [connected, setConnected] = useState(false);

  function finishAndExit(target: string): void {
    markOnboardingComplete();
    navigate(target, { replace: true });
  }

  // Final exit once the user is done — lands on the closet with the
  // just-onboarded flag so it can welcome the freshly-added pieces.
  function completeOnboarding(): void {
    markOnboardingComplete();
    navigate("/closet", { state: { justOnboarded: true }, replace: true });
  }

  return (
    <div className="vera-onboarding">
      {step === "welcome" && (
        <WelcomeScreen
          onNext={() => setStep(DEBUG ? "outfit" : "add-top")}
          onSkip={() => finishAndExit("/closet")}
        />
      )}

      {step === "add-top" && (
        <AddPieceScreen
          key="add-top"
          kind="top"
          dotIndex={1}
          onComplete={(image) => {
            setTopImage(image);
            setStep("add-bottom");
          }}
          onSkip={() => finishAndExit("/closet")}
        />
      )}

      {step === "add-bottom" && (
        <AddPieceScreen
          key="add-bottom"
          kind="bottom"
          dotIndex={2}
          onComplete={(image) => {
            setBottomImage(image);
            setStep("outfit");
          }}
          onSkip={() => finishAndExit("/closet")}
        />
      )}

      {step === "outfit" && (
        <OutfitScreen
          topImage={topImage}
          bottomImage={bottomImage}
          onNext={() => setStep("levelup")}
        />
      )}

      {step === "levelup" && (
        <LevelUpScreen
          addedMore={addedMore}
          connected={connected}
          onAddPieces={() => setStep("add-more")}
          onConnect={() => setStep("calendar")}
          onNotifications={() => setStep("notifications")}
          onFinish={completeOnboarding}
        />
      )}

      {step === "add-more" && (
        <AddPieceScreen
          key="add-more"
          kind="shoes"
          dotIndex={null}
          optional
          onComplete={() => {
            setAddedMore(true);
            setStep("levelup");
          }}
          onSkip={() => setStep("levelup")}
        />
      )}

      {step === "calendar" && (
        <CalendarScreen
          onConnected={() => {
            setConnected(true);
            setStep("levelup");
          }}
          onSkip={() => setStep("levelup")}
        />
      )}

      {step === "notifications" && (
        <NotificationScreen
          onDone={() => setStep("levelup")}
          onSkip={() => setStep("levelup")}
        />
      )}
    </div>
  );
};

// ── Shared layout primitives ────────────────────────────────────
const Stage = ({
  children,
  padding = 24,
  paddingTop = 56,
  paddingBottom = 32,
  gap = 18,
}: {
  children: React.ReactNode;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  gap?: number;
}): React.JSX.Element => (
  <div
    style={{
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      paddingTop,
      paddingBottom,
      paddingLeft: padding,
      paddingRight: padding,
      boxSizing: "border-box",
      gap,
      position: "relative",
    }}
  >
    {children}
  </div>
);

const SkipLink = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}): React.JSX.Element => (
  <div style={{ display: "flex", justifyContent: "center", minHeight: 24 }}>
    <button type="button" onClick={onClick} className="vera-skip-link">
      {label}
    </button>
  </div>
);

const SkipTopRight = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}): React.JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    style={{
      position: "absolute",
      top: 52,
      right: 16,
      background: "transparent",
      border: 0,
      color: "var(--vera-fg-muted)",
      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 500,
      padding: 8,
      cursor: "pointer",
      zIndex: 5,
    }}
  >
    {label}
  </button>
);

const Eyebrow = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <div
    style={{
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.04em",
      color: "var(--vera-primary)",
      display: "flex",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

const SerifTitle = ({
  children,
  size = 34,
}: {
  children: React.ReactNode;
  size?: number;
}): React.JSX.Element => (
  <div className="vera-display" style={{ fontSize: size, lineHeight: 1.16 }}>
    {children}
  </div>
);

const StepDots = ({
  active,
  total = DOT_TOTAL,
}: {
  active: number;
  total?: number;
}): React.JSX.Element => (
  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        style={{
          width: i === active ? 22 : 6,
          height: 6,
          borderRadius: 3,
          background:
            i === active ? "var(--vera-primary)" : "var(--vera-gray-300)",
          transition: "width var(--vera-duration) var(--vera-ease)",
        }}
      />
    ))}
  </div>
);

const CornerBrackets = (): React.JSX.Element => {
  const arm = 22;
  const t = 3;
  const c = "var(--vera-primary)";
  const corner = (pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      width: arm,
      height: arm,
    };
    if (pos === "tl")
      return {
        ...base,
        top: 0,
        left: 0,
        borderTop: `${t}px solid ${c}`,
        borderLeft: `${t}px solid ${c}`,
        borderTopLeftRadius: 6,
      };
    if (pos === "tr")
      return {
        ...base,
        top: 0,
        right: 0,
        borderTop: `${t}px solid ${c}`,
        borderRight: `${t}px solid ${c}`,
        borderTopRightRadius: 6,
      };
    if (pos === "bl")
      return {
        ...base,
        bottom: 0,
        left: 0,
        borderBottom: `${t}px solid ${c}`,
        borderLeft: `${t}px solid ${c}`,
        borderBottomLeftRadius: 6,
      };
    return {
      ...base,
      bottom: 0,
      right: 0,
      borderBottom: `${t}px solid ${c}`,
      borderRight: `${t}px solid ${c}`,
      borderBottomRightRadius: 6,
    };
  };
  return (
    <>
      <div style={corner("tl")} />
      <div style={corner("tr")} />
      <div style={corner("bl")} />
      <div style={corner("br")} />
    </>
  );
};

const kindGlyph = (kind: PieceKind, size: number, color: string) => {
  if (kind === "bottom") return <PiPants size={size} color={color} />;
  if (kind === "shoes") return <PiSneaker size={size} color={color} />;
  return <FaTshirt size={size} color={color} />;
};

const kindColor = (kind: PieceKind): string =>
  kind === "bottom" ? "#3a4a63" : kind === "shoes" ? "#5a4a3a" : "#365f8e";

// ── Screen 0 · Promise ───────────────────────────────────────────
const WelcomeScreen = ({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <Stage padding={28}>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: "center", padding: "0 2px" }}>
        <SerifTitle size={38}>{t("onboarding.welcome.title")}</SerifTitle>
      </div>
      <div
        style={{
          textAlign: "center",
          color: "var(--vera-fg-muted)",
          fontSize: 16,
          lineHeight: 1.5,
          padding: "0 14px",
        }}
      >
        {t("onboarding.welcome.subtitle")}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          paddingBottom: 4,
        }}
      >
        <button type="button" className="vera-btn-primary" onClick={onNext}>
          {t("onboarding.welcome.cta")}
        </button>
        <SkipLink onClick={onSkip} label={t("onboarding.welcome.skip")} />
        <StepDots active={0} />
      </div>
    </Stage>
  );
};

// ── Screens 1, 2 & "more" · Add a piece (inline background removal) ──
type Phase = "empty" | "removing" | "done";

const AddPieceScreen = ({
  kind,
  dotIndex,
  optional = false,
  onComplete,
  onSkip,
}: {
  kind: PieceKind;
  dotIndex: number | null;
  optional?: boolean;
  onComplete: (image: string) => void;
  onSkip: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const { addClothingItem } = useCloset();
  const { saveImage } = useImage();

  const [phase, setPhase] = useState<Phase>("empty");
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const glyphColor = kindColor(kind);

  async function handleFileSelected(file: File | undefined): Promise<void> {
    if (!file || !file.type.startsWith("image/")) return;

    setPhase("removing");
    setError(null);
    try {
      const preBg = await processImageToBase64(file);
      setBeforeImage(preBg);

      const preBgBlob = dataURLToBlob(preBg);
      const preBgFile = new File([preBgBlob], file.name, { type: "image/png" });

      const noBgBlob = await uploadService.removeBackground(preBgFile);
      const noBgFile = new File([noBgBlob], file.name, { type: "image/png" });
      const postBg = await processImageToBase64(noBgFile);
      setAfterImage(postBg);

      try {
        setClassification(await fashionClassifier.classifyClothing(noBgBlob));
      } catch {
        setClassification(null);
      }

      setPhase("done");
    } catch {
      setError(t("onboarding.addPiece.processError"));
      setBeforeImage(null);
      setPhase("empty");
    }
  }

  // Auto-name the piece from its dominant colour and detected type
  // ("Navy tee", "Beige chinos"); renameable later in the closet.
  function buildName(category: ClothingItemCategory, color: string): string {
    const sub = classification?.subCategory;
    const noun = sub ? subCategoryToNoun[sub] : categoryToNoun[category];
    const cName = colorName(color);
    return capitalize(cName ? `${cName} ${noun}` : noun);
  }

  async function handleNext(): Promise<void> {
    if (phase !== "done" || !afterImage) return;
    setSaving(true);
    try {
      const sub = classification?.subCategory || undefined;
      const category: ClothingItemCategory = sub
        ? subCategoryToCategory[sub]
        : KIND_CATEGORY[kind];
      const color = await extractDominantColor(afterImage);

      const item: CreateClothingItem = {
        name: buildName(category, color),
        category,
        subCategory: sub,
        color,
        isClean: true,
        imageData: afterImage,
      };

      const saved = await addClothingItem(item);
      await saveImage({ id: saved.imageId || saved.id, imageData: afterImage });
      onComplete(afterImage);
    } finally {
      setSaving(false);
    }
  }

  const c = `onboarding.addPiece.${kind === "bottom" ? "bottom" : kind === "shoes" ? "more" : "top"}`;

  return (
    <Stage paddingTop={56}>
      <SkipTopRight onClick={onSkip} label={t("onboarding.addPiece.skip")} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        <Eyebrow>
          {optional ? t("onboarding.addPiece.optional") : t(`${c}.step`)}
        </Eyebrow>
        <SerifTitle>{t(`${c}.title`)}</SerifTitle>
        <div
          style={{
            color: "var(--vera-fg-muted)",
            fontSize: 15,
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {t(`${c}.hint`)}
        </div>
      </div>

      {/* capture / preview tile */}
      <div
        className="vera-card"
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          marginTop: 2,
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {phase === "empty" ? (
            <>
              <CornerBrackets />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {kindGlyph(kind, 70, "var(--vera-gray-300)")}
                <div style={{ fontSize: 13, color: "var(--vera-fg-muted)" }}>
                  {t("onboarding.addPiece.snapHint")}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff",
              }}
            >
              {/* original photo fades out as the cutout fades in */}
              {beforeImage && (
                <img
                  src={beforeImage}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: phase === "done" ? 0 : 1,
                    transition: "opacity 600ms var(--vera-ease)",
                  }}
                />
              )}
              {afterImage && (
                <img
                  src={afterImage}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: phase === "done" ? 1 : 0,
                    transition: "opacity 600ms var(--vera-ease)",
                  }}
                />
              )}
              {!beforeImage && !afterImage && (
                <div style={{ position: "relative" }}>
                  {kindGlyph(kind, 84, glyphColor)}
                </div>
              )}
              {phase === "removing" ? (
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--vera-fg-muted)",
                  }}
                >
                  {t("onboarding.addPiece.tidying")}
                </div>
              ) : (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "var(--vera-primary)",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <FaCheck size={10} /> {t("onboarding.addPiece.ready")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, textAlign: "center" }}>
          {error}
        </div>
      )}

      {/* actions */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: 4,
        }}
      >
        {phase === "empty" ? (
          <>
            <button
              type="button"
              className="vera-btn-primary"
              onClick={() => cameraInputRef.current?.click()}
            >
              <FaCamera />
              {t("onboarding.addPiece.openCamera")}
            </button>
            <button
              type="button"
              className="vera-btn-secondary"
              onClick={() => galleryInputRef.current?.click()}
            >
              <FaRegImage />
              {t("onboarding.addPiece.choosePhotos")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="vera-btn-primary"
            onClick={() => void handleNext()}
            disabled={phase !== "done" || saving}
          >
            {saving ? t("common.saving") : t(`${c}.next`)}
          </button>
        )}
        {dotIndex == null ? null : <StepDots active={dotIndex} />}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />
    </Stage>
  );
};

// ── Screen 3 · Your first outfit (the "aha") ─────────────────────
const PieceTile = ({
  image,
  kind,
}: {
  image: string | null;
  kind: PieceKind;
}): React.JSX.Element => (
  <div
    style={{
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 10,
      background: "#fff",
      border: "1px solid var(--vera-surface-border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    {image ? (
      <img
        src={image}
        alt=""
        style={{ maxWidth: "85%", maxHeight: "85%", objectFit: "contain" }}
      />
    ) : (
      kindGlyph(kind, 56, kindColor(kind))
    )}
  </div>
);

const OutfitScreen = ({
  topImage,
  bottomImage,
  onNext,
}: {
  topImage: string | null;
  bottomImage: string | null;
  onNext: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(id);
  }, []);

  return (
    <Stage>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
        <Eyebrow>
          <FaCheck size={11} color="var(--vera-primary)" />
          {t("onboarding.outfit.eyebrow")}
        </Eyebrow>
        <SerifTitle size={32}>{t("onboarding.outfit.title")}</SerifTitle>
      </div>

      <div
        className="vera-card"
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
          transition:
            "opacity 420ms var(--vera-ease), transform 420ms var(--vera-ease)",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <PieceTile image={topImage} kind="top" />
          </div>
          <div style={{ flex: 1 }}>
            <PieceTile image={bottomImage} kind="bottom" />
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 10 }}>
          <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--vera-fg-muted)" }}>
            {t("onboarding.outfit.top")}
          </span>
          <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--vera-fg-muted)" }}>
            {t("onboarding.outfit.bottom")}
          </span>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          color: "var(--vera-fg-muted)",
          fontSize: 14,
          lineHeight: 1.5,
          padding: "0 10px",
        }}
      >
        {t("onboarding.outfit.body")}
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: 4,
        }}
      >
        <button type="button" className="vera-btn-primary" onClick={onNext}>
          {t("onboarding.outfit.cta")}
        </button>
        <StepDots active={3} />
      </div>
    </Stage>
  );
};

// ── Screen 4 · Level up (costly asks, only now that value landed) ─
const AskCard = ({
  icon,
  title,
  body,
  action,
  onAction,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  done: boolean;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div
      className="vera-card"
      style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left" }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(101,170,167,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--vera-fg-strong)" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--vera-fg-muted)", lineHeight: 1.45, marginTop: 3 }}>
          {body}
        </div>
        {done ? (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--vera-primary)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <FaCheck size={12} /> {t("onboarding.levelup.done")}
          </div>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="vera-btn-secondary"
            style={{
              marginTop: 12,
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--vera-primary)",
              width: "auto",
            }}
          >
            {action}
          </button>
        )}
      </div>
    </div>
  );
};

const LevelUpScreen = ({
  addedMore,
  connected,
  onAddPieces,
  onConnect,
  onNotifications,
  onFinish,
}: {
  addedMore: boolean;
  connected: boolean;
  onAddPieces: () => void;
  onConnect: () => void;
  onNotifications: () => void;
  onFinish: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const { permissionStatus } = useNotifications();
  const notificationsDone = permissionStatus === "granted" || permissionStatus === "denied";

  return (
    <Stage>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
        <Eyebrow>{t("onboarding.addPiece.optional")}</Eyebrow>
        <SerifTitle size={30}>{t("onboarding.levelup.title")}</SerifTitle>
        <div
          style={{
            color: "var(--vera-fg-muted)",
            fontSize: 15,
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {t("onboarding.levelup.subtitle")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <AskCard
          icon={<MdAdd size={20} color="var(--vera-primary)" />}
          title={t("onboarding.levelup.addTitle")}
          body={t("onboarding.levelup.addBody")}
          action={t("onboarding.levelup.addAction")}
          done={addedMore}
          onAction={onAddPieces}
        />
        <AskCard
          icon={<MdCalendarToday size={16} color="var(--vera-primary)" />}
          title={t("onboarding.levelup.calTitle")}
          body={t("onboarding.levelup.calBody")}
          action={t("onboarding.levelup.calAction")}
          done={connected}
          onAction={onConnect}
        />
        <AskCard
          icon={<MdNotifications size={20} color="var(--vera-primary)" />}
          title={t("onboarding.levelup.notifTitle")}
          body={t("onboarding.levelup.notifBody")}
          action={t("onboarding.levelup.notifAction")}
          done={notificationsDone}
          onAction={onNotifications}
        />
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: 4,
        }}
      >
        <button type="button" className="vera-btn-primary" onClick={onFinish}>
          {t("onboarding.levelup.finish")}
        </button>
        <StepDots active={4} />
      </div>
    </Stage>
  );
};

// ── Screen 4b · Connect calendar (optional, post-value) ──────────
const CalendarScreen = ({
  onConnected,
  onSkip,
}: {
  onConnected: () => void;
  onSkip: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const { connect } = useCalendar();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examples = [
    { when: t("onboarding.calendar.ex1When"), what: t("onboarding.calendar.ex1What"), cue: t("onboarding.calendar.ex1Cue") },
    { when: t("onboarding.calendar.ex2When"), what: t("onboarding.calendar.ex2What"), cue: t("onboarding.calendar.ex2Cue") },
    { when: t("onboarding.calendar.ex3When"), what: t("onboarding.calendar.ex3What"), cue: t("onboarding.calendar.ex3Cue") },
  ];

  async function handleConnect(): Promise<void> {
    setConnecting(true);
    setError(null);
    try {
      await connect();
      onConnected();
    } catch (err) {
      if (err instanceof GoogleCalendarError) {
        console.warn("Calendar connect failed:", err.reason, err.message);
        // Closing the popup is a deliberate cancel — let them retry, no error.
        if (err.reason === "cancelled") return;
        setError(
          t(
            err.reason === "popup_blocked"
              ? "onboarding.calendar.popupBlocked"
              : "onboarding.calendar.error",
          ),
        );
      } else {
        console.warn("Calendar connect failed:", err);
        setError(t("onboarding.calendar.error"));
      }
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Stage gap={14}>
      <SkipTopRight onClick={onSkip} label={t("onboarding.calendar.skip")} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        <Eyebrow>
          <MdCalendarToday size={13} color="var(--vera-primary)" />
          {t("onboarding.addPiece.optional")}
        </Eyebrow>
        <SerifTitle size={30}>{t("onboarding.calendar.title")}</SerifTitle>
        <div
          style={{
            color: "var(--vera-fg-muted)",
            fontSize: 15,
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {t("onboarding.calendar.subtitle")}
        </div>
      </div>

      <div className="vera-card" style={{ padding: 6, display: "flex", flexDirection: "column" }}>
        {examples.map((e, i) => (
          <div
            key={e.what}
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr auto",
              alignItems: "center",
              gap: 10,
              padding: "12px 12px",
              borderTop: i === 0 ? "none" : "1px solid var(--vera-gray-100)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "rgba(101,170,167,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <MdCalendarToday size={15} color="var(--vera-primary)" />
              </span>
              <div style={{ minWidth: 0, textAlign: "left" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--vera-fg-strong)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {e.what}
                </div>
                <div style={{ fontSize: 12, color: "var(--vera-fg-muted)", whiteSpace: "nowrap" }}>
                  {e.when}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", color: "var(--vera-gray-300)" }}>
              <svg width="16" height="12" viewBox="0 0 20 14" fill="none" aria-hidden>
                <path
                  d="M1 7h17m-5-5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                justifySelf: "end",
                background: "var(--vera-surface)",
                border: "1px solid var(--vera-surface-border)",
                borderRadius: 999,
                padding: "5px 11px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--vera-primary)",
                whiteSpace: "nowrap",
              }}
            >
              {e.cue}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 13,
          color: "var(--vera-fg-muted)",
          lineHeight: 1.45,
          padding: "0 4px",
        }}
      >
        <MdLockOutline
          size={14}
          color="var(--vera-fg-subtle)"
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        {t("onboarding.calendar.privacy")}
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 4,
        }}
      >
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "var(--vera-danger, #b91c1c)",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}
        <button
          type="button"
          className="vera-btn-primary"
          onClick={() => void handleConnect()}
          disabled={connecting}
        >
          <MdCalendarToday />
          {connecting
            ? t("onboarding.calendar.connecting")
            : t("onboarding.calendar.connect")}
        </button>
      </div>
    </Stage>
  );
};

// ── Screen 4c · Notifications (optional) ───────────────────────
const NotificationScreen = ({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const { supported, enableDailyReminder } = useNotifications();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(): Promise<void> {
    if (!supported) {
      setError(t("onboarding.notifications.unsupported"));
      return;
    }
    setRequesting(true);
    setError(null);
    try {
      await enableDailyReminder();
      onDone();
    } catch {
      setError(t("onboarding.notifications.error"));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Stage gap={14}>
      <SkipTopRight onClick={onSkip} label={t("onboarding.notifications.skip")} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        <Eyebrow>
          <MdNotifications size={13} color="var(--vera-primary)" />
          {t("onboarding.addPiece.optional")}
        </Eyebrow>
        <SerifTitle size={30}>{t("onboarding.notifications.title")}</SerifTitle>
        <div
          style={{
            color: "var(--vera-fg-muted)",
            fontSize: 15,
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {t("onboarding.notifications.subtitle")}
        </div>
      </div>

      <div
        className="vera-card"
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "rgba(101,170,167,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MdNotifications size={32} color="var(--vera-primary)" />
        </div>
        <div style={{ fontSize: 14, color: "var(--vera-fg-muted)", lineHeight: 1.5 }}>
          {t("onboarding.notifications.body")}
        </div>
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 4,
        }}
      >
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "var(--vera-danger, #b91c1c)",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}
        <button
          type="button"
          className="vera-btn-primary"
          onClick={() => void handleRequest()}
          disabled={requesting}
        >
          <MdNotifications />
          {requesting
            ? t("onboarding.notifications.requesting")
            : t("onboarding.notifications.cta")}
        </button>
      </div>
    </Stage>
  );
};
