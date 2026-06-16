import * as React from "react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FaCamera, FaCheck, FaRegImage, FaTshirt } from "react-icons/fa";
import { MdAutoAwesome, MdCalendarToday, MdLockOutline } from "react-icons/md";
import {
  type ClothingItemCategory,
  type CreateClothingItem,
  subCategoryToCategory,
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
import { markOnboardingComplete } from "../storage/onboarding.ts";
import { MOCK_AGENDA } from "../models/calendar.ts";
import { useCalendar } from "../hooks/calendar.ts";
import "./onboarding.css";

const STEP_TOTAL = 5;
type Step = "welcome" | "snap" | "processing" | "reveal" | "calendar";
const stepIndex: Record<Step, number> = {
  welcome: 0,
  snap: 1,
  processing: 2,
  reveal: 3,
  calendar: 4,
};

export const WelcomePage = (): React.JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addClothingItem } = useCloset();
  const { saveImage } = useImage();

  // TEMP (test calendar sync): démarre direct sur l'étape calendrier,
  // bypassant welcome + snap/processing/reveal. Remettre "welcome" après.
  const [step, setStep] = useState<Step>("calendar");
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  function finishAndExit(target: string): void {
    markOnboardingComplete();
    navigate(target, { replace: true });
  }

  // Final exit once the (last) calendar step is done — lands on the closet with
  // the just-onboarded flag so it can welcome the freshly-added first item.
  function completeOnboarding(): void {
    markOnboardingComplete();
    navigate("/closet", { state: { justOnboarded: true }, replace: true });
  }

  function resetForRetake(): void {
    setBeforeImage(null);
    setAfterImage(null);
    setClassification(null);
    setProcessingError(null);
    setStep("snap");
  }

  async function handleFileSelected(file: File | undefined): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setStep("processing");
    setProcessingError(null);

    try {
      const preBg = await processImageToBase64(file);
      setBeforeImage(preBg);

      const preBgBlob = dataURLToBlob(preBg);
      const preBgFile = new File([preBgBlob], file.name, {
        type: "image/png",
      });

      const noBgBlob = await uploadService.removeBackground(preBgFile);
      const noBgFile = new File([noBgBlob], file.name, {
        type: "image/png",
      });
      const postBg = await processImageToBase64(noBgFile);
      setAfterImage(postBg);

      try {
        const result = await fashionClassifier.classifyClothing(noBgBlob);
        setClassification(result);
      } catch {
        setClassification(null);
      }

      setStep("reveal");
    } catch {
      setProcessingError(t("onboarding.snap.processError"));
      setStep("snap");
    }
  }

  async function handleSave(): Promise<void> {
    if (!afterImage || !name.trim()) return;

    setIsSaving(true);
    try {
      const resolvedSubCategory = classification?.subCategory || undefined;
      const resolvedCategory: ClothingItemCategory = resolvedSubCategory
        ? subCategoryToCategory[resolvedSubCategory]
        : "top";

      const item: CreateClothingItem = {
        name: name.trim(),
        category: resolvedCategory,
        subCategory: resolvedSubCategory,
        color: await extractDominantColor(afterImage),
        isClean: true,
        imageData: afterImage,
      };

      const saved = await addClothingItem(item);
      await saveImage({
        id: saved.imageId || saved.id,
        imageData: afterImage,
      });

      // First item is in — move on to the calendar step (the final one) rather
      // than exiting onboarding here.
      setStep("calendar");
    } finally {
      setIsSaving(false);
    }
  }

  if (step === "processing") {
    return <ProcessingScreen />;
  }

  return (
    <div className="vera-onboarding">
      {step === "welcome" && (
        <WelcomeScreen
          onNext={() => setStep("snap")}
          onSkip={() => finishAndExit("/closet")}
        />
      )}
      {step === "snap" && (
        <SnapScreen
          onOpenCamera={() => cameraInputRef.current?.click()}
          onChooseFromPhotos={() => galleryInputRef.current?.click()}
          onSkip={() => finishAndExit("/closet")}
          error={processingError}
        />
      )}
      {step === "reveal" && (
        <RevealScreen
          beforeImage={beforeImage}
          afterImage={afterImage}
          name={name}
          onNameChange={setName}
          isSaving={isSaving}
          onSave={handleSave}
          onRetake={resetForRetake}
          onSkip={() => finishAndExit("/closet")}
        />
      )}
      {step === "calendar" && (
        <CalendarConnectScreen onDone={completeOnboarding} />
      )}

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
    </div>
  );
};

const Stage = ({
  children,
  padding = 24,
}: {
  children: React.ReactNode;
  padding?: number;
}): React.JSX.Element => (
  <div
    style={{
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      paddingTop: 60,
      paddingBottom: 44,
      paddingLeft: padding,
      paddingRight: padding,
      boxSizing: "border-box",
      gap: 18,
    }}
  >
    {children}
  </div>
);

