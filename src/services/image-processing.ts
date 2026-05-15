import type { Color } from "../models/color.ts";

const MAX_IMAGE_SIZE = 256;
const COMPRESSION_QUALITY = 0.5;

const componentToHexadecimal = (c: number): string =>
  c.toString(16).padStart(2, "0");

export const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;

  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return canvas;

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;

  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;

  trimmedCanvas
    .getContext("2d")
    ?.drawImage(
      canvas,
      minX,
      minY,
      trimmedWidth,
      trimmedHeight,
      0,
      0,
      trimmedWidth,
      trimmedHeight,
    );

  return trimmedCanvas;
};

export const extractDominantColor = async (dataUrl: string): Promise<Color> => {
  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return `#CCCCCC`;
  }

  const maxSample = 64;
  const scale = Math.min(maxSample / image.width, maxSample / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) {
      continue;
    }

    r += data[i];
    g += data[i + 1];
    b += data[i + 2];

    count++;
  }

  if (count === 0) {
    return "#CCCCCC";
  }

  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  return `#${componentToHexadecimal(r)}${componentToHexadecimal(g)}${componentToHexadecimal(b)}`;
};

export const processImageToBase64 = async (file: File): Promise<string> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D not supported");
  }

  const imageElement: HTMLImageElement = await new Promise(
    (resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    },
  );

  const ratio =
    Math.max(imageElement.width, imageElement.height) / MAX_IMAGE_SIZE;
  const processedWidth =
    ratio > 1 ? Math.round(imageElement.width / ratio) : imageElement.width;
  const processedHeight =
    ratio > 1 ? Math.round(imageElement.height / ratio) : imageElement.height;

  canvas.width = processedWidth;
  canvas.height = processedHeight;
  ctx.drawImage(imageElement, 0, 0, processedWidth, processedHeight);

  const trimmedCanvas = trimCanvas(canvas);

  return trimmedCanvas.toDataURL("image/png", COMPRESSION_QUALITY);
};

export const dataURLToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};
