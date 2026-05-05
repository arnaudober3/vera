import { useState, useEffect } from "react";
import { deleteImage, getAllImages, putImage } from "../storage/image-db.ts";

// Private singleton state reused through the app
let state: Map<string, string> = new Map();
let isInitialized = false;
let isInitializing = false;
const listeners = new Set<(images: Map<string, string>) => void>();

const initialize = async () => {
  if (isInitialized || isInitializing) {
    return;
  }

  isInitializing = true;

  try {
    const images = await getAllImages();
    state = images;
    listeners.forEach((listener) => listener(images));
  } catch (error) {
    console.error("Error loading images from IndexedDB:", error);
    state = new Map();
  } finally {
    isInitialized = true;
    isInitializing = false;
  }
};

export function useImage() {
  const [images, setImages] = useState(state);

  useEffect(() => {
    const listener = (newImages: Map<string, string>) => setImages(newImages);
    listeners.add(listener);

    if (!isInitialized && !isInitializing) {
      void initialize();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const saveImage = async ({
    id,
    imageData,
  }: {
    id: string;
    imageData: string;
  }): Promise<void> => {
    await putImage(id, imageData);
    const newState = new Map(state);
    newState.set(id, imageData);
    emitChange(newState);
  };

  const removeImage = async (id: string): Promise<void> => {
    await deleteImage(id);
    const newState = new Map(state);
    newState.delete(id);
    emitChange(newState);
  };

  const getImage = (id: string): string | undefined => {
    return state.get(id) || undefined;
  };

  function emitChange(newImages: Map<string, string>): void {
    state = newImages;
    listeners.forEach((listener) => listener(newImages));
  }

  return {
    images,
    getImage,
    saveImage,
    removeImage,
  };
}