const StepDots = ({ active }: { active: number }): React.JSX.Element => (
  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
    {Array.from({ length: STEP_TOTAL }).map((_, i) => (
      <div
        key={i}
        style={{
          width: i === active ? 22 : 6,
          height: 6,
          borderRadius: 3,
          background:
            i === active
              ? "var(--vera-primary)"
              : "var(--vera-gray-300)",
          transition: "width var(--vera-duration) var(--vera-ease)",
        }}
      />
    ))}
  </div>
);

const SkipLink = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}): React.JSX.Element => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      minHeight: 24,
    }}
  >
    <button type="button" onClick={onClick} className="vera-skip-link">
      {label}
    </button>
  </div>
);

const CornerBrackets = (): React.JSX.Element => {
  const arm = 22;
  const t = 3;
  const c = "var(--vera-primary)";
  const corner = (
    pos: "tl" | "tr" | "bl" | "br",
  ): React.CSSProperties => {
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

const Tip = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div
    style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      background: "var(--vera-surface)",
      border: "1px solid var(--vera-surface-border)",
      borderRadius: 999,
      padding: "8px 14px",
      color: "var(--vera-fg-default)",
      fontSize: 14,
    }}
  >
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        background: "var(--vera-primary)",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <FaCheck size={10} />
    </span>
    {children}
  </div>
);

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
      <div style={{ textAlign: "center", padding: "0 4px" }}>
        <div
          className="vera-display"
          style={{
            fontSize: 44,
          }}
        >
          {t("onboarding.welcome.title")}
        </div>
      </div>
      <div
        style={{
          textAlign: "center",
          color: "var(--vera-fg-muted)",
          fontSize: 16,
          lineHeight: 1.5,
          padding: "0 18px",
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
        <StepDots active={stepIndex.welcome} />
      </div>
    </Stage>
  );
};

