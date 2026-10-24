import { useState } from "react";
import { EmptyState } from "./EmptyState";

export interface ImagePreviewProps {
  imageUrl: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export function ImagePreview({
  imageUrl,
  alt,
  width,
  height,
  className = "",
}: ImagePreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div className={`image-preview-container fallback ${className}`.trim()}>
        <EmptyState
          type="unavailable-artifact"
          title="Image unavailable"
          message="Could not load the candidate image preview."
        />
      </div>
    );
  }

  const aspectRatio = width && height ? `${width} / ${height}` : undefined;

  return (
    <div
      className={`image-preview-container ${className}`.trim()}
      style={{ aspectRatio }}
    >
      {!isLoaded && (
        <div className="image-preview-skeleton" aria-hidden="true" />
      )}
      <img
        src={imageUrl}
        alt={alt}
        className={`image-preview-img ${isLoaded ? "loaded" : "loading"}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
