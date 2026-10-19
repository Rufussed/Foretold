import { elementIcon } from "./card-icons";
import { CARD_FONT, cardFontReady, drawIcon } from "./card-label";
import { CARDS } from "./config";

// What is printed on the card back, over the art's gold ring: the game's name
// above it and the four element icons at its cardinal points.

export type FacePrint = (context: CanvasRenderingContext2D, width: number, height: number) => void;

// Waits for the font and icons, then returns the drawing. A font or icon that
// fails to arrive is left out rather than failing the back.
export async function prepareCardBack(): Promise<FacePrint> {
  const back = CARDS.back;
  const [icons] = await Promise.all([
    Promise.all(back.ringElements.map((element) => elementIcon(element).catch(() => undefined))),
    cardFontReady().catch(() => {}),
  ]);

  return (context, width, height) => {
    const centerX = width / 2;
    const centerY = back.ringCenterY * height;
    const radius = back.ringRadius * width;
    const box = back.iconSize * width;

    // Icons sit on the ring, centred on its line, at the cardinal points.
    icons.forEach((icon, i) => {
      if (!icon) return;
      const angle = (i / icons.length) * Math.PI * 2 - Math.PI / 2;
      drawIcon(
        context,
        icon,
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius - box / 2,
        { box, outline: back.iconOutline * width, feather: back.iconFeather * width },
      );
    });

    // The title is sized to a fixed share of the card's width, whatever the
    // font's own proportions, and stands above the top icon.
    context.font = `100px ${CARD_FONT}, serif`;
    const measured = context.measureText(back.title);
    const size = (100 * back.titleWidth * width) / measured.width;
    context.font = `${size}px ${CARD_FONT}, serif`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.lineJoin = "round";
    context.lineWidth = size * CARDS.outlineWidth;
    context.strokeStyle = "#000000";
    context.fillStyle = back.titleColor;
    const baseline = centerY - radius - box / 2 - back.titleGap * width;
    context.strokeText(back.title, centerX, baseline);
    context.fillText(back.title, centerX, baseline);
  };
}