const CalendarConnectScreen = ({
  onDone,
}: {
  onDone: () => void;
}): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { importIcs } = useCalendar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const todayLabel = (() => {
    const s = new Date().toLocaleDateString(i18n.language || "en", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      await importIcs(file);
      onDone();
    } catch {
      setImportError(t("onboarding.calendar.importError"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Stage>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        <div className="vera-eyebrow" style={{ color: "var(--vera-primary)" }}>
          {t("onboarding.calendar.step")}
        </div>
        <div className="vera-display" style={{ fontSize: 34 }}>
          {t("onboarding.calendar.title")}
        </div>
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

      {/* Agenda preview — shows how today's events map to occasions, with the
          day's standout (dinner) marked as the pick. */}
      <div className="vera-card" style={{ padding: 0, overflow: "hidden", marginTop: 4 }}>
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--vera-gray-100)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--vera-fg-muted)",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <MdCalendarToday size={13} color="var(--vera-primary)" />
          {t("onboarding.calendar.agendaToday", { date: todayLabel })}
        </div>
        {MOCK_AGENDA.map((row, i, a) => (
          <div
            key={row.time}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 14px",
              borderBottom:
                i < a.length - 1 ? "1px solid var(--vera-gray-100)" : "0",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--vera-fg-default)",
                width: 38,
              }}
            >
              {row.time}
            </span>
            <span
              style={{
                fontSize: 14,
                color: "var(--vera-fg-strong)",
                flex: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.title}
            </span>
            {row.occasion && (
              <span
                className={`vera-chip ${row.standout ? "active" : ""}`}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  gap: row.standout ? 5 : 0,
                }}
              >
                {row.standout && <MdAutoAwesome size={11} />}
                {t(`today.occasion.${row.occasion}`)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 11,
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13,
          color: "var(--vera-fg-muted)",
          lineHeight: 1.4,
        }}
      >
        <MdAutoAwesome size={13} color="var(--vera-primary)" />
        {t("onboarding.calendar.standoutNote")}
      </div>

      <div
        style={{
          marginTop: 9,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 13,
          color: "var(--vera-fg-muted)",
          lineHeight: 1.45,
        }}
      >
        <MdLockOutline
          size={14}
          color="var(--vera-fg-subtle)"
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        {t("onboarding.calendar.privacy")}
      </div>

      {importError ? (
        <div
          style={{
            marginTop: 8,
            color: "#b91c1c",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {importError}
        </div>
      ) : null}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 4,
        }}
      >
        <button
          type="button"
          className="vera-btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <MdCalendarToday />
          {importing
            ? t("onboarding.calendar.importing")
            : t("onboarding.calendar.connect")}
        </button>
        <SkipLink onClick={onDone} label={t("onboarding.calendar.maybeLater")} />
        <StepDots active={stepIndex.calendar} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,text/calendar"
        style={{ display: "none" }}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </Stage>
  );
};

const SnapScreen = ({
  onOpenCamera,
  onChooseFromPhotos,
  onSkip,
  error,
}: {
  onOpenCamera: () => void;
  onChooseFromPhotos: () => void;
  onSkip: () => void;
  error: string | null;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <Stage>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        <div className="vera-eyebrow" style={{ color: "var(--vera-primary)" }}>
          {t("onboarding.snap.step")}
        </div>
        <div className="vera-display" style={{ fontSize: 34 }}>
          {t("onboarding.snap.title")}
        </div>
        <div
          style={{
            color: "var(--vera-fg-muted)",
            fontSize: 15,
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {t("onboarding.snap.subtitle")}
        </div>
      </div>

      <div
        className="vera-card"
        style={{
          background: "var(--vera-surface)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          marginTop: 4,
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CornerBrackets />
          <FaTshirt size={72} color="var(--vera-gray-300)" />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Tip>{t("onboarding.snap.tipLight")}</Tip>
        <Tip>{t("onboarding.snap.tipOne")}</Tip>
      </div>

      {error ? (
        <div
          style={{
            color: "#b91c1c",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 4,
        }}
      >
        <button type="button" className="vera-btn-primary" onClick={onOpenCamera}>
          <FaCamera />
          {t("onboarding.snap.openCamera")}
        </button>
        <button
          type="button"
          className="vera-btn-secondary"
          onClick={onChooseFromPhotos}
        >
          <FaRegImage />
          {t("onboarding.snap.chooseFromPhotos")}
        </button>
        <SkipLink onClick={onSkip} label={t("onboarding.snap.skip")} />
        <StepDots active={stepIndex.snap} />
      </div>
    </Stage>
  );
};

const ProcessingScreen = (): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div
      className="vera-onboarding vera-onboarding-processing"
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 96,
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.12)",
            borderTopColor: "#65aaa7",
            animation: "vera-spin 900ms linear infinite",
          }}
        />
        <FaTshirt size={40} color="rgba(255,255,255,0.6)" />
      </div>
      <div
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: 24,
          color: "#fff",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {t("onboarding.processing.title")}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          maxWidth: 280,
        }}
      >
        {t("onboarding.processing.subtitle")}
      </div>
      <div style={{ marginTop: 20 }}>
        <StepDots active={stepIndex.processing} />
      </div>
      <style>{`@keyframes vera-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const BeforeAfter = ({
  side,
  image,
}: {
  side: "before" | "after";
  image: string | null;
}): React.JSX.Element => {
  const { t } = useTranslation();
  if (side === "before") {
    return (
      <div
        style={{
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: "#fff",
          border: "1px solid var(--vera-surface-border)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {image ? (
          <img
            src={image}
            alt={t("onboarding.reveal.imageOriginalAlt")}
            style={{
              maxWidth: "85%",
              maxHeight: "85%",
              objectFit: "contain",
            }}
          />
        ) : (
          <FaTshirt size={64} color="#365f8e" />
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        aspectRatio: "1 / 1",
        borderRadius: 10,
        background: "#fff",
        border: "1px solid var(--vera-surface-border)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {image ? (
        <img
          src={image}
          alt={t("onboarding.reveal.imageCleanedAlt")}
          style={{
            maxWidth: "85%",
            maxHeight: "85%",
            objectFit: "contain",
          }}
        />
      ) : (
        <FaTshirt size={64} color="#365f8e" />
      )}
    </div>
  );
};

const RevealScreen = ({
  beforeImage,
  afterImage,
  name,
  onNameChange,
  isSaving,
  onSave,
  onRetake,
  onSkip,
}: {
  beforeImage: string | null;
  afterImage: string | null;
  name: string;
  onNameChange: (value: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onRetake: () => void;
  onSkip: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const canSave = !!afterImage && !!name.trim() && !isSaving;

  return (
    <Stage>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
        <div
          className="vera-eyebrow"
          style={{
            color: "var(--vera-primary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          <FaCheck size={12} />
          <span>{t("onboarding.reveal.cleanedUp")}</span>
        </div>
        <div className="vera-display" style={{ fontSize: 30 }}>
          {t("onboarding.reveal.title")}
        </div>
      </div>

      <div
        className="vera-card"
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 24px 1fr",
          gap: 8,
          alignItems: "center",
        }}
      >
        <BeforeAfter side="before" image={beforeImage} />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
            <path
              d="M1 7h17m-5-5l5 5-5 5"
              stroke="var(--vera-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <BeforeAfter side="after" image={afterImage} />
        <div
          style={{
            gridColumn: "1",
            textAlign: "center",
            color: "var(--vera-fg-muted)",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {t("onboarding.reveal.before")}
        </div>
        <div />
        <div
          style={{
            gridColumn: "3",
            textAlign: "center",
            color: "var(--vera-fg-muted)",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {t("onboarding.reveal.after")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--vera-fg-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.04,
            }}
          >
            {t("common.name")}
          </span>
          <input
            className="vera-input"
            value={name}
            placeholder={t("common.namePlaceholder")}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isSaving}
          />
        </label>
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
        <button
          type="button"
          className="vera-btn-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          {isSaving ? t("common.saving") : t("onboarding.reveal.save")}
        </button>
        <button
          type="button"
          className="vera-btn-secondary"
          onClick={onRetake}
          disabled={isSaving}
        >
          {t("onboarding.reveal.retake")}
        </button>
        <SkipLink onClick={onSkip} label={t("onboarding.reveal.skip")} />
        <StepDots active={stepIndex.reveal} />
      </div>
    </Stage>
  );
};
