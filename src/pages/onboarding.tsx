import * as React from "react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FaCamera, FaCheck, FaRegImage, FaTshirt } from "react-icons/fa";
import {
  categoryOptions,
  type ClothingItemCategory,
  type ClothingItemSubCategory,
  type CreateClothingItem,
  subCategoryLabels,
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
import "./onboarding.css";

const STEP_TOTAL = 4;
type Step = "welcome" | "snap" | "processing" | "reveal";
const stepIndex: Record<Step, number> = {
  welcome: 0,
  snap: 1,
  processing: 2,
  reveal: 3,
};

export const WelcomePage = (): React.JSX.Element => {
  const navigate = useNavigate();
  const { addClothingItem } = useCloset();
  const { saveImage } = useImage();

  const [step, setStep] = useState<Step>("welcome");
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [subCategory, setSubCategory] = useState<ClothingItemSubCategory | "">(
    "",
  );
  const [classificationFailed, setClassificationFailed] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  function finishAndExit(target: string): void {
    markOnboardingComplete();
    navigate(target, { replace: true });
  }

  function resetForRetake(): void {
    setBeforeImage(null);
    setAfterImage(null);
    setClassification(null);
    setSubCategory("");
    setClassificationFailed(false);
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
        setClassificationFailed(true);
      }

      setStep("reveal");
    } catch {
      setProcessingError(
        "We couldn't process that photo. Try a different one.",
      );
      setStep("snap");
    }
  }

  async function handleSave(): Promise<void> {
    if (!afterImage || !name.trim()) return;
    if (classificationFailed && !subCategory) return;

    setIsSaving(true);
    try {
      const resolvedSubCategory =
        subCategory || classification?.subCategory || undefined;
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

      markOnboardingComplete();
      navigate("/closet", { state: { justOnboarded: true }, replace: true });
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
          classification={classification}
          classificationFailed={classificationFailed}
          subCategory={subCategory}
          onSubCategoryChange={setSubCategory}
          isSaving={isSaving}
          onSave={handleSave}
          onRetake={resetForRetake}
          onSkip={() => finishAndExit("/closet")}
        />
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
}): React.JSX.Element => (
  <Stage padding={28}>
    <div style={{ flex: 1 }} />
    <div style={{ textAlign: "center", padding: "0 4px" }}>
      <div
        className="vera-display"
        style={{
          fontSize: 44,
        }}
      >
        A fresh outfit every morning.
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
      Snap your closet — Vera organises it, picks an outfit for tomorrow, and
      tracks what's clean.
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
        Get started
      </button>
      <SkipLink onClick={onSkip} label="I'll do it later" />
      <StepDots active={stepIndex.welcome} />
    </div>
  </Stage>
);

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
}): React.JSX.Element => (
  <Stage>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      <div className="vera-eyebrow" style={{ color: "var(--vera-primary)" }}>
        Step 1
      </div>
      <div className="vera-display" style={{ fontSize: 34 }}>
        Snap your first item.
      </div>
      <div
        style={{
          color: "var(--vera-fg-muted)",
          fontSize: 15,
          lineHeight: 1.5,
          marginTop: 2,
        }}
      >
        Lay a top flat on a plain surface. Vera removes the background
        automatically.
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
      <Tip>Good light, plain background</Tip>
      <Tip>One item per photo</Tip>
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
        Open camera
      </button>
      <button
        type="button"
        className="vera-btn-secondary"
        onClick={onChooseFromPhotos}
      >
        <FaRegImage />
        Choose from photos
      </button>
      <SkipLink onClick={onSkip} label="I'll do it later" />
      <StepDots active={stepIndex.snap} />
    </div>
  </Stage>
);

const ProcessingScreen = (): React.JSX.Element => (
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
      Removing the background…
    </div>
    <div
      style={{
        fontSize: 13,
        color: "rgba(255,255,255,0.6)",
        textAlign: "center",
        maxWidth: 280,
      }}
    >
      This usually takes a few seconds.
    </div>
    <div style={{ marginTop: 20 }}>
      <StepDots active={stepIndex.processing} />
    </div>
    <style>{`@keyframes vera-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const BeforeAfter = ({
  side,
  image,
}: {
  side: "before" | "after";
  image: string | null;
}): React.JSX.Element => {
  if (side === "before") {
    return (
      <div
        style={{
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background:
            "linear-gradient(135deg, #d8c9b8 0%, #e8dccc 60%, #c9b9a4 100%)",
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
            alt="Original"
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
          alt="Background removed"
          style={{
            maxWidth: "85%",
            maxHeight: "85%",
            objectFit: "contain",
          }}
        />
      ) : (
        <FaTshirt size={64} color="#365f8e" />
      )}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          background: "var(--vera-primary)",
          color: "#fff",
          borderRadius: 999,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.02,
        }}
      >
        clean
      </div>
    </div>
  );
};

const RevealScreen = ({
  beforeImage,
  afterImage,
  name,
  onNameChange,
  classification,
  classificationFailed,
  subCategory,
  onSubCategoryChange,
  isSaving,
  onSave,
  onRetake,
  onSkip,
}: {
  beforeImage: string | null;
  afterImage: string | null;
  name: string;
  onNameChange: (value: string) => void;
  classification: ClassificationResult | null;
  classificationFailed: boolean;
  subCategory: ClothingItemSubCategory | "";
  onSubCategoryChange: (value: ClothingItemSubCategory | "") => void;
  isSaving: boolean;
  onSave: () => void;
  onRetake: () => void;
  onSkip: () => void;
}): React.JSX.Element => {
  const detectedLabel = classification?.subCategory
    ? subCategoryLabels[classification.subCategory]
    : null;
  const canSave =
    !!afterImage &&
    !!name.trim() &&
    (!classificationFailed || !!subCategory) &&
    !isSaving;

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
          <span>Cleaned up</span>
        </div>
        <div className="vera-display" style={{ fontSize: 30 }}>
          That's all Vera needs.
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
          Before
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
          After
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
            Name
          </span>
          <input
            className="vera-input"
            value={name}
            placeholder="e.g., Navy tee"
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isSaving}
          />
        </label>

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
            Category
          </span>
          {classificationFailed ? (
            <select
              className="vera-input"
              value={subCategory}
              onChange={(e) =>
                onSubCategoryChange(
                  e.target.value as ClothingItemSubCategory | "",
                )
              }
              disabled={isSaving}
            >
              <option disabled value="">
                Select…
              </option>
              {categoryOptions.map((cat) => (
                <optgroup key={cat.value} label={cat.label}>
                  {Object.entries(subCategoryLabels)
                    .filter(
                      ([sub]) =>
                        subCategoryToCategory[
                          sub as ClothingItemSubCategory
                        ] === cat.value,
                    )
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <div
              className="vera-input"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{detectedLabel ?? "Detecting…"}</span>
              <span style={{ color: "var(--vera-fg-muted)" }}>auto</span>
            </div>
          )}
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
          {isSaving ? "Saving…" : "Save to closet"}
        </button>
        <button
          type="button"
          className="vera-btn-secondary"
          onClick={onRetake}
          disabled={isSaving}
        >
          Retake
        </button>
        <SkipLink onClick={onSkip} label="Skip and finish" />
        <StepDots active={stepIndex.reveal} />
      </div>
    </Stage>
  );
};
